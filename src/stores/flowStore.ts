import { create } from "zustand";
import {
  Connection,
  NodeChange,
  EdgeChange,
  Viewport,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { WorkflowNode, WorkflowEdge, NodeData } from "@/types/workflow";
import { wouldCreateCycle } from "@/lib/dag";
import { isValidConnection } from "@/lib/connection-validator";
import { DEFAULT_GEMINI_MODEL } from "@/lib/constants";

/** Target handles that accept multiple incoming connections. */
const MULTI_CONNECTION_HANDLES = new Set(["imageUrls:image"]);

interface FlowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: Viewport;
  past: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[];
  future: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[];

  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  setViewport: (viewport: Viewport) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  isConnectionValid: (connection: Connection | WorkflowEdge) => boolean;

  addNode: (type: "crop-image" | "gemini", position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, updates: Partial<NodeData>) => void;

  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  loadWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[], viewport?: Viewport) => void;
}

const MAX_HISTORY_LIMIT = 50;

function isPreplaced(node: WorkflowNode | undefined): boolean {
  return node?.data.type === "request-inputs" || node?.data.type === "response";
}

// Snapshots capture only persistent graph state. Transient React Flow flags
// (selection, drag state, measured dimensions) are stripped so undo/redo
// never burns a history entry on a selection-only diff.
function cloneGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return {
    nodes: structuredClone(nodes).map((n) => {
      delete n.selected;
      delete n.dragging;
      delete n.measured;
      return n;
    }),
    edges: structuredClone(edges).map((e) => {
      delete e.selected;
      return e;
    }),
  };
}

type GraphSnapshot = ReturnType<typeof cloneGraph>;

function graphsEqual(a: GraphSnapshot, b: GraphSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  past: [],
  future: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setViewport: (viewport) => set({ viewport }),

  onNodesChange: (changes) => {
    const { nodes, takeSnapshot } = get();

    // Pre-placed nodes (Request-Inputs / Response) are permanent: block
    // keyboard/API removals, not just the menu action.
    const filtered = changes.filter((change) => {
      if (change.type !== "remove") return true;
      return !isPreplaced(nodes.find((n) => n.id === change.id));
    });

    if (filtered.some((c) => c.type === "remove")) {
      takeSnapshot();
      const removedIds = new Set(
        filtered.filter((c) => c.type === "remove").map((c) => c.id)
      );
      set({
        nodes: applyNodeChanges(filtered, nodes) as WorkflowNode[],
        edges: get().edges.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
        ),
      });
      return;
    }

    set({ nodes: applyNodeChanges(filtered, nodes) as WorkflowNode[] });
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === "remove")) {
      get().takeSnapshot();
    }
    set({ edges: applyEdgeChanges(changes, get().edges) as WorkflowEdge[] });
  },

  // Drag-time validation: React Flow calls this while the user drags a
  // connection, visually rejecting invalid targets (type mismatch / cycle).
  isConnectionValid: (connection) => {
    if (!isValidConnection(connection as Connection)) return false;
    if (!connection.source || !connection.target) return false;
    return !wouldCreateCycle(connection.source, connection.target, get().edges);
  },

  onConnect: (connection) => {
    const { edges, takeSnapshot, isConnectionValid } = get();
    if (!isConnectionValid(connection)) return;

    takeSnapshot();

    // Edge color derives from the source handle's data type
    const sourceHandleId = connection.sourceHandle;
    const parts = sourceHandleId?.split(":") || [];
    const dataType = parts[parts.length - 1] || "text";

    // Single-input handles replace their existing connection
    const targetHandle = connection.targetHandle ?? "";
    const keptEdges = MULTI_CONNECTION_HANDLES.has(targetHandle)
      ? edges
      : edges.filter(
          (e) => !(e.target === connection.target && e.targetHandle === connection.targetHandle)
        );

    const newEdge: WorkflowEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      animated: false,
      data: { dataType },
    };

    set({ edges: addEdge(newEdge, keptEdges) });
  },

  addNode: (type, position) => {
    const { nodes, takeSnapshot } = get();
    takeSnapshot();

    const id = `${type}-${Date.now()}`;
    const count = nodes.filter((n) => n.data.type === type).length + 1;

    const nodeData: NodeData =
      type === "crop-image"
        ? {
            label: `Crop Image #${count}`,
            type: "crop-image",
            cropConfig: { x: 0, y: 0, width: 100, height: 100 },
          }
        : {
            label: `Gemini 3.1 Pro${count > 1 ? ` #${count}` : ""}`,
            type: "gemini",
            geminiConfig: {
              model: DEFAULT_GEMINI_MODEL,
              prompt: "",
              systemPrompt: "",
            },
          };

    set({
      nodes: [...nodes, { id, type, position, data: nodeData }],
    });
  },

  deleteNode: (nodeId) => {
    const { nodes, edges, takeSnapshot } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || isPreplaced(node)) return;

    takeSnapshot();
    set({
      nodes: nodes.filter((n) => n.id !== nodeId),
      edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  updateNodeData: (nodeId, updates) => {
    // Called on every keystroke — no snapshot here. Callers snapshot on
    // meaningful boundaries (add/remove/connect/drag-stop).
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Skip no-op writes (realtime sync re-sends unchanged statuses)
    const changed = Object.entries(updates).some(
      ([key, value]) => node.data[key] !== value
    );
    if (!changed) return;

    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      ),
    });
  },

  takeSnapshot: () => {
    const { nodes, edges, past } = get();
    const snapshot = cloneGraph(nodes, edges);

    // Skip no-op snapshots (e.g. a drag that returned to its start position)
    const last = past[past.length - 1];
    if (last && graphsEqual(last, snapshot)) return;

    set({
      past: [...past.slice(-MAX_HISTORY_LIMIT + 1), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;

    const current = cloneGraph(nodes, edges);

    // Drop stale entries identical to the current graph so a single press
    // always produces a visible change (or empties the stack).
    let remaining = past;
    let previous: GraphSnapshot | null = null;
    while (remaining.length > 0) {
      const candidate = remaining[remaining.length - 1];
      remaining = remaining.slice(0, -1);
      if (!graphsEqual(candidate, current)) {
        previous = candidate;
        break;
      }
    }

    if (!previous) {
      set({ past: remaining });
      return;
    }

    set({
      past: remaining,
      future: [current, ...future],
      nodes: previous.nodes,
      edges: previous.edges,
    });
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;

    const current = cloneGraph(nodes, edges);

    let remaining = future;
    let next: GraphSnapshot | null = null;
    while (remaining.length > 0) {
      const candidate = remaining[0];
      remaining = remaining.slice(1);
      if (!graphsEqual(candidate, current)) {
        next = candidate;
        break;
      }
    }

    if (!next) {
      set({ future: remaining });
      return;
    }

    set({
      past: [...past, current],
      future: remaining,
      nodes: next.nodes,
      edges: next.edges,
    });
  },

  clearHistory: () => set({ past: [], future: [] }),

  loadWorkflow: (nodes, edges, viewport) => {
    set({
      nodes,
      edges,
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      past: [],
      future: [],
    });
  },
}));
