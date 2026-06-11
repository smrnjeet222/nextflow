"use client";

import { Position } from "@xyflow/react";
import { Scissors, ExternalLink, Image as ImageIcon } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import { HandleDataType } from "@/lib/constants";
import { NodeData } from "@/types/workflow";

export default function CropImageNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const { updateNodeData } = useFlowStore();
  const edges = useFlowStore((state) => state.edges);
  
  // Check if there is an edge connected to our input image handle
  const isImageConnected = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "imageUrl:image"
  );

  const cropConfig = data.cropConfig || { x: 20, y: 20, width: 60, height: 60 };

  const handleConfigChange = (key: string, val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    updateNodeData(id, {
      cropConfig: {
        ...cropConfig,
        [key]: clamped,
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">X Pos (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={cropConfig.x}
              onChange={(e) => handleConfigChange("x", parseInt(e.target.value) || 0)}
              disabled={isExecuting(data.status)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Y Pos (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={cropConfig.y}
              onChange={(e) => handleConfigChange("y", parseInt(e.target.value) || 0)}
              disabled={isExecuting(data.status)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Width (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={cropConfig.width}
              onChange={(e) => handleConfigChange("width", parseInt(e.target.value) || 1)}
              disabled={isExecuting(data.status)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Height (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={cropConfig.height}
              onChange={(e) => handleConfigChange("height", parseInt(e.target.value) || 1)}
              disabled={isExecuting(data.status)}
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
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
