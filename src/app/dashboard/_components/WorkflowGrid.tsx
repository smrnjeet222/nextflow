"use client";

import { useState, useTransition, useEffect, useOptimistic, startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  Workflow,
  MoreVertical,
  Loader2,
} from "lucide-react";
import {
  createWorkflowAction,
  renameWorkflowAction,
  deleteWorkflowAction,
} from "../actions";
import GraphPreview from "./GraphPreview";

export interface WorkflowItem {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function WorkflowGrid({ workflows }: { workflows: WorkflowItem[] }) {
  const router = useRouter();
  // Create gets its own transition: the empty-state button must not show a
  // pending spinner while an unrelated rename/delete action is in flight.
  const [isCreating, startCreateTransition] = useTransition();
  const [, startActionTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  // Rename/delete paint instantly; the canonical list from the server action's
  // revalidatePath reconciles (and reverts on failure) when the transition ends.
  const [optimisticWorkflows, applyOptimistic] = useOptimistic(
    workflows,
    (
      current: WorkflowItem[],
      action: { type: "rename"; id: string; name: string } | { type: "delete"; id: string }
    ) => {
      switch (action.type) {
        case "rename":
          return current.map((wf) =>
            wf.id === action.id ? { ...wf, name: action.name } : wf
          );
        case "delete":
          return current.filter((wf) => wf.id !== action.id);
      }
    }
  );

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Poll for status updates whenever any workflow is "running". The global
  // startTransition keeps the periodic refresh from flashing pending UI.
  useEffect(() => {
    const hasRunning = workflows.some((wf) => wf.status === "running");
    const interval = setInterval(
      () => {
        startTransition(() => router.refresh());
      },
      hasRunning ? 3000 : 10000
    );

    return () => clearInterval(interval);
  }, [workflows, router]);

  const handleCreate = () => startCreateTransition(() => createWorkflowAction());

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    const payload = { id: renameId, name: renameName.trim() };
    setRenameId(null);
    setRenameName("");
    startActionTransition(async () => {
      applyOptimistic({ type: "rename", id: payload.id, name: payload.name });
      await renameWorkflowAction(payload);
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startActionTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await deleteWorkflowAction(id);
    });
  };

  const filteredWorkflows = optimisticWorkflows.filter((wf) =>
    wf.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Your workflows</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Open one to edit, run, and review history.
          </p>
        </div>

        <div className="relative shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={15}
          />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 w-60 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className="mt-4 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-white/60 py-16">
          <div className="text-center max-w-sm p-6">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
              <Workflow size={22} />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900">No workflows found</h3>
            <p className="mt-1 text-[13px] text-gray-500">
              {searchQuery
                ? "No results match your search."
                : "Get started by creating a new workflow or importing an existing JSON file."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Create first workflow
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredWorkflows.map((wf) => {
            const isRunning = wf.status === "running";
            return (
              <Link
                key={wf.id}
                href={`/workflow/${wf.id}`}
                className="group relative block rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-gray-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all cursor-pointer"
              >
                <div className="relative h-28 border-b border-gray-100">
                  <GraphPreview seed={wf.id} />

                  {isRunning && (
                    <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/90 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Running
                    </span>
                  )}

                  {/* Card menu */}
                  <button
                    onClick={(e) => {
                      // preventDefault stops the wrapping Link from navigating
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuId(menuId === wf.id ? null : wf.id);
                    }}
                    className={`absolute right-2 top-2 p-1.5 rounded-lg border border-gray-200 bg-white/90 text-gray-500 backdrop-blur-sm transition-opacity hover:text-gray-900 ${
                      menuId === wf.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    title="More options"
                  >
                    <MoreVertical size={14} />
                  </button>

                  {menuId === wf.id && (
                    <>
                      {/* invisible backdrop closes the menu on outside click */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuId(null);
                        }}
                      />
                      <div
                        className="absolute right-2 top-10 z-20 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <button
                          onClick={() => {
                            setMenuId(null);
                            setRenameId(wf.id);
                            setRenameName(wf.name);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit2 size={13} className="text-gray-400" />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setMenuId(null);
                            window.open(`/api/workflows/${wf.id}/export`, "_blank");
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download size={13} className="text-gray-400" />
                          Export JSON
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          onClick={() => {
                            setMenuId(null);
                            setDeleteId(wf.id);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-3.5">
                  <h3 className="text-[13.5px] font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">
                    {wf.name}
                  </h3>
                  {/* Client clock differs from the server render; let React
                      patch the value instead of erroring */}
                  <p className="mt-0.5 text-xs text-gray-400" suppressHydrationWarning>
                    Edited {timeAgo(wf.updatedAt)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Rename Modal */}
      {renameId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Rename Workflow</h3>
            <p className="text-xs text-gray-500 mt-1">Enter a new name for your workflow.</p>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="mt-4 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder="Workflow Name"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setRenameId(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Delete Workflow</h3>
            <p className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete this workflow? This action cannot be undone and will
              delete all associated execution runs.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
