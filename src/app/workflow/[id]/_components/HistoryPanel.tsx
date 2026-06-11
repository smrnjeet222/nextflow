"use client";

import { useState } from "react";
import {
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { STATUS_COLORS } from "@/lib/constants";
import { WorkflowRunDetail } from "@/types/execution";
import { useRunsQuery } from "@/lib/queries";
import { useRunStore } from "@/stores/runStore";

interface HistoryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  workflowId: string;
  initialRuns: WorkflowRunDetail[];
}

export default function HistoryPanel({
  isOpen,
  onToggle,
  workflowId,
  initialRuns,
}: HistoryPanelProps) {
  const { data: runs, refetch, isFetching } = useRunsQuery(workflowId, initialRuns);
  const activeRunId = useRunStore((s) =>
    s.phase.name === "monitoring" || s.phase.name === "finishing" ? s.phase.runId : null
  );

  // undefined = no manual choice yet → the active run auto-expands
  const [manualExpandId, setManualExpandId] = useState<string | null | undefined>(undefined);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const expandedRunId = manualExpandId !== undefined ? manualExpandId : activeRunId;
  const setExpandedRunId = (id: string | null) => setManualExpandId(id);

  return (
    <div className="relative h-full flex shrink-0 select-none z-30">
      {/* Collapse/Expand chevron tab on the left edge */}
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-6 h-12 bg-white hover:bg-gray-50 border border-r-0 border-gray-200 shadow-[-2px_0_8px_rgba(0,0,0,0.04)] rounded-l-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors z-40"
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Sidebar Content Panel */}
      <div
        className={`bg-white border-l border-gray-200 h-full flex flex-col transition-all duration-300 overflow-hidden ${
          isOpen ? "w-80" : "w-0 border-l-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-gray-500" />
            <h2 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
              Execution History
            </h2>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh runs"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Runs List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {runs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <History size={24} className="text-gray-300 mb-2" />
              <p className="text-xs font-semibold text-gray-400">No runs recorded yet.</p>
              <p className="text-[10px] text-gray-400 max-w-[180px] mt-0.5 leading-normal">
                Click the Play button in the top bar to run your first execution.
              </p>
            </div>
          ) : (
            runs.map((run, index) => {
              const runNumber = runs.length - index;
              const isExpanded = expandedRunId === run.id;
              const statusColor = STATUS_COLORS[run.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;

              return (
                <div key={run.id} className="flex flex-col bg-white">
                  {/* Run Header Item */}
                  <button
                    onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50/50 transition-colors flex items-center justify-between gap-2 ${
                      isExpanded ? "bg-gray-50/30" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-800">
                          Run #{runNumber}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${statusColor.bg} ${statusColor.text}`}>
                          {run.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium" suppressHydrationWarning>
                        {new Date(run.startedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-500 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold">
                        <Clock size={11} />
                        {run.duration !== null && run.duration !== undefined ? `${(run.duration / 1000).toFixed(1)}s` : "--"}
                      </div>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {/* Expanded Node Runs Tree */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50/40 border-t border-gray-50 flex flex-col gap-2.5">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-2.5 pl-2">
                        Node Execution Logs ({run.scope} run)
                      </div>
                      
                      <div className="flex flex-col border-l border-gray-200 ml-3.5 pl-3 gap-3">
                        {run.nodeRuns.map((nodeRun) => {
                          const isNodeExpanded = expandedNodeId === nodeRun.id;
                          
                          return (
                            <div key={nodeRun.id} className="flex flex-col relative">
                              {/* Connection line indicator circle */}
                              <div className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 rounded-full border border-white flex items-center justify-center bg-gray-200">
                                {nodeRun.status === "success" && (
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                )}
                                {nodeRun.status === "failed" && (
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                )}
                                {nodeRun.status === "running" && (
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                                )}
                                {nodeRun.status === "skipped" && (
                                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                )}
                              </div>

                              {/* Node header bar */}
                              <button
                                onClick={() => setExpandedNodeId(isNodeExpanded ? null : nodeRun.id)}
                                className="w-full flex items-center justify-between text-left"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold text-gray-700 truncate">
                                    {nodeRun.nodeName}
                                  </span>
                                  {nodeRun.status === "failed" && nodeRun.error && (
                                    <span className="text-[9px] text-red-500 truncate max-w-[200px] mt-0.5">
                                      {nodeRun.error}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-gray-400 shrink-0 ml-2">
                                  {nodeRun.status === "running" && (
                                    <Loader2 size={10} className="animate-spin text-blue-500" />
                                  )}
                                  <span className="text-[9px] font-medium">
                                    {nodeRun.duration !== null && nodeRun.duration !== undefined
                                      ? `${(nodeRun.duration / 1000).toFixed(1)}s`
                                      : nodeRun.status === "running"
                                      ? "running..."
                                      : "--"}
                                  </span>
                                </div>
                              </button>

                              {/* Expanded Node Inputs/Outputs Detail */}
                              {isNodeExpanded && (
                                <div className="mt-2 p-2 bg-white border border-gray-100 rounded-lg flex flex-col gap-1.5 shadow-sm text-[10px] font-mono text-gray-600 max-h-56 overflow-y-auto">
                                  {nodeRun.error && (
                                    <div>
                                      <div className="text-[8px] font-bold text-red-400 uppercase tracking-wider font-sans mb-0.5">
                                        Error
                                      </div>
                                      <pre className="whitespace-pre-wrap break-words text-red-600 bg-red-50/60 border border-red-100 rounded p-1.5">
                                        {nodeRun.error}
                                      </pre>
                                    </div>
                                  )}
                                  {!!nodeRun.inputs && (
                                    <div>
                                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider font-sans mb-0.5">Inputs</div>
                                      <pre className="whitespace-pre-wrap">{JSON.stringify(nodeRun.inputs, null, 2)}</pre>
                                    </div>
                                  )}
                                  {!!nodeRun.output && (
                                    <div className="border-t border-gray-50 pt-1.5 mt-1.5">
                                      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider font-sans mb-0.5">Output</div>
                                      <pre className="whitespace-pre-wrap">{JSON.stringify(nodeRun.output, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
