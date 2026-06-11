"use client";

import { useState, useEffect, useRef, use, Suspense } from "react";
import { ReactFlowProvider, Viewport } from "@xyflow/react";

import { useFlowStore } from "@/stores/flowStore";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import { useAutosave } from "@/hooks/useAutosave";
import { useUrlFlag } from "@/hooks/useUrlState";
import { useRenameWorkflowMutation } from "@/lib/queries";
import { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { WorkflowRunDetail } from "@/types/execution";
import TopBar from "./TopBar";
import FlowCanvas from "./FlowCanvas";
import HistoryPanel from "./HistoryPanel";
import HistoryPanelSkeleton from "./HistoryPanelSkeleton";
import RealtimeRunMonitor from "./RealtimeRunMonitor";

interface WorkflowEditorProps {
  workflowId: string;
  initialName: string;
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  initialViewport?: Viewport;
  initialRunsPromise: Promise<WorkflowRunDetail[]>;
}

/**
 * Everything that depends on the run history lives behind this component:
 * `use()` suspends until the server finishes streaming the runs, while the
 * canvas and top bar above stay interactive the whole time.
 */
function RunLayer({
  workflowId,
  initialRunsPromise,
  isOpen,
  onToggle,
}: {
  workflowId: string;
  initialRunsPromise: Promise<WorkflowRunDetail[]>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const initialRuns = use(initialRunsPromise);

  // Run lifecycle lives entirely in the runStore FSM; this hook resumes an
  // in-flight run from the server snapshot and drives the run-detail poll.
  const { phase } = useWorkflowRun(workflowId, initialRuns);

  return (
    <>
      {phase.name === "monitoring" && phase.token && phase.triggerRunId && (
        <RealtimeRunMonitor triggerRunId={phase.triggerRunId} accessToken={phase.token} />
      )}
      <HistoryPanel
        isOpen={isOpen}
        onToggle={onToggle}
        workflowId={workflowId}
        initialRuns={initialRuns}
      />
    </>
  );
}

export default function WorkflowEditor({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
  initialViewport,
  initialRunsPromise,
}: WorkflowEditorProps) {
  const loadWorkflow = useFlowStore((s) => s.loadWorkflow);

  const [workflowName, setWorkflowName] = useState(initialName);
  const [canvasReady, setCanvasReady] = useState(false);

  // Panel visibility lives in the URL (?hide-runs=true) so it survives
  // reloads and can be shared; missing param means open.
  const [runsHidden, setRunsHidden] = useUrlFlag("hide-runs");
  const historyOpen = !runsHidden;

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

  const toggleHistory = () => setRunsHidden(!runsHidden);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50">
        <div className="flex-1 flex overflow-hidden w-full relative">
          <div className="flex-1 relative">
            <TopBar
              workflowId={workflowId}
              name={workflowName}
              isSaving={isSaving}
              onRename={handleRenameWorkflow}
              onToggleHistory={toggleHistory}
              isHistoryOpen={historyOpen}
            />
            {canvasReady ? <FlowCanvas /> : <div className="h-full w-full" />}
          </div>
          <Suspense
            fallback={<HistoryPanelSkeleton isOpen={historyOpen} onToggle={toggleHistory} />}
          >
            <RunLayer
              workflowId={workflowId}
              initialRunsPromise={initialRunsPromise}
              isOpen={historyOpen}
              onToggle={toggleHistory}
            />
          </Suspense>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
