import { z } from "zod";

/**
 * Shared Zod schemas — single source of truth for everything that crosses a
 * boundary (API routes, import/export, Trigger.dev payloads).
 */

export const NodeTypeSchema = z.enum([
  "request-inputs",
  "crop-image",
  "gemini",
  "response",
]);

export const NodeStatusSchema = z.enum([
  "idle",
  "pending",
  "running",
  "success",
  "failed",
  "skipped",
]);

export const RequestInputsFieldSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["text", "image"]),
  value: z.string().optional(),
});

export const CropConfigSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
});

export const GeminiConfigSchema = z.object({
  model: z.string().min(1),
  prompt: z.string(),
  systemPrompt: z.string().optional(),
});

// Loose: React Flow stores extra runtime props (selected, measured, dragging…)
// that must round-trip through save/load without being stripped.
export const NodeDataSchema = z
  .looseObject({
    label: z.string(),
    type: NodeTypeSchema,
    fields: z.array(RequestInputsFieldSchema).optional(),
    cropConfig: CropConfigSchema.optional(),
    geminiConfig: GeminiConfigSchema.optional(),
    status: NodeStatusSchema.optional(),
    error: z.string().optional(),
    duration: z.number().optional(),
    output: z.unknown().optional(),
  });

export const WorkflowNodeSchema = z.looseObject({
  id: z.string().min(1),
  type: NodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: NodeDataSchema,
});

export const WorkflowEdgeSchema = z.looseObject({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullish(),
  targetHandle: z.string().nullish(),
  animated: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nodes: z.array(WorkflowNodeSchema).optional(),
  edges: z.array(WorkflowEdgeSchema).optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  nodes: z.array(WorkflowNodeSchema).optional(),
  edges: z.array(WorkflowEdgeSchema).optional(),
  viewport: ViewportSchema.optional(),
});

export const ImportWorkflowSchema = z.object({
  name: z.string().min(1).max(120),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  viewport: ViewportSchema.optional(),
});

export const ExecuteRequestSchema = z
  .object({
    workflowId: z.string().min(1),
    scope: z.enum(["full", "partial", "single"]),
    nodeIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (v) => v.scope === "full" || (v.nodeIds && v.nodeIds.length > 0),
    { message: "nodeIds is required for partial/single scope" }
  );

export type WorkflowNodeInput = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdgeInput = z.infer<typeof WorkflowEdgeSchema>;

/**
 * Strips per-run runtime state (status, output, error, duration) from nodes.
 * Used on import so foreign JSON can't inject stale run results.
 */
export function stripRuntimeNodeState<T extends WorkflowNodeInput>(nodes: T[]): T[] {
  return nodes.map((node) => {
    const { status, error, duration, output, ...data } = node.data;
    void status; void error; void duration; void output;
    return { ...node, data, selected: false };
  });
}
