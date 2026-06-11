"use client";

import { useState, useEffect, useRef } from "react";
import { ReactFlowProvider, Viewport } from "@xyflow/react";

import { useFlowStore } from "@/stores/flowStore";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import { useAutosave } from "@/hooks/useAutosave";
import { useRenameWorkflowMutation } from "@/lib/queries";
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
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);

  const [workflowName, setWorkflowName] = useState(initialName);
  const [canvasReady, setCanvasReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  // Run lifecycle lives entirely in the runStore FSM; this hook resumes an
  // in-flight run from the server snapshot and drives the run-detail poll.
  const { phase } = useWorkflowRun(workflowId, initialRuns);
  const isSaving = useAutosave(workflowId);
  const renameMutation = useRenameWorkflowMutation(workflowId);

  // Hydrate the store once from server-fetched data; the canvas mounts only
  // afterwards so it picks up the persisted viewport on its first render.
  const initialGraphRef = useRef({ initialNodes, initialEdges, initialViewport });
  useEffect(() => {
    const { initialNodes, initialEdges, initialViewport } = initialGraphRef.current;
    loadWorkflow(initialNodes, initialEdges, initialViewport);
    const raf = requestAnimationFrame(() => setCanvasReady(true));
    return () => cancelAnimationFrame(raf);
  }, [workflowId, loadWorkflow]);

  const handleRenameWorkflow = (newName: string) => {
    setWorkflowName(newName);
    renameMutation.mutate(newName, {
      onError: (err) => console.error("Failed to rename workflow:", err),
    });
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
