"use client";

import { useEffect } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useRunStore, RealtimeNodeState } from "@/stores/runStore";

/**
 * Subscribes to the parent executor run on Trigger.dev. Per-node progress
 * arrives through run metadata ("node:<id>" entries) as status hints only —
 * outputs always come from the DB via the run-detail query. All writes go
 * through the runStore ledger, never straight to the canvas.
 */
export default function RealtimeRunMonitor({
  triggerRunId,
  accessToken,
}: {
  triggerRunId: string;
  accessToken: string;
}) {
  const { run, error } = useRealtimeRun(triggerRunId, { accessToken });

  useEffect(() => {
    if (!run) return;

    const states: Record<string, RealtimeNodeState> = {};
    for (const [key, value] of Object.entries(run.metadata ?? {})) {
      if (!key.startsWith("node:") || !value || typeof value !== "object") continue;
      states[key.slice("node:".length)] = value as unknown as RealtimeNodeState;
    }

    useRunStore.getState().applyRealtimeStates(states, run.status);
  }, [run]);

  useEffect(() => {
    if (error) console.error("[RealtimeRunMonitor] error:", error);
  }, [error]);

  return null;
}
