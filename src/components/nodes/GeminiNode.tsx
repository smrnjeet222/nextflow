"use client";

import { useState } from "react";
import { Position } from "@xyflow/react";
import { Brain, ChevronDown, ChevronRight, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import { HandleDataType, GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/constants";
import { NodeData } from "@/types/workflow";

export default function GeminiNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const { updateNodeData } = useFlowStore();
  const edges = useFlowStore((state) => state.edges);
  
  const [showSettings, setShowSettings] = useState(false);

  // Connection check states
  const isPromptConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "prompt:text"
  );
  const isSystemPromptConnected = edges.some(
    (e) => e.target === id && e.targetHandle === "systemPrompt:text"
  );
  
  // Count multiple image connections mapped to Image (Vision)
  const connectedImages = edges.filter(
    (e) => e.target === id && e.targetHandle === "imageUrls:image"
  );

  const geminiConfig = data.geminiConfig || {
    model: DEFAULT_GEMINI_MODEL,
    prompt: "",
    systemPrompt: "",
  };

  const handleConfigChange = (key: string, value: string) => {
    updateNodeData(id, {
      geminiConfig: {
        ...geminiConfig,
        [key]: value,
      },
    });
  };

  // Renders the model selection dropdown in the Node Header
  const ModelSelector = (
    <select
      value={geminiConfig.model}
      onChange={(e) => handleConfigChange("model", e.target.value)}
      className="text-[10px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md px-1.5 py-1 outline-none cursor-pointer max-w-[150px]"
    >
      {GEMINI_MODELS.map((model) => (
        <option key={model.id} value={model.id}>
          {model.name}
        </option>
      ))}
    </select>
  );

  const rawResponse = data.output?.response;
  const responseText = typeof rawResponse === "string" ? rawResponse : undefined;

  return (
    <NodeShell
      id={id}
      type="gemini"
      label={data.label || "Gemini"}
      status={data.status}
      selected={selected}
      error={data.error}
      duration={data.duration}
      icon={<Brain size={16} className="text-blue-600" />}
      headerRight={ModelSelector}
    >
      <div className="flex flex-col gap-3.5">
        {/* System Prompt Input */}
        <div className="relative flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              System Prompt
            </label>
            <div className="absolute left-0 top-[22px] -translate-x-[23px]">
              <TypedHandle
                type="target"
                position={Position.Left}
                id="systemPrompt:text"
                dataType={HandleDataType.TEXT}
              />
            </div>
          </div>
          
          <input
            type="text"
            value={geminiConfig.systemPrompt}
            onChange={(e) => handleConfigChange("systemPrompt", e.target.value)}
            disabled={isSystemPromptConnected}
            placeholder={isSystemPromptConnected ? "System Prompt Linked" : "You are a copywriter..."}
            className={`w-full text-xs px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 truncate ${
              isSystemPromptConnected
                ? "bg-gray-100 border-gray-200 text-gray-400 font-semibold"
                : "bg-white border-gray-200 text-gray-800"
            }`}
          />
        </div>

        {/* Prompt Input */}
        <div className="relative flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Prompt
            </label>
            <div className="absolute left-0 top-[26px] -translate-x-[23px]">
              <TypedHandle
                type="target"
                position={Position.Left}
                id="prompt:text"
                dataType={HandleDataType.TEXT}
              />
            </div>
          </div>

          <textarea
            value={geminiConfig.prompt}
            onChange={(e) => handleConfigChange("prompt", e.target.value)}
            disabled={isPromptConnected}
            placeholder={isPromptConnected ? "Prompt Linked Upstream" : "Enter prompt instructions..."}
            rows={2}
            className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-sans ${
              isPromptConnected
                ? "bg-gray-100 border-gray-200 text-gray-400 font-semibold"
                : "bg-white border-gray-200 text-gray-800"
            }`}
          />
        </div>

        {/* Image (Vision) Input */}
        <div className="relative flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Image (Vision)
            </label>
            <div className="absolute left-0 top-[22px] -translate-x-[23px]">
              <TypedHandle
                type="target"
                position={Position.Left}
                id="imageUrls:image"
                dataType={HandleDataType.IMAGE}
              />
            </div>
          </div>

          <div
            className={`w-full text-xs px-2.5 py-1.5 border rounded-lg flex items-center justify-between ${
              connectedImages.length > 0
                ? "bg-blue-50/50 border-blue-200 text-blue-700 font-semibold"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            <span>{connectedImages.length > 0 ? "Linked Images" : "Connection Optional"}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${connectedImages.length > 0 ? "bg-blue-200/50" : "bg-gray-200/50"}`}>
              {connectedImages.length}
            </span>
          </div>
        </div>

        {/* Collapsible Settings */}
        <div className="border-t border-gray-100 pt-2 flex flex-col">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider py-1.5 transition-colors"
          >
            <span className="flex items-center gap-1">
              <SettingsIcon size={10} />
              Settings
            </span>
            {showSettings ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {showSettings && (
            <div className="flex flex-col gap-2 mt-2 pl-1.5 border-l-2 border-gray-100">
              {/* Optional handles */}
              <div className="relative flex items-center justify-between py-1 text-xs text-gray-500">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[25px]">
                  <TypedHandle type="target" position={Position.Left} id="videoUrls:video" dataType={HandleDataType.VIDEO} />
                </div>
                <span>Video Input</span>
              </div>
              <div className="relative flex items-center justify-between py-1 text-xs text-gray-500">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[25px]">
                  <TypedHandle type="target" position={Position.Left} id="audioUrls:audio" dataType={HandleDataType.AUDIO} />
                </div>
                <span>Audio Input</span>
              </div>
              <div className="relative flex items-center justify-between py-1 text-xs text-gray-500">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[25px]">
                  <TypedHandle type="target" position={Position.Left} id="fileUrls:file" dataType={HandleDataType.FILE} />
                </div>
                <span>File Input</span>
              </div>
            </div>
          )}
        </div>

        {/* Inline Response output */}
        <div className="relative border-t border-gray-100 pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={10} className="text-amber-500" />
              Response Output
            </label>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[23px]">
              <TypedHandle
                type="source"
                position={Position.Right}
                id="response:text"
                dataType={HandleDataType.TEXT}
              />
            </div>
          </div>

          {responseText ? (
            <div className="w-full max-h-36 overflow-y-auto text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">
              {responseText}
            </div>
          ) : (
            <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg text-[10px] text-gray-400 font-semibold bg-gray-50/50">
              Response text will appear inline here
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  );
}
