"use client";

import { useState } from "react";
import { Position } from "@xyflow/react";
import { Scissors, ExternalLink, Image as ImageIcon } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import { HandleDataType } from "@/lib/constants";
import { NodeData } from "@/types/workflow";

/**
 * Number input that lets the user freely clear/retype while focused (a local
 * draft string), and only parses + clamps back to a valid number on blur.
 * Empty or invalid drafts revert to the last committed value.
 */
function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) {
      onCommit(Math.min(max, Math.max(min, parsed)));
    }
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={disabled}
        className="nodrag w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
    </div>
  );
}

export default function CropImageNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const { updateNodeData } = useFlowStore();
  const edges = useFlowStore((state) => state.edges);

  // Check if there is an edge connected to our input image handle
  const isImageConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "imageUrl:image"
  );

  const cropConfig = data.cropConfig || { x: 20, y: 20, width: 60, height: 60 };

  const handleConfigChange = (key: string, val: number) => {
    updateNodeData(id, {
      cropConfig: {
        ...cropConfig,
        [key]: val,
      },
    });
  };

  const rawOutput = data.output?.outputImageUrl;
  const outputImageUrl = typeof rawOutput === "string" ? rawOutput : undefined;

  return (
    <NodeShell
      id={id}
      type="crop-image"
      label={data.label || "Crop Image"}
      status={data.status}
      selected={selected}
      error={data.error}
      duration={data.duration}
      icon={<Scissors size={16} />}
    >
      <div className="flex flex-col gap-3.5">
        {/* Input Image Connection Handle & Status */}
        <div className="relative flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Input Image
          </label>
          <div className="absolute left-0 top-6 -translate-x-[23px]">
            <TypedHandle
              type="target"
              position={Position.Left}
              id="imageUrl:image"
              dataType={HandleDataType.IMAGE}
            />
          </div>

          <div
            className={`w-full text-xs px-2.5 py-1.5 border rounded-lg flex items-center gap-2 ${
              isImageConnected
                ? "bg-blue-50/50 border-blue-200 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            <ImageIcon size={14} />
            <span className="font-semibold truncate">
              {isImageConnected ? "Linked Upstream" : "Connection Required"}
            </span>
          </div>
        </div>

        {/* Crop Numeric Parameters */}
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="X Pos (%)"
            value={cropConfig.x}
            min={-100}
            max={100}
            disabled={isExecuting(data.status)}
            onCommit={(v) => handleConfigChange("x", v)}
          />
          <NumberField
            label="Y Pos (%)"
            value={cropConfig.y}
            min={-100}
            max={100}
            disabled={isExecuting(data.status)}
            onCommit={(v) => handleConfigChange("y", v)}
          />
          <NumberField
            label="Width (%)"
            value={cropConfig.width}
            min={1}
            max={100}
            disabled={isExecuting(data.status)}
            onCommit={(v) => handleConfigChange("width", v)}
          />
          <NumberField
            label="Height (%)"
            value={cropConfig.height}
            min={1}
            max={100}
            disabled={isExecuting(data.status)}
            onCommit={(v) => handleConfigChange("height", v)}
          />
        </div>

        {/* Output handle and preview */}
        <div className="relative border-t border-gray-100 pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Output Image
            </label>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[23px]">
              <TypedHandle
                type="source"
                position={Position.Right}
                id="outputImageUrl:image"
                dataType={HandleDataType.IMAGE}
              />
            </div>
          </div>

          {outputImageUrl ? (
            <div className="relative border border-gray-200 rounded bg-gray-50 overflow-hidden h-24 flex items-center justify-center group/out">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={outputImageUrl}
                alt="Cropped Output"
                className="h-full w-full object-contain"
              />
              <a
                href={outputImageUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover/out:opacity-100 transition-opacity"
              >
                <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg text-[10px] text-gray-400 font-semibold bg-gray-50/50">
              Output will appear here after run
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  );
}

function isExecuting(status?: string): boolean {
  return status === "running";
}
