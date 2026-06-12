"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Trash2, Edit2, Loader2, Play, X, Copy, Check } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { useRunStore, selectIsRunActive } from "@/stores/runStore";

interface NodeShellProps {
  id: string;
  type: "request-inputs" | "crop-image" | "gemini" | "response";
  label: string;
  status?: "idle" | "pending" | "running" | "success" | "failed" | "skipped";
  selected?: boolean;
  error?: string;
  duration?: number;
  icon: React.ReactNode;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export default function NodeShell({
  id,
  type,
  label,
  status = "idle",
  selected = false,
  error,
  duration,
  icon,
  children,
  headerRight,
}: NodeShellProps) {
  const { deleteNode, updateNodeData, takeSnapshot } = useFlowStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(label);
  const menuRef = useRef<HTMLDivElement>(null);

  const copyError = async () => {
    if (!error) return;
    await navigator.clipboard.writeText(error);
    setErrorCopied(true);
    setTimeout(() => setErrorCopied(false), 1500);
  };

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRename = () => {
    if (editedLabel.trim() && editedLabel !== label) {
      takeSnapshot();
      updateNodeData(id, { label: editedLabel.trim() });
    }
    setIsEditingLabel(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    deleteNode(id);
    setShowMenu(false);
  };

  // Pre-placed nodes carry `deletable: false`; picker-added input/response
  // nodes stay deletable and renamable.
  const isPreplaced = useFlowStore(
    (state) => state.nodes.find((n) => n.id === id)?.deletable === false
  );
  const isExecuting = status === "running";
  const isQueued = status === "pending";
  const isRunnable = type === "crop-image" || type === "gemini";
  // Any run in flight (phase != idle from the instant of the click) disables
  // all Run buttons; extra clicks are also ignored by the FSM's START guard.
  const isAnyRunActive = useRunStore(selectIsRunActive);

  const handleRunNode = () => {
    void useRunStore.getState().startRun("single", [id]);
  };

  return (
    <div
      className={`w-72 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.08)] border text-gray-900 select-none overflow-visible flex flex-col transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] ${
        isExecuting ? "node-executing" : ""
      } ${
        selected
          ? "border-violet-500 ring-2 ring-violet-500/60"
          : status === "failed"
          ? "border-red-400 ring-2 ring-red-500/15"
          : "border-gray-200"
      }`}
    >
      {/* Node Header — row 1: identity, row 2: actions */}
      <div className="px-3 py-2 border-b border-gray-100 flex flex-col gap-1.5 shrink-0 bg-white rounded-t-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="text-gray-500 shrink-0">{icon}</div>

            {isEditingLabel ? (
              <input
                type="text"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                className="font-semibold text-xs border border-blue-500 px-1 py-0.5 rounded outline-none w-full"
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={() => !isPreplaced && setIsEditingLabel(true)}
                className="font-semibold text-xs text-gray-800 truncate cursor-pointer hover:text-blue-600 transition-colors"
                title={label}
              >
                {label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {type === "crop-image" && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold text-violet-700 bg-violet-50 rounded border border-violet-200">
                Crop
              </span>
            )}
            {type === "gemini" && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 rounded border border-blue-200">
                LLM
              </span>
            )}

            {status === "pending" && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse"
                title="Queued for execution"
              />
            )}
            {status === "success" && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Executed Successfully" />
            )}
            {status === "failed" && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="Execution Failed" />
            )}
            {status === "skipped" && (
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Skipped (upstream failed)" />
            )}

            {/* Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg border border-gray-100 shadow-lg py-1 z-50">
                <button
                  onClick={() => setIsEditingLabel(true)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                >
                  <Edit2 size={12} />
                  Rename
                </button>
                {!isPreplaced && (
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50 transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Row 2: actions — per-node Run / Running / Queued + extras (model select) */}
        {(isRunnable || headerRight || isExecuting || isQueued) && (
          <div className="flex items-center justify-between gap-2">
            {isExecuting ? (
              <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-md animate-pulse">
                <Loader2 className="animate-spin" size={10} />
                Running
              </span>
            ) : isQueued ? (
              <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
                <Loader2 className="animate-spin" size={10} />
                Queued
              </span>
            ) : isRunnable ? (
              <button
                onClick={handleRunNode}
                disabled={isAnyRunActive}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors disabled:opacity-40 disabled:hover:bg-emerald-50 disabled:cursor-not-allowed"
                title={isAnyRunActive ? "A run is already in progress" : "Run this node only"}
              >
                <Play size={10} className="fill-emerald-700" />
                Run
              </button>
            ) : (
              <span />
            )}

            {headerRight}
          </div>
        )}
      </div>

      {/* Node Content */}
      <div className="p-3.5 flex-1 relative">{children}</div>

      {/* Error and Duration Footer */}
      {(error || duration !== undefined) && (
        <div className="px-3.5 py-1.5 border-t border-gray-50 bg-gray-50/50 rounded-b-2xl flex items-center justify-between gap-2 text-[9px] text-gray-400 font-medium">
          <span className="shrink-0">
            {duration !== undefined ? `${(duration / 1000).toFixed(2)}s` : ""}
          </span>
          {error && (
            <button
              onClick={() => setShowErrorModal(true)}
              className="text-red-500 hover:text-red-600 hover:underline truncate text-left"
              title="Click to view the full error"
            >
              {error}
            </button>
          )}
        </div>
      )}

      {/* Full error modal — portaled to <body>: React Flow nodes are CSS-
          transformed, which breaks position:fixed inside them */}
      {showErrorModal &&
        error &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setShowErrorModal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-gray-100 flex flex-col max-h-[70vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-gray-900">
                  Error — <span className="text-red-600">{label}</span>
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={copyError}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy error"
                  >
                    {errorCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => setShowErrorModal(false)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="p-5 overflow-y-auto">
                <pre className="text-xs text-red-600 bg-red-50/60 border border-red-100 rounded-lg p-3 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {error}
                </pre>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
