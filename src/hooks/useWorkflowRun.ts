"use client";

import { useEffect, useRef } from "react";
import { useRunStore } from "@/stores/runStore";
import { useRunDetailQuery } from "@/lib/queries";
import { WorkflowRunDetail } from "@/types/execution";

/**
 * Wires the run FSM into the editor: binds the runStore to this workflow,
 * re-attaches to a run that was in flight when the page (re)loaded, and
 * mounts the phase-driven run-detail polling query. A stale snapshot
 * self-heals: the first poll ingests the terminal run and the FSM winds
 * down to idle with outputs painted by that same ingest.
 */
export function useWorkflowRun(workflowId: string, initialRuns: WorkflowRunDetail[]) {
  const phase = useRunStore((s) => s.phase);

  // The snapshot is only meaningful at mount; a ref keeps the effect's
  // dependency list honest without re-running on prop identity changes.
  const initialRunsRef = useRef(initialRuns);

  useEffect(() => {
    const store = useRunStore.getState();
    store.init(workflowId);

    const latest = initialRunsRef.current[0];
    if (latest && ["pending", "running"].includes(latest.status)) {
      store.resume(latest);
    }
  }, [workflowId]);

  useRunDetailQuery();

  return { phase };
}
