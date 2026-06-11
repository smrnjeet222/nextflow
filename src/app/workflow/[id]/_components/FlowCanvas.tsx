"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useFlowStore } from "@/stores/flowStore";
import RequestInputsNode from "@/components/nodes/RequestInputsNode";
import CropImageNode from "@/components/nodes/CropImageNode";
import GeminiNode from "@/components/nodes/GeminiNode";
import ResponseNode from "@/components/nodes/ResponseNode";
import AnimatedEdge from "@/components/edges/AnimatedEdge";
import BottomToolbar from "@/components/toolbar/BottomToolbar";

const nodeTypes: NodeTypes = {
  "request-inputs": RequestInputsNode,
  "crop-image": CropImageNode,
  gemini: GeminiNode,
  response: ResponseNode,
};

const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export default function FlowCanvas() {
  const {
    nodes,
    edges,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isConnectionValid,
    takeSnapshot,
    setViewport,
    undo,
    redo,
  } = useFlowStore();

  // Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or Ctrl+Y redo (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // defaultViewport applies the persisted camera once on mount; afterwards
  // onMoveEnd keeps the store (and autosave) in sync.
  const defaultViewport = useMemo<Viewport>(() => viewport, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full h-full relative overflow-hidden bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isConnectionValid}
        onNodeDragStop={() => takeSnapshot()}
        onMoveEnd={(_, vp) => setViewport(vp)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        fitView={!defaultViewport || (defaultViewport.x === 0 && defaultViewport.y === 0 && defaultViewport.zoom === 1)}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultMarkerColor="#9CA3AF"
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#e0e0e0" />
        <MiniMap
          style={{
            bottom: 24,
            right: 24,
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
          }}
          zoomable
          pannable
        />
        <BottomToolbar />
      </ReactFlow>
    </div>
  );
}
