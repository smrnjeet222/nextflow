"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  RotateCcw,
  RotateCw,
  Download,
  Check,
  Loader2,
  History,
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { useRunStore, selectIsRunActive } from "@/stores/runStore";

interface TopBarProps {
  workflowId: string;
  name: string;
  isSaving: boolean;
  onRename: (newName: string) => void;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;
}

export default function TopBar({
  workflowId,
  name,
  isSaving,
  onRename,
  onToggleHistory,
  isHistoryOpen,
}: TopBarProps) {
  const { undo, redo, past, future, nodes } = useFlowStore();
  const isExecuting = useRunStore(selectIsRunActive);

  const [editedName, setEditedName] = useState(name);

  // Sync external renames without an effect (render-time reset pattern)
  const [lastName, setLastName] = useState(name);
  if (name !== lastName) {
    setLastName(name);
    setEditedName(name);
  }

  const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const hasSelection = selectedNodeIds.length > 0;

  const handleNameBlur = () => {
    if (editedName.trim() && editedName.trim() !== name) {
      onRename(editedName.trim());
    }
  };

  const handleExport = () => {
    window.open(`/api/workflows/${workflowId}/export`, "_blank");
  };

  const runSelected = () => {
    void useRunStore
      .getState()
      .startRun(selectedNodeIds.length === 1 ? "single" : "partial", selectedNodeIds);
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-30 flex items-start justify-between pointer-events-none select-none">
      {/* Left — floating back + name pill */}
      <div className="pointer-events-auto flex items-center gap-2 bg-white rounded-full border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.08)] pl-2 pr-4 py-1.5">
        <Link
          href="/dashboard"
          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft size={16} />
        </Link>

        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="font-semibold text-sm text-gray-950 bg-transparent focus:outline-none w-44 px-0.5 py-0.5"
          placeholder="Workflow Name"
        />

        <div
          className="flex items-center gap-1.5 text-[10px] text-gray-400 font-semibold px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-full"
          title="Autosave status"
        >
          {isSaving ? (
            <>
              <Loader2 size={10} className="animate-spin text-violet-500" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check size={10} className="text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Right — undo/redo, export, run */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="flex items-center bg-white border border-gray-200 rounded-full overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <button
            onClick={undo}
            disabled={past.length === 0}
            className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-r border-gray-100"
            title="Undo (⌘Z)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={redo}
            disabled={future.length === 0}
            className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Redo (⌘⇧Z)"
          >
            <RotateCw size={14} />
          </button>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-full text-xs font-semibold text-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-colors"
          title="Export Workflow as JSON"
        >
          <Download size={13} />
          Export
        </button>

        {/* Run Selected — ghost pill, only visible while nodes are selected */}
        {hasSelection && (
          <button
            onClick={runSelected}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-violet-200 hover:bg-violet-50 rounded-full text-xs font-semibold text-violet-700 shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-colors disabled:opacity-50"
            title="Run only the selected nodes"
          >
            <Play size={12} className="fill-violet-700" />
            Run Selected ({selectedNodeIds.length})
          </button>
        )}

        {/* Run full workflow */}
        <button
          onClick={() => void useRunStore.getState().startRun("full")}
          disabled={isExecuting}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full text-xs font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {isExecuting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} className="fill-white" />
          )}
          <span>{isExecuting ? "Running…" : "Run Workflow"}</span>
        </button>

        {/* Execution history toggle */}
        <button
          onClick={onToggleHistory}
          className={`p-2.5 rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-colors ${
            isHistoryOpen
              ? "bg-violet-50 border-violet-200 text-violet-700"
              : "bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
          title="Execution history"
        >
          <History size={14} />
        </button>
      </div>
    </div>
  );
}
