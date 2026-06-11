import { create } from "zustand";
import { useFlowStore } from "@/stores/flowStore";
import { getQueryClient } from "@/lib/query-client";
import { keys } from "@/lib/query-keys";
import { NodeRunStatus } from "@/types/workflow";
import { WorkflowRunDetail } from "@/types/execution";

/**
 * Run-lifecycle state machine. The phase is a discriminated union, so
 * impossible states (a token without a run, polling without a runId) are
 * unrepresentable; illegal transitions are ignored and warned.
 *
 * Node runtime state is still rendered from flowStore node.data, but every
 * write funnels through applyNodeUpdate() and its monotonic status ledger —
 * a node's painted status can never go backwards within a run, which is what
 * used to happen when the realtime stream and the DB poll raced each other.
 */

export type RunScope = "full" | "partial" | "single";

export type RunPhase =
  | { name: "idle" }
  | { name: "launching"; scope: RunScope; targetIds: string[] | null }
  | { name: "monitoring"; runId: string; triggerRunId: string; token: string | null; resumed: boolean }
  | { name: "finishing"; runId: string };

type RunEvent =
  | { type: "START"; scope: RunScope; targetIds: string[] | null }
  | { type: "LAUNCHED"; runId: string; triggerRunId: string }
  | { type: "LAUNCH_FAILED" }
  | { type: "TOKEN_MINTED"; token: string; triggerRunId?: string }
  | { type: "RESUME"; runId: string; triggerRunId: string }
  | { type: "RUN_COMPLETED"; runId: string }
  | { type: "FINISHED" };

function transition(phase: RunPhase, event: RunEvent): RunPhase | null {
  switch (event.type) {
    case "START":
      // Ignored from any non-idle phase — this IS the double-click guard.
      return phase.name === "idle"
        ? { name: "launching", scope: event.scope, targetIds: event.targetIds }
        : null;
    case "LAUNCHED":
      return phase.name === "launching"
        ? { name: "monitoring", runId: event.runId, triggerRunId: event.triggerRunId, token: null, resumed: false }
        : null;
    case "LAUNCH_FAILED":
      return phase.name === "launching" ? { name: "idle" } : null;
    case "TOKEN_MINTED":
      return phase.name === "monitoring"
        ? { ...phase, token: event.token, triggerRunId: event.triggerRunId || phase.triggerRunId }
        : null;
    case "RESUME":
      return phase.name === "idle"
        ? { name: "monitoring", runId: event.runId, triggerRunId: event.triggerRunId, token: null, resumed: true }
        : null;
    case "RUN_COMPLETED":
      // Idempotent: fired by the DB poll OR the realtime stream; whichever
      // loses the race finds the phase already past monitoring and no-ops.
      return phase.name === "monitoring" && phase.runId === event.runId
        ? { name: "finishing", runId: event.runId }
        : null;
    case "FINISHED":
      return phase.name === "finishing" ? { name: "idle" } : null;
  }
}

/** Status hint published through Trigger.dev run metadata (no outputs). */
export interface RealtimeNodeState {
  status: NodeRunStatus;
  error?: string;
  duration?: number;
}

export type NodeUpdateSource = "optimistic" | "realtime" | "db";

interface NodeRuntimeUpdate {
  status: NodeRunStatus;
  output?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

const RANK: Record<NodeRunStatus, number> = {
  idle: 0,
  pending: 1,
  running: 2,
  success: 3,
  failed: 3,
  skipped: 3,
};
const TERMINAL_RANK = 3;

const TERMINAL_RUN_STATUSES = new Set(["success", "failed", "partial"]);
const TERMINAL_TRIGGER_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "CRASHED",
  "TIMED_OUT",
  "SYSTEM_FAILURE",
]);

// Monotonic per-run status ledger (nodeId -> highest painted rank). Not
// rendered, so it lives outside the reactive state. Reset at START/RESUME.
let ledger = new Map<string, number>();

interface RunState {
  workflowId: string | null;
  phase: RunPhase;

  /** Bind the store to the workflow the editor is showing. */
  init: (workflowId: string) => void;
  /** Launch a run; ignored while another run is active. */
  startRun: (scope: RunScope, nodeIds?: string[]) => Promise<void>;
  /** Re-attach to a run that was in flight when the page (re)loaded. */
  resume: (run: WorkflowRunDetail) => void;
  /** Final reconcile + runs-list refresh; safe to call from racing sources. */
  runCompleted: (runId: string) => Promise<void>;
  /** Sole gateway for node runtime writes (ledger-guarded). */
  applyNodeUpdate: (nodeId: string, update: NodeRuntimeUpdate, source: NodeUpdateSource) => void;
  /** DB run detail -> canvas. The only writer of node outputs. */
  ingestRunDetail: (run: WorkflowRunDetail) => void;
  /** Realtime metadata -> status hints + completion/refetch nudges. */
  applyRealtimeStates: (states: Record<string, RealtimeNodeState>, triggerRunStatus: string) => void;
}

export const useRunStore = create<RunState>((set, get) => {
  const dispatch = (event: RunEvent): boolean => {
    const next = transition(get().phase, event);
    if (!next) {
      console.warn(`[runStore] ignored ${event.type} in phase "${get().phase.name}"`);
      return false;
    }
    set({ phase: next });
    return true;
  };

  const mintToken = async (runId: string) => {
    try {
      const res = await fetch(`/api/trigger-token?runId=${runId}`);
      if (!res.ok) return; // non-event: keep polling at 2s
      const { token, triggerRunId } = await res.json();
      dispatch({ type: "TOKEN_MINTED", token, triggerRunId });
    } catch {
      /* poll-only fallback */
    }
  };

  return {
    workflowId: null,
    phase: { name: "idle" },

    init: (workflowId) => {
      ledger = new Map();
      set({ workflowId, phase: { name: "idle" } });
    },

    applyNodeUpdate: (nodeId, update, source) => {
      const rank = RANK[update.status] ?? 0;
      const current = ledger.get(nodeId);
      if (current !== undefined) {
        if (rank < current) return; // never downgrade within a run
        if (rank === current && rank === TERMINAL_RANK && source !== "db") return; // DB wins terminal ties
      } else if (source !== "db") {
        // Node outside the active run's scope: only the DB may paint it
        // (e.g. results of a finished run after reload).
        return;
      }
      ledger.set(nodeId, rank);
      useFlowStore.getState().updateNodeData(nodeId, { ...update });
    },

    startRun: async (scope, nodeIds) => {
      const targetIds = nodeIds ?? null;
      if (!dispatch({ type: "START", scope, targetIds })) return;

      const { workflowId, applyNodeUpdate } = get();
      if (!workflowId) {
        dispatch({ type: "LAUNCH_FAILED" });
        return;
      }

      // Optimistic UI before any network round-trip: every Run button
      // disables (phase != idle) and target nodes show as queued.
      ledger = new Map();
      const targetSet = new Set(targetIds ?? []);
      const inScope = useFlowStore
        .getState()
        .nodes.filter((n) => scope === "full" || targetSet.has(n.id));
      for (const node of inScope) ledger.set(node.id, 0);
      for (const node of inScope) {
        applyNodeUpdate(
          node.id,
          { status: "pending", output: undefined, error: undefined, duration: undefined },
          "optimistic"
        );
      }

      const rollback = () => {
        // Deliberately bypasses the ledger: rollback is the one legal downgrade.
        for (const node of inScope) {
          useFlowStore.getState().updateNodeData(node.id, { status: "idle" });
        }
        ledger = new Map();
        dispatch({ type: "LAUNCH_FAILED" });
      };

      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, scope, nodeIds }),
        });
        if (!res.ok) {
          console.error("[runStore] execution failed:", await res.json().catch(() => ({})));
          rollback();
          return;
        }

        const { runId, triggerRunId } = await res.json();
        dispatch({ type: "LAUNCHED", runId, triggerRunId });
        getQueryClient().invalidateQueries({ queryKey: keys.runs(workflowId) });

        await mintToken(runId);
      } catch (err) {
        console.error("[runStore] execution failed:", err);
        rollback();
      }
    },

    resume: (run) => {
      if (!dispatch({ type: "RESUME", runId: run.id, triggerRunId: run.triggerRunId ?? "" })) return;

      // Seed the ledger from the snapshot so already-terminal nodes are
      // rank-locked against stale realtime replays, and paint what we know.
      ledger = new Map();
      for (const nodeRun of run.nodeRuns) ledger.set(nodeRun.nodeId, 0);
      get().ingestRunDetail(run);

      void mintToken(run.id);
    },

    runCompleted: async (runId) => {
      if (!dispatch({ type: "RUN_COMPLETED", runId })) return;

      const { workflowId, ingestRunDetail } = get();
      try {
        // Final reconcile straight from the DB — covers the realtime-first
        // path where the completion event beats the last poll.
        const res = await fetch(`/api/runs/${runId}`);
        if (res.ok) {
          const run: WorkflowRunDetail = await res.json();
          ingestRunDetail(run);
          getQueryClient().setQueryData(keys.runDetail(runId), run);
        }
      } catch (err) {
        console.error("[runStore] final reconcile failed:", err);
        // Still go idle — never strand the UI on "Running…".
      }
      if (workflowId) {
        getQueryClient().invalidateQueries({ queryKey: keys.runs(workflowId) });
      }
      dispatch({ type: "FINISHED" });
    },

    ingestRunDetail: (run) => {
      const { applyNodeUpdate } = get();
      for (const nodeRun of run.nodeRuns) {
        applyNodeUpdate(
          nodeRun.nodeId,
          {
            status: nodeRun.status,
            output: (nodeRun.output as Record<string, unknown>) ?? undefined,
            error: nodeRun.error ?? undefined,
            duration: nodeRun.duration ?? undefined,
          },
          "db"
        );
      }
      // Trigger completion only while monitoring this exact run — the
      // reconcile fetch inside runCompleted re-ingests the same terminal
      // run during "finishing" and must not re-dispatch.
      const { phase } = get();
      if (
        TERMINAL_RUN_STATUSES.has(run.status) &&
        phase.name === "monitoring" &&
        phase.runId === run.id
      ) {
        void get().runCompleted(run.id);
      }
    },

    applyRealtimeStates: (states, triggerRunStatus) => {
      const { phase, applyNodeUpdate } = get();
      if (phase.name !== "monitoring") return;

      let anyNewTerminal = false;
      for (const [nodeId, state] of Object.entries(states)) {
        const wasTerminal = (ledger.get(nodeId) ?? 0) >= TERMINAL_RANK;
        applyNodeUpdate(
          nodeId,
          { status: state.status, error: state.error, duration: state.duration },
          "realtime"
        );
        if (!wasTerminal && (ledger.get(nodeId) ?? 0) >= TERMINAL_RANK) {
          anyNewTerminal = true;
        }
      }

      // Outputs live in the DB; nudge the run-detail poll instead of waiting
      // out its interval. Coalesced per realtime batch, not per node.
      if (anyNewTerminal) {
        getQueryClient().invalidateQueries({ queryKey: keys.runDetail(phase.runId) });
      }

      if (TERMINAL_TRIGGER_STATUSES.has(triggerRunStatus)) {
        void get().runCompleted(phase.runId);
      }
    },
  };
});

/** Derived "a run is active" flag — replaces flowStore.isExecuting. */
export const selectIsRunActive = (s: RunState) => s.phase.name !== "idle";
