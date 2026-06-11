import { schemaTask, metadata, logger, tasks, runs } from "@trigger.dev/sdk";
import { z } from "zod";
import prisma from "../lib/prisma";
import type { cropImageTask } from "./crop-image";
import type { geminiLlmTask } from "./gemini-llm";
import { WorkflowNode, WorkflowEdge, NodeOutputs } from "@/types/workflow";
import { topologicalSort } from "../lib/dag";
import { DEFAULT_GEMINI_MODEL } from "../lib/constants";

const ExecutorPayloadSchema = z.object({
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  scope: z.enum(["full", "partial", "single"]),
  targetNodeIds: z.array(z.string()).optional(),
});

type NodeResult = {
  status: "success" | "failed" | "skipped";
  outputs: NodeOutputs;
  error?: string;
  duration?: number;
};

const CHILD_POLL_INTERVAL_MS = 2000;
const CHILD_TERMINAL_FAILURES = new Set([
  "FAILED",
  "CRASHED",
  "CANCELED",
  "TIMED_OUT",
  "SYSTEM_FAILURE",
  "EXPIRED",
]);

/**
 * Waits for a child task run by polling the Trigger.dev API. We deliberately
 * avoid triggerAndWait here: its wait checkpoints cannot run under
 * Promise.all ("Parallel waits are not supported"), and this executor runs
 * every ready node concurrently. Polling promises parallelize freely.
 */
async function waitForChildRun(childRunId: string): Promise<NodeOutputs> {
  for (;;) {
    const run = await runs.retrieve(childRunId);

    if (run.status === "COMPLETED") {
      return (run.output ?? {}) as NodeOutputs;
    }
    if (CHILD_TERMINAL_FAILURES.has(run.status)) {
      const message =
        (run.error as { message?: string } | undefined)?.message ??
        `Child task run ${childRunId} ended with status ${run.status}`;
      throw new Error(message);
    }

    await new Promise((resolve) => setTimeout(resolve, CHILD_POLL_INTERVAL_MS));
  }
}

/** Realtime progress published via Trigger.dev run metadata (kept tiny). */
function publishNodeState(
  nodeId: string,
  state: { status: string; error?: string; duration?: number }
) {
  try {
    metadata.set(`node:${nodeId}`, state);
  } catch {
    // metadata only works inside a run context; never let realtime kill execution
  }
}

/** Request-Inputs resolves locally: field values keyed by both id and name. */
function resolveRequestInputsOutputs(node: WorkflowNode): NodeOutputs {
  const outputs: NodeOutputs = {};
  for (const field of node.data.fields ?? []) {
    outputs[field.name] = field.value ?? "";
    outputs[field.id] = field.value ?? "";
  }
  return outputs;
}

/** Looks up the value an edge carries from its source node's outputs. */
function valueFromEdge(edge: WorkflowEdge, outputsByNode: Map<string, NodeOutputs>): unknown {
  const sourceOutputs = outputsByNode.get(edge.source);
  if (!sourceOutputs) return undefined;
  // Handle ids are "<fieldKey>:<dataType>"; the key may itself contain ":" so
  // strip only the final segment.
  const handle = edge.sourceHandle ?? "";
  const fieldKey = handle.slice(0, handle.lastIndexOf(":")) || handle;
  return sourceOutputs[fieldKey];
}

function firstEdgeValue(
  edges: WorkflowEdge[],
  targetHandle: string,
  outputsByNode: Map<string, NodeOutputs>
): unknown {
  const edge = edges.find((e) => e.targetHandle === targetHandle);
  return edge ? valueFromEdge(edge, outputsByNode) : undefined;
}

function resolveNodeInputs(
  node: WorkflowNode,
  incomingEdges: WorkflowEdge[],
  outputsByNode: Map<string, NodeOutputs>
): Record<string, unknown> {
  switch (node.data.type) {
    case "request-inputs": {
      const inputs: Record<string, unknown> = {};
      for (const field of node.data.fields ?? []) {
        inputs[field.name] = field.value ?? "";
      }
      return inputs;
    }
    case "crop-image": {
      const connected = firstEdgeValue(incomingEdges, "imageUrl:image", outputsByNode);
      return {
        imageUrl: typeof connected === "string" ? connected : "",
        x: node.data.cropConfig?.x ?? 0,
        y: node.data.cropConfig?.y ?? 0,
        w: node.data.cropConfig?.width ?? 100,
        h: node.data.cropConfig?.height ?? 100,
      };
    }
    case "gemini": {
      const promptConn = firstEdgeValue(incomingEdges, "prompt:text", outputsByNode);
      const systemConn = firstEdgeValue(incomingEdges, "systemPrompt:text", outputsByNode);
      const imageUrls = incomingEdges
        .filter((e) => e.targetHandle === "imageUrls:image")
        .map((e) => valueFromEdge(e, outputsByNode))
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      return {
        model: node.data.geminiConfig?.model || DEFAULT_GEMINI_MODEL,
        prompt: (typeof promptConn === "string" && promptConn) || node.data.geminiConfig?.prompt || "",
        systemPrompt:
          (typeof systemConn === "string" && systemConn) || node.data.geminiConfig?.systemPrompt || undefined,
        imageUrls,
      };
    }
    case "response": {
      const result = firstEdgeValue(incomingEdges, "result:any", outputsByNode);
      return { result: result ?? "" };
    }
  }
}

export const workflowExecutorTask = schemaTask({
  id: "workflow-executor",
  schema: ExecutorPayloadSchema,
  retry: { maxAttempts: 1 }, // a retried orchestrator would double-trigger child tasks
  run: async (payload) => {
    const { runId, workflowId, scope } = payload;
    logger.info("Executor started", { workflowId, runId, scope, targets: payload.targetNodeIds });

    const runRecord = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { workflow: true },
    });
    if (!runRecord) throw new Error(`WorkflowRun record not found: ${runId}`);

    const nodes = runRecord.workflow.nodes as unknown as WorkflowNode[];
    const edges = runRecord.workflow.edges as unknown as WorkflowEdge[];

    // Validate DAG up front
    let sortedNodes: WorkflowNode[];
    try {
      sortedNodes = topologicalSort(nodes, edges);
    } catch (err) {
      await Promise.all([
        prisma.workflowRun.update({
          where: { id: runId },
          data: { status: "failed", completedAt: new Date() },
        }),
        prisma.workflow.update({
          where: { id: workflowId },
          data: { status: "idle" },
        }),
      ]);
      throw err;
    }

    // Scope semantics: full = every node; single/partial = exactly the targets.
    // Out-of-scope upstream nodes feed cached outputs, they do not re-execute.
    const inScope = new Set<string>(
      scope === "full"
        ? nodes.map((n) => n.id)
        : (payload.targetNodeIds ?? []).filter((id) => nodes.some((n) => n.id === id))
    );

    await Promise.all([
      prisma.workflowRun.update({ where: { id: runId }, data: { status: "running" } }),
      prisma.workflow.update({ where: { id: workflowId }, data: { status: "running" } }),
    ]);

    // Last-known outputs for nodes that won't execute in this run
    const outputsByNode = new Map<string, NodeOutputs>();
    for (const node of nodes) {
      if (inScope.has(node.id)) continue;
      if (node.data.type === "request-inputs") {
        outputsByNode.set(node.id, resolveRequestInputsOutputs(node));
      } else if (node.data.output && typeof node.data.output === "object") {
        outputsByNode.set(node.id, node.data.output as NodeOutputs);
      }
    }

    const nodeRunRecords = await prisma.nodeRun.findMany({ where: { runId } });
    const nodeRunIdByNodeId = new Map(nodeRunRecords.map((nr) => [nr.nodeId, nr.id]));

    const nodePromises = new Map<string, Promise<NodeResult>>();

    const executeNode = async (node: WorkflowNode): Promise<NodeResult> => {
      const incomingEdges = edges.filter((e) => e.target === node.id);
      const nodeRunId = nodeRunIdByNodeId.get(node.id);

      const finalize = async (
        result: NodeResult,
        extra: { inputs?: unknown; startedAt?: Date }
      ): Promise<NodeResult> => {
        const completedAt = new Date();
        const duration = extra.startedAt ? completedAt.getTime() - extra.startedAt.getTime() : 0;
        const finalResult = { ...result, duration };

        if (nodeRunId) {
          await prisma.nodeRun.update({
            where: { id: nodeRunId },
            data: {
              status: finalResult.status,
              inputs: (extra.inputs as object) ?? undefined,
              output: finalResult.outputs as object,
              error: finalResult.error ?? null,
              startedAt: extra.startedAt ?? completedAt,
              completedAt,
              duration,
            },
          });
        }
        publishNodeState(node.id, { status: finalResult.status, error: finalResult.error, duration });
        if (finalResult.status === "success") {
          outputsByNode.set(node.id, finalResult.outputs);
        }
        return finalResult;
      };

      // Wait for in-scope upstream nodes; out-of-scope deps already have cached outputs.
      const depResults = await Promise.all(
        incomingEdges
          .map((e) => nodePromises.get(e.source))
          .filter((p): p is Promise<NodeResult> => !!p)
      );

      const failedDep = depResults.find((r) => r.status !== "success");
      if (failedDep) {
        return finalize(
          { status: "skipped", outputs: {}, error: "Skipped: upstream node failed" },
          {}
        );
      }

      const inputs = resolveNodeInputs(node, incomingEdges, outputsByNode);
      const startedAt = new Date();

      if (nodeRunId) {
        await prisma.nodeRun.update({
          where: { id: nodeRunId },
          data: { status: "running", startedAt, inputs: inputs as object },
        });
      }
      publishNodeState(node.id, { status: "running" });
      logger.info("Node started", { nodeId: node.id, type: node.data.type });

      try {
        let outputs: NodeOutputs;

        switch (node.data.type) {
          case "request-inputs": {
            outputs = resolveRequestInputsOutputs(node);
            break;
          }
          case "response": {
            outputs = { result: inputs.result };
            break;
          }
          case "crop-image": {
            const handle = await tasks.trigger<typeof cropImageTask>("crop-image", {
              imageUrl: String(inputs.imageUrl ?? ""),
              x: Number(inputs.x),
              y: Number(inputs.y),
              w: Number(inputs.w),
              h: Number(inputs.h),
            });
            if (nodeRunId) {
              await prisma.nodeRun.update({
                where: { id: nodeRunId },
                data: { triggerRunId: handle.id },
              });
            }
            outputs = await waitForChildRun(handle.id);
            break;
          }
          case "gemini": {
            const handle = await tasks.trigger<typeof geminiLlmTask>("gemini-llm", {
              model: String(inputs.model),
              prompt: String(inputs.prompt ?? ""),
              systemPrompt: inputs.systemPrompt ? String(inputs.systemPrompt) : undefined,
              imageUrls: inputs.imageUrls as string[],
            });
            if (nodeRunId) {
              await prisma.nodeRun.update({
                where: { id: nodeRunId },
                data: { triggerRunId: handle.id },
              });
            }
            outputs = await waitForChildRun(handle.id);
            break;
          }
        }

        logger.info("Node finished", { nodeId: node.id });
        return await finalize({ status: "success", outputs }, { inputs, startedAt });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Node failed", { nodeId: node.id, error: message });
        return finalize({ status: "failed", outputs: {}, error: message }, { inputs, startedAt });
      }
    };

    // Kick off all in-scope nodes in topological order. Each node awaits only
    // its direct upstream dependencies, so independent branches run in
    // parallel and a finished node fans out immediately.
    for (const node of sortedNodes) {
      if (inScope.has(node.id)) {
        nodePromises.set(node.id, executeNode(node));
      }
    }

    const results = await Promise.all([...nodePromises.values()]);

    const successCount = results.filter((r) => r.status === "success").length;
    const finalStatus: "success" | "failed" | "partial" =
      successCount === results.length ? "success" : successCount === 0 ? "failed" : "partial";

    // Re-fetch workflow JSON to catch any structural changes made by the user
    // while this run was in flight. We then overlay our final execution states.
    // We only update nodes that were actually in our execution scope to avoid
    // overwriting other nodes that might have finished in parallel runs.
    const latestWorkflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    let updatedNodes: WorkflowNode[] | undefined = undefined;

    if (latestWorkflow) {
      const currentNodes = latestWorkflow.nodes as unknown as WorkflowNode[];
      
      // Create a lookup for results of nodes we actually executed
      const resultsByNodeId = new Map<string, NodeResult>();
      for (const [nodeId, promise] of nodePromises.entries()) {
        resultsByNodeId.set(nodeId, await promise);
      }

      updatedNodes = currentNodes.map((node) => {
        const result = resultsByNodeId.get(node.id);
        // Only touch nodes that were in our scope
        if (!result || !inScope.has(node.id)) return node;
        
        return {
          ...node,
          data: {
            ...node.data,
            status: result.status,
            output: result.status === "success" ? result.outputs : node.data.output,
            error: result.error,
            duration: result.duration,
          },
        };
      });
    }

    const completedAt = new Date();
    await Promise.all([
      prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          completedAt,
          duration: completedAt.getTime() - runRecord.startedAt.getTime(),
        },
      }),
      prisma.workflow.update({
        where: { id: workflowId },
        data: { 
          status: "idle", 
          ...(updatedNodes ? { nodes: updatedNodes as object[] } : {}) 
        },
      }),
    ]);

    logger.info("Executor finished", { runId, finalStatus });
    return { status: finalStatus };
  },
});
