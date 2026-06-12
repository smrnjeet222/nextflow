"use client";

import { useState } from "react";
import { Position } from "@xyflow/react";
import { Brain, ChevronRight, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import NodeShell from "./shared/NodeShell";
import TypedHandle from "./shared/TypedHandle";
import AutoResizeTextarea from "./shared/AutoResizeTextarea";
import { HandleDataType, GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/constants";
import { GeminiConfig, NodeData } from "@/types/workflow";

// Generation params surfaced in the Settings panel. Unset = Gemini model default.
const GENERATION_PARAMS: {
  key: keyof Pick<GeminiConfig, "temperature" | "topP" | "topK" | "maxOutputTokens">;
  label: string;
  min: number;
  max: number;
  step: number;
  fallback: number; // slider position before the user sets a value
}[] = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.1, fallback: 1 },
  { key: "topP", label: "Top P", min: 0, max: 1, step: 0.05, fallback: 0.95 },
  { key: "topK", label: "Top K", min: 1, max: 100, step: 1, fallback: 40 },
  { key: "maxOutputTokens", label: "Max Tokens", min: 1, max: 8192, step: 1, fallback: 2048 },
];

export default function GeminiNode({ id, data, selected }: { id: string; data: NodeData; selected?: boolean }) {
  const { updateNodeData } = useFlowStore();
  const edges = useFlowStore((state) => state.edges);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const handleParamChange = (key: keyof GeminiConfig, value: number | undefined) => {
    updateNodeData(id, {
      geminiConfig: {
        ...geminiConfig,
        [key]: value,
      },
    });
  };

  const setParamCount = GENERATION_PARAMS.filter(
    (p) => geminiConfig[p.key] !== undefined
  ).length;

  // Renders the model selection dropdown in the Node Header
  const ModelSelector = (
    <select
      value={geminiConfig.model}
      onChange={(e) => handleConfigChange("model", e.target.value)}
      className="nodrag text-[10px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md px-1.5 py-1 outline-none cursor-pointer max-w-[150px]"
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
          
          <AutoResizeTextarea
            value={geminiConfig.systemPrompt}
            onChange={(e) => handleConfigChange("systemPrompt", e.target.value)}
            disabled={isSystemPromptConnected}
            placeholder={isSystemPromptConnected ? "System Prompt Linked" : "You are a copywriter..."}
            rows={1}
            className={`w-full text-xs px-2 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans ${
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

          <AutoResizeTextarea
            value={geminiConfig.prompt}
            onChange={(e) => handleConfigChange("prompt", e.target.value)}
            disabled={isPromptConnected}
            placeholder={isPromptConnected ? "Prompt Linked Upstream" : "Enter prompt instructions..."}
            rows={2}
            className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans ${
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

        {/* Generation Settings (collapsible) */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="nodrag flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700 cursor-pointer w-fit"
          >
            <ChevronRight
              size={12}
              className={`transition-transform ${settingsOpen ? "rotate-90" : ""}`}
            />
            <Settings2 size={10} />
            Settings
            {setParamCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 normal-case tracking-normal">
                {setParamCount} set
              </span>
            )}
          </button>

          {settingsOpen && (
            <div className="nodrag mt-1 px-2.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50">
              <div className="flex flex-col gap-2.5">
                {GENERATION_PARAMS.map((param) => {
                  const value = geminiConfig[param.key] as number | undefined;
                  const isSet = value !== undefined;
                  return (
                    <div key={param.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-gray-500">
                          {param.label}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold tabular-nums ${
                              isSet ? "text-blue-600" : "text-gray-400"
                            }`}
                          >
                            {value ?? param.fallback}
                          </span>
                          {isSet && (
                            <button
                              type="button"
                              onClick={() => handleParamChange(param.key, undefined)}
                              title="Reset to model default"
                              className="text-gray-400 hover:text-blue-600 cursor-pointer transition-colors"
                            >
                              <RotateCcw size={9} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={value ?? param.fallback}
                        onChange={(e) => handleParamChange(param.key, Number(e.target.value))}
                        className={`w-full h-[3px] rounded-full appearance-none cursor-pointer ${
                          isSet ? "bg-blue-200" : "bg-gray-200"
                        } [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0`}
                      />
                    </div>
                  );
                })}
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
            <div className="nodrag nowheel select-text cursor-text w-full max-h-36 overflow-y-auto text-xs px-2.5 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">
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
