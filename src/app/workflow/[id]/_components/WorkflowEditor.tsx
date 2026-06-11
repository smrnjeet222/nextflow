"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ReactFlowProvider, Viewport } from "@xyflow/react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

import { useFlowStore } from "@/stores/flowStore";
import { WorkflowNode, WorkflowEdge, NodeRunStatus } from "@/types/workflow";
import { WorkflowRunDetail } from "@/types/execution";
import TopBar from "./TopBar";
import FlowCanvas from "./FlowCanvas";
import HistoryPanel from "./HistoryPanel";

type RunScope = "full" | "partial" | "single";

interface WorkflowEditorProps {
  workflowId: string;
  initialName: string;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  initialViewport?: Viewport;
  initialRuns: WorkflowRunDetail[];
}

interface NodeMetadataState {
  status: NodeRunStatus;
  error?: string;
  duration?: number;
}

/**
 * Subscribes to the parent executor run on Trigger.dev. Per-node progress
 * arrives through run metadata ("node:<id>" entries); node outputs are pulled
 * from the DB whenever a node reaches a terminal state.
 */
function RealtimeRunMonitor({
  triggerRunId,
  accessToken,
  onNodeStates,
  onComplete,
}: {
  triggerRunId: string;
  accessToken: string;
  onNodeStates: (states: Record<string, NodeMetadataState>, anyNewTerminal: boolean) => void;
  onComplete: () => void;
}) {
  const { run, error } = useRealtimeRun(triggerRunId, { accessToken });
  const seenTerminal = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!run) return;

    const states: Record<string, NodeMetadataState> = {};
    let anyNewTerminal = false;

    for (const [key, value] of Object.entries(run.metadata ?? {})) {
      if (!key.startsWith("node:") || !value || typeof value !== "object") continue;
      const nodeId = key.slice("node:".length);
      const state = value as unknown as NodeMetadataState;
      states[nodeId] = state;

      const isTerminal = ["success", "failed", "skipped"].includes(state.status);
      if (isTerminal && !seenTerminal.current.has(nodeId)) {
        seenTerminal.current.add(nodeId);
        anyNewTerminal = true;
      }
    }

    onNodeStates(states, anyNewTerminal);

    if (["COMPLETED", "FAILED", "CANCELED", "CRASHED", "TIMED_OUT", "SYSTEM_FAILURE"].includes(run.status)) {
      onComplete();
    }
  }, [run, onNodeStates, onComplete]);

  useEffect(() => {
    if (error) console.error("[RealtimeRunMonitor] error:", error);
  }, [error]);

  return null;
}

export default function WorkflowEditor({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  initialViewport,
  initialRuns,
}: WorkflowEditorProps) {
  // Narrow selectors: subscribing to the whole store would re-render (and
  // re-fire effects) on every internal change, including our own
  // setRunNodeHandler write — that's what caused the max-update-depth loop.
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const viewport = useFlowStore((s) => s.viewport);
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const setRunNodeHandler = useFlowStore((s) => s.setRunNodeHandler);
  const isExecuting = useFlowStore((s) => s.isExecuting);

  const [workflowName, setWorkflowName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [runs, setRuns] = useState<WorkflowRunDetail[]>(initialRuns);
  const [isRefreshingRuns, setIsRefreshingRuns] = useState(false);
  const [activeRun, setActiveRun] = useState<{
    runId: string;
    triggerRunId: string;
    token: string | null;
  } | null>(() => {
    // Resume tracking if the page (re)loads while a run is still in flight
    const latest = initialRuns[0] as
      | (WorkflowRunDetail & { triggerRunId?: string | null })
      | undefined;
    if (!latest || !["pending", "running"].includes(latest.status)) return null;
    return { runId: latest.id, triggerRunId: latest.triggerRunId ?? "", token: null };
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackPollRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate the store once from server-fetched data; the canvas mounts only
  // afterwards so it picks up the persisted viewport on its first render.
  useEffect(() => {
    loadWorkflow(initialNodes, initialEdges, initialViewport);
    const raf = requestAnimationFrame(() => setCanvasReady(true));
    // Allow autosave only after hydration has rendered
    const t = setTimeout(() => {
      hydratedRef.current = true;
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // Debounced autosave of graph + viewport
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodes, edges, viewport }),
        });
      } catch (err) {
        console.error("Failed to auto-save workflow:", err);
      } finally {
        setIsSaving(false);
      }
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, viewport, workflowId]);

  const handleRenameWorkflow = async (newName: string) => {
    setWorkflowName(newName);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
    } catch (err) {
      console.error("Failed to rename workflow:", err);
    }
  };

  const refreshRunsList = useCallback(async () => {
    setIsRefreshingRuns(true);
    try {
      const res = await fetch(`/api/runs?workflowId=${workflowId}`);
      if (res.ok) setRuns(await res.json());
    } catch (err) {
      console.error("Failed to refresh runs list:", err);
    } finally {
      setIsRefreshingRuns(false);
    }
  }, [workflowId]);

  /** Pull node inputs/outputs/statuses for a run from the DB into the canvas. */
  const syncRunFromDb = useCallback(
    async (runId: string) => {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) return null;
        const run: WorkflowRunDetail = await res.json();
        for (const nodeRun of run.nodeRuns) {
          updateNodeData(nodeRun.nodeId, {
            status: nodeRun.status,
            output: (nodeRun.output as Record<string, unknown>) ?? undefined,
            error: nodeRun.error ?? undefined,
            duration: nodeRun.duration ?? undefined,
          });
        }
        return run;
      } catch (err) {
        console.error("[syncRunFromDb] Error:", err);
        return null;
      }
    },
    [updateNodeData]
  );

  const stopFallbackPolling = useCallback(() => {
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    }
  }, []);

  const finishRun = useCallback(
    async (runId: string) => {
      stopFallbackPolling();
      await syncRunFromDb(runId);
      await refreshRunsList();
      setActiveRun(null);
      useFlowStore.getState().setIsExecuting(false);
    },
    [stopFallbackPolling, syncRunFromDb, refreshRunsList]
  );

  useEffect(() => () => stopFallbackPolling(), [stopFallbackPolling]);

  // If a run was resumed from the server snapshot (state initializer above),
  // start its completion poll and flip the global executing flag.
  useEffect(() => {
    if (!activeRun || fallbackPollRef.current) return;

    useFlowStore.getState().setIsExecuting(true);
    const runId = activeRun.runId;
    fallbackPollRef.current = setInterval(async () => {
      const run = await syncRunFromDb(runId);
      if (run && ["success", "failed", "partial"].includes(run.status)) {
        finishRun(runId);
      }
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunWorkflow = useCallback(
    async (scope: RunScope, nodeIds?: string[]) => {
      // Synchronous double-click guard: zustand getState() reflects the flag
      // immediately, unlike React state.
      if (useFlowStore.getState().isExecuting || activeRun) return;

      // Optimistic UI before any network round-trip: disable every Run
      // button and mark the target nodes as queued.
      useFlowStore.getState().setIsExecuting(true);
      const targetSet = new Set(nodeIds ?? []);
      for (const node of nodes) {
        if (scope === "full" || targetSet.has(node.id)) {
          updateNodeData(node.id, {
            status: "pending",
            output: undefined,
            error: undefined,
            duration: undefined,
          });
        }
      }

      const rollback = () => {
        for (const node of nodes) {
          if (scope === "full" || targetSet.has(node.id)) {
            updateNodeData(node.id, { status: "idle" });
          }
        }
        useFlowStore.getState().setIsExecuting(false);
      };

      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, scope, nodeIds }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("Execution failed:", errData);
          rollback();
          return;
        }

        const { runId, triggerRunId } = await res.json();
        refreshRunsList();

        // Realtime token; if minting fails fall back to 2s DB polling
        let token: string | null = null;
        try {
          const tokenRes = await fetch(`/api/trigger-token?runId=${runId}`);
          if (tokenRes.ok) token = (await tokenRes.json()).token;
        } catch {
          /* fall through to polling */
        }

        setActiveRun({ runId, triggerRunId, token });

        // Completion safety net: realtime delivers fast node updates, but if
        // its final event is missed (dropped stream, backgrounded tab) the UI
        // would hang on "Running…" forever. The DB is the source of truth.
        fallbackPollRef.current = setInterval(
          async () => {
            const run = await syncRunFromDb(runId);
            if (run && ["success", "failed", "partial"].includes(run.status)) {
              finishRun(runId);
            }
          },
          token ? 4000 : 2000
        );
      } catch (err) {
        console.error("Execution failed:", err);
        rollback();
      }
    },
    [activeRun, nodes, workflowId, updateNodeData, refreshRunsList, syncRunFromDb, finishRun]
  );

  // Let node components trigger single-node runs via their header Run button.
  // Registered exactly once; the ref always points at the latest handler so
  // we never re-write the store (which would re-render and loop).
  const runWorkflowRef = useRef(handleRunWorkflow);
  useEffect(() => {
    runWorkflowRef.current = handleRunWorkflow;
  }, [handleRunWorkflow]);

  useEffect(() => {
    setRunNodeHandler((nodeId: string) => runWorkflowRef.current("single", [nodeId]));
    return () => setRunNodeHandler(null);
  }, [setRunNodeHandler]);

  const handleRealtimeNodeStates = useCallback(
    (states: Record<string, NodeMetadataState>, anyNewTerminal: boolean) => {
      for (const [nodeId, state] of Object.entries(states)) {
        updateNodeData(nodeId, {
          status: state.status,
          error: state.error,
          duration: state.duration,
        });
      }
      // Outputs live in the DB; fetch them as soon as any node finishes
      if (anyNewTerminal && activeRun) {
        syncRunFromDb(activeRun.runId);
      }
    },
    [updateNodeData, activeRun, syncRunFromDb]
  );

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
        {activeRun?.token && (
          <RealtimeRunMonitor
            triggerRunId={activeRun.triggerRunId}
            accessToken={activeRun.token}
            onNodeStates={handleRealtimeNodeStates}
            onComplete={() => finishRun(activeRun.runId)}
          />
        )}

        <div className="flex-1 flex overflow-hidden w-full relative">
          <div className="flex-1 relative">
            <TopBar
              workflowId={workflowId}
              name={workflowName}
              isSaving={isSaving}
              onRename={handleRenameWorkflow}
              onRun={handleRunWorkflow}
              isExecuting={isExecuting}
              onToggleHistory={() => setHistoryOpen((open) => !open)}
              isHistoryOpen={historyOpen}
            />
            {canvasReady ? <FlowCanvas /> : <div className="h-full w-full" />}
          </div>
          <HistoryPanel
            isOpen={historyOpen}
            onToggle={() => setHistoryOpen((open) => !open)}
            activeRunId={activeRun?.runId ?? null}
            runs={runs}
            onRefresh={refreshRunsList}
            isRefreshing={isRefreshingRuns}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
