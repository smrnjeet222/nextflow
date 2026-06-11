"use client";

import { Position } from "@xyflow/react";
import { CheckCircle, ExternalLink, FileText, Sparkles } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import { HandleDataType } from "@/lib/constants";
import { NodeData } from "@/types/workflow";

export default function ResponseNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const edges = useFlowStore((state) => state.edges);
  
  // Check connection status
  const isResultConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "result:any"
  );

  const rawResult =
    data.output?.result ?? data.output?.response ?? data.output?.outputImageUrl;
  const resultValue =
    typeof rawResult === "string"
      ? rawResult
      : rawResult != null
      ? JSON.stringify(rawResult, null, 2)
      : "";

  // Helper to detect if result is an image (url or base64 data url)
  const isImageUrl = (val: string) => {
    if (typeof val !== "string") return false;
    return val.startsWith("data:image/") || val.startsWith("http://") || val.startsWith("https://") && (val.includes(".png") || val.includes(".jpg") || val.includes(".jpeg") || val.includes(".webp") || val.includes(".gif") || val.includes("unsplash.com") || val.includes("transloadit.com"));
  };

  const isImage = isImageUrl(resultValue);

  return (
    <NodeShell
      id={id}
      type="response"
      label={data.label || "Response"}
      status={data.status}
      selected={selected}
      error={data.error}
      duration={data.duration}
      icon={<CheckCircle size={16} className="text-green-600" />}
    >
      <div className="flex flex-col gap-3">
        {/* Input Handle */}
        <div className="relative flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Final Result
          </label>
          <div className="absolute left-0 top-6 -translate-x-[23px]">
            <TypedHandle
              type="target"
              position={Position.Left}
              id="result:any"
              dataType={HandleDataType.ANY}
            />
          </div>

          <div
            className={`w-full text-xs px-2.5 py-1.5 border rounded-lg flex items-center gap-2 ${
              isResultConnected
                ? "bg-green-50/50 border-green-200 text-green-700 font-semibold"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            <Sparkles size={14} className={isResultConnected ? "text-green-500" : "text-gray-400"} />
            <span className="truncate">
              {isResultConnected ? "Output Connected" : "Connection Required"}
            </span>
          </div>
        </div>

        {/* Display Final Value */}
        <div className="border-t border-gray-100 pt-3">
          {resultValue ? (
            isImage ? (
              <div className="relative border border-gray-200 rounded-lg bg-gray-50 overflow-hidden h-36 flex items-center justify-center group/resp">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resultValue}
                  alt="Final Output Preview"
                  className="h-full w-full object-contain"
                />
                <a
                  href={resultValue}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover/resp:opacity-100 transition-opacity"
                >
                  <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <div className="nodrag nowheel select-text cursor-text w-full max-h-36 overflow-y-auto text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">
                {resultValue}
              </div>
            )
          ) : (
            <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 font-medium bg-gray-50/50">
              <FileText size={20} className="mx-auto mb-2 opacity-50" />
              Final workflow result will be displayed here
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  );
}
