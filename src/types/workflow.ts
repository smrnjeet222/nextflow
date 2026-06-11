import { Node as ReactFlowNode, Edge as ReactFlowEdge } from "@xyflow/react";

export interface RequestInputsField {
  id: string;
  name: string;
  type: "text" | "image";
  value?: string; // Holds manual text input or uploaded image URL
}

export interface CropImageConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeminiConfig {
  model: string;
  prompt: string;
  systemPrompt?: string;
}

export type NodeType = "request-inputs" | "crop-image" | "gemini" | "response";

export type NodeRunStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

/** Outputs keyed by output-handle field name, e.g. { response: "..." } */
export type NodeOutputs = Record<string, unknown>;

export type NodeData = {
  label: string;
  type: NodeType;

  // Node-specific configurations
  fields?: RequestInputsField[];
  cropConfig?: CropImageConfig;
  geminiConfig?: GeminiConfig;

  // Real-time run states
  status?: NodeRunStatus;
  error?: string;
  duration?: number;
  output?: NodeOutputs; // The calculated output of the node
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
};

export type WorkflowNode = ReactFlowNode<NodeData>;
export type WorkflowEdge = ReactFlowEdge;

export interface WorkflowStateJSON {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}
