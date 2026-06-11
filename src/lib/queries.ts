import { useMutation, useQuery } from "@tanstack/react-query";
import { Viewport } from "@xyflow/react";
import { getQueryClient } from "@/lib/query-client";
import { keys } from "@/lib/query-keys";
import { useRunStore } from "@/stores/runStore";
import { WorkflowRunDetail } from "@/types/execution";
import { WorkflowNodeInput, WorkflowEdgeInput } from "@/validators/workflow";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed with ${res.status}`);
  }
  return res.json();
}

/**
 * Runs list for the history panel. No interval: it is invalidated exactly
 * twice per run (on launch and on completion) plus the manual refresh button.
 */
export function useRunsQuery(workflowId: string, initialRuns: WorkflowRunDetail[]) {
  return useQuery({
    queryKey: keys.runs(workflowId),
    queryFn: () => fetchJson<WorkflowRunDetail[]>(`/api/runs?workflowId=${workflowId}`),
    initialData: initialRuns,
    staleTime: 15_000,
  });
}

/**
 * Active-run polling — the single writer of node outputs. Enabled and
 * interval derive from the FSM phase, so "the poll never started" is
 * unrepresentable; ingest is idempotent + ledger-guarded, so overlapping
 * refetches are harmless. refetchIntervalInBackground keeps a backgrounded
 * tab reconciling (setInterval would be throttled and realtime can drop).
 */
export function useRunDetailQuery() {
  const phase = useRunStore((s) => s.phase);
  const runId =
    phase.name === "monitoring" || phase.name === "finishing" ? phase.runId : null;
  const hasRealtime = phase.name === "monitoring" && phase.token !== null;

  return useQuery({
    queryKey: keys.runDetail(runId ?? "inactive"),
    queryFn: async () => {
      const run = await fetchJson<WorkflowRunDetail>(`/api/runs/${runId}`);
      useRunStore.getState().ingestRunDetail(run);
      // Mirror the fresh detail into the runs-list cache so the history
      // panel tracks the active run live instead of waiting for the
      // completion invalidation.
      getQueryClient().setQueryData<WorkflowRunDetail[]>(
        keys.runs(run.workflowId),
        (list) =>
          list &&
          (list.some((r) => r.id === run.id)
            ? list.map((r) => (r.id === run.id ? run : r))
            : [run, ...list])
      );
      return run;
    },
    enabled: runId !== null,
    refetchInterval: hasRealtime ? 4000 : 2000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export interface SaveWorkflowPayload {
  nodes: WorkflowNodeInput[];
  edges: WorkflowEdgeInput[];
  viewport: Viewport;
}

export function useSaveWorkflowMutation(workflowId: string) {
  return useMutation({
    mutationFn: (payload: SaveWorkflowPayload) =>
      fetchJson(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  });
}

export function useRenameWorkflowMutation(workflowId: string) {
  return useMutation({
    mutationFn: (name: string) =>
      fetchJson(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
  });
}
