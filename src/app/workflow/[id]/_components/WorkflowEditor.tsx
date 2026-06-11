"use client";

import { useState, useEffect, useRef } from "react";
import { ReactFlowProvider, Viewport } from "@xyflow/react";

import { useFlowStore } from "@/stores/flowStore";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { WorkflowRunDetail } from "@/types/execution";
import TopBar from "./TopBar";
import FlowCanvas from "./FlowCanvas";
import HistoryPanel from "./HistoryPanel";
import RealtimeRunMonitor from "./RealtimeRunMonitor";

interface WorkflowEditorProps {
  workflowId: string;
  initialName: string;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  initialViewport?: Viewport;
  initialRuns: WorkflowRunDetail[];
}

export default function WorkflowEditor({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  initialViewport,
  initialRuns,
}: WorkflowEditorProps) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const viewport = useFlowStore((s) => s.viewport);
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);

  const [workflowName, setWorkflowName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Run lifecycle lives entirely in the runStore FSM; this hook resumes an
  // in-flight run from the server snapshot and drives the run-detail poll.
  const { phase } = useWorkflowRun(workflowId, initialRuns);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate the store once from server-fetched data; the canvas mounts only
  // afterwards so it picks up the persisted viewport on its first render.
  const initialGraphRef = useRef({ initialNodes, initialEdges, initialViewport });
  useEffect(() => {
    const { initialNodes, initialEdges, initialViewport } = initialGraphRef.current;
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
  }, [workflowId, loadWorkflow]);

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

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
        {phase.name === "monitoring" && phase.token && phase.triggerRunId && (
          <RealtimeRunMonitor triggerRunId={phase.triggerRunId} accessToken={phase.token} />
        )}

        <div className="flex-1 flex overflow-hidden w-full relative">
          <div className="flex-1 relative">
            <TopBar
              workflowId={workflowId}
              name={workflowName}
              isSaving={isSaving}
              onRename={handleRenameWorkflow}
              onToggleHistory={() => setHistoryOpen((open) => !open)}
              isHistoryOpen={historyOpen}
            />
            {canvasReady ? <FlowCanvas /> : <div className="h-full w-full" />}
          </div>
          <HistoryPanel
            isOpen={historyOpen}
            onToggle={() => setHistoryOpen((open) => !open)}
            workflowId={workflowId}
            initialRuns={initialRuns}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
