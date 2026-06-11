/**
 * Query key factory — its own module so both the query hooks and the run
 * store can import it without a circular dependency.
 */
export const keys = {
  runs: (workflowId: string) => ["runs", workflowId] as const,
  runDetail: (runId: string) => ["run-detail", runId] as const,
};
