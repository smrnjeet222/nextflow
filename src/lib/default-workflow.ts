import { WorkflowNode, WorkflowEdge } from "@/types/workflow";

/**
 * Every new canvas opens with Request-Inputs and Response pre-placed.
 * These two nodes are permanent: they cannot be deleted.
 */
export function getDefaultWorkflowNodes(): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return {
    nodes: [
      {
        id: "request-inputs",
        type: "request-inputs",
        position: { x: 80, y: 160 },
        deletable: false,
        data: {
          label: "Request-Inputs",
          type: "request-inputs",
          fields: [],
        },
      },
      {
        id: "response",
        type: "response",
        position: { x: 760, y: 160 },
        deletable: false,
        data: {
          label: "Response",
          type: "response",
        },
      },
    ],
    edges: [],
  };
}
