import prisma from "@/lib/prisma";

/**
 * Self-healing for stuck runs: if a run has reported pending/running for too
 * long (executor crashed without its onFailure hook firing, deploy rollover,
 * etc.) the next read marks it failed — in the DB and in the returned row —
 * so polling clients never hang on "Running…" forever.
 */
const STALE_AFTER_MS = 15 * 60 * 1000;
const ACTIVE_STATUSES = ["pending", "running"];
const STALE_ERROR = "Run timed out: no progress for 15 minutes";

interface ReapableNodeRun {
  status: string;
  error: string | null;
  completedAt: Date | null;
}

interface ReapableRun {
  id: string;
  workflowId: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  nodeRuns: ReapableNodeRun[];
}

function isStale(run: ReapableRun): boolean {
  return (
    ACTIVE_STATUSES.includes(run.status) &&
    Date.now() - new Date(run.startedAt).getTime() > STALE_AFTER_MS
  );
}

/** Returns the run unchanged when healthy, or the corrected row after reaping. */
export async function reapIfStale<T extends ReapableRun>(run: T): Promise<T> {
  if (!isStale(run)) return run;

  const completedAt = new Date();
  const duration = completedAt.getTime() - new Date(run.startedAt).getTime();

  await prisma.$transaction([
    prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", completedAt, duration },
    }),
    prisma.nodeRun.updateMany({
      where: { runId: run.id, status: { in: ACTIVE_STATUSES } },
      data: { status: "failed", error: STALE_ERROR, completedAt },
    }),
    prisma.workflow.update({
      where: { id: run.workflowId },
      data: { status: "idle" },
    }),
  ]);

  return {
    ...run,
    status: "failed",
    completedAt,
    duration,
    nodeRuns: run.nodeRuns.map((nr) =>
      ACTIVE_STATUSES.includes(nr.status)
        ? { ...nr, status: "failed", error: STALE_ERROR, completedAt }
        : nr
    ),
  };
}
