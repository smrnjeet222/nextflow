export interface NodeRunDetail {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  inputs?: unknown;
  output?: unknown;
  error?: string | null;
  duration?: number | null;
  triggerRunId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface WorkflowRunDetail {
  id: string;
  workflowId: string;
  userId: string;
  status: "pending" | "running" | "success" | "failed" | "partial";
  scope: "full" | "partial" | "single";
  targetNodes?: unknown;
  triggerRunId?: string | null;
  duration?: number | null;
  startedAt: string;
  completedAt?: string | null;
  nodeRuns: NodeRunDetail[];
}
