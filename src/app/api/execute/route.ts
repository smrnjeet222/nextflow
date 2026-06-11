import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { tasks } from "@trigger.dev/sdk";
import type { workflowExecutorTask } from "@/trigger/workflow-executor";
import { ExecuteRequestSchema } from "@/validators/workflow";
import { WorkflowNode } from "@/types/workflow";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ExecuteRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { workflowId, scope, nodeIds } = parsed.data;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    if (workflow.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const nodes = workflow.nodes as unknown as WorkflowNode[];

    // Scope semantics: full = every node, single/partial = exactly the targets.
    // NodeRun rows exist only for nodes that will actually execute.
    const inScopeNodes =
      scope === "full" ? nodes : nodes.filter((n) => nodeIds?.includes(n.id));

    if (inScopeNodes.length === 0) {
      return NextResponse.json({ error: "No matching nodes to execute" }, { status: 400 });
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.workflowRun.create({
        data: {
          workflowId,
          userId,
          status: "pending", // executor flips this to "running"
          scope,
          targetNodes: nodeIds ?? [],
        },
      });

      await tx.nodeRun.createMany({
        data: inScopeNodes.map((node) => ({
          runId: created.id,
          nodeId: node.id,
          nodeName: node.data.label || node.id,
          nodeType: node.data.type,
          status: "pending",
        })),
      });

      // Optimistically mark the workflow as running so the dashboard reflects it immediately
      await tx.workflow.update({
        where: { id: workflowId },
        data: { status: "running" },
      });

      return created;
    });

    const handle = await tasks.trigger<typeof workflowExecutorTask>("workflow-executor", {
      workflowId,
      runId: run.id,
      scope,
      targetNodeIds: nodeIds ?? [],
    });

    // Parent run id powers the realtime subscription + scoped public token
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { triggerRunId: handle.id },
    });

    return NextResponse.json(
      { runId: run.id, triggerRunId: handle.id, status: run.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/execute] POST Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
