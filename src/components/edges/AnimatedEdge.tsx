"use client";

import { useState } from "react";
import { getBezierPath, EdgeProps, EdgeLabelRenderer } from "@xyflow/react";
import { X } from "lucide-react";
import { DATA_TYPE_COLORS, HandleDataType } from "@/lib/constants";
import { useFlowStore } from "@/stores/flowStore";

export default function AnimatedEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  // Animate the edge if the source node is currently running
  const isSourceRunning = useFlowStore((s) => 
    s.nodes.find((n) => n.id === source)?.data.status === "running"
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Color-coded by the data type flowing through the edge (matches handles)
  const dataType = (data?.dataType as HandleDataType) || HandleDataType.TEXT;
  const colorConfig = DATA_TYPE_COLORS[dataType] ?? DATA_TYPE_COLORS[HandleDataType.TEXT];
  const strokeColor = colorConfig.hex;

  const handleDelete = () => {
    // Routed through onEdgesChange so the removal lands in undo history
    useFlowStore.getState().onEdgesChange([{ type: "remove", id }]);
  };

  const showDelete = hovered || selected;

  return (
    <>
      <path
        id={id}
        d={edgePath}
        markerEnd={markerEnd}
        className={`react-flow__edge-path ${isSourceRunning ? "nextflow-edge-animated" : ""}`}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: selected ? 3.5 : 2.5,
          fill: "none",
        }}
      />

      {/* Invisible wide path so the edge is easy to hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ pointerEvents: "stroke" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <EdgeLabelRenderer>
        {showDelete && (
          <button
            onClick={handleDelete}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="absolute w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md border-2 border-white transition-colors"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            title="Delete connection"
          >
            <X size={12} strokeWidth={3} />
          </button>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
