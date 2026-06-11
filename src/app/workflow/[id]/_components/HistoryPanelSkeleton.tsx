"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";

/**
 * Suspense fallback for the history panel while the run list streams in.
 * Mirrors HistoryPanel's outer frame (chevron tab + w-80 panel) so the
 * resolved panel swaps in without layout shift.
 */
export default function HistoryPanelSkeleton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative h-full flex shrink-0 select-none z-30">
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-6 h-12 bg-white hover:bg-gray-50 border border-r-0 border-gray-200 shadow-[-2px_0_8px_rgba(0,0,0,0.04)] rounded-l-lg flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors z-40"
      >
        {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div
        className={`bg-white border-l border-gray-200 h-full flex flex-col transition-all duration-300 overflow-hidden ${
          isOpen ? "w-80" : "w-0 border-l-0"
        }`}
      >
        <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-gray-500" />
            <h2 className="font-bold text-xs text-gray-700 uppercase tracking-wider">
              Execution History
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-hidden divide-y divide-gray-100 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-2">
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-14 bg-gray-200 rounded" />
                  <div className="h-4 w-14 bg-gray-100 rounded" />
                </div>
                <div className="h-2.5 w-28 bg-gray-100 rounded" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-3 w-10 bg-gray-100 rounded" />
                <div className="w-3.5 h-3.5 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
