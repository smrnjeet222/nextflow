"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  Upload,
  Workflow,
  Settings,
  HelpCircle,
  Folder,
  Loader2,
} from "lucide-react";
import {
  createWorkflowAction,
  renameWorkflowAction,
  deleteWorkflowAction,
  importWorkflowAction,
  createSampleWorkflowAction,
} from "../actions";

export interface WorkflowItem {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

export interface SampleItem {
  id: string;
  name: string;
  description: string;
}

export default function DashboardShell({
  workflows,
  samples,
}: {
  workflows: WorkflowItem[];
  samples: SampleItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Poll for status updates whenever any workflow is "running"
  useEffect(() => {
    const hasRunning = workflows.some((wf) => wf.status === "running");
    const interval = setInterval(
      () => {
        router.refresh();
      },
      hasRunning ? 3000 : 10000
    );

    return () => clearInterval(interval);
  }, [workflows, router]);

  const handleCreate = () => startTransition(() => createWorkflowAction());

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    const payload = { id: renameId, name: renameName.trim() };
    setRenameId(null);
    setRenameName("");
    startTransition(() => renameWorkflowAction(payload));
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(() => deleteWorkflowAction(id));
  };

  const handleImportSample = (sampleId: string) => {
    startTransition(async () => {
      const result = await createSampleWorkflowAction(sampleId);
      if ("error" in result) {
        alert(`Failed to import sample: ${result.error}`);
      } else {
        router.push(`/workflow/${result.id}`);
      }
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        startTransition(async () => {
          const result = await importWorkflowAction(json);
          if ("error" in result) {
            alert(`Import failed: ${result.error}`);
          } else {
            router.push(`/workflow/${result.id}`);
          }
        });
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const filteredWorkflows = workflows.filter((wf) =>
    wf.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-6 border-b border-gray-100 flex items-center gap-2">
            <div className="p-1.5 bg-violet-600 rounded-lg text-white">
              <Workflow size={20} />
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">
              Next<span className="text-violet-600">Flow</span>
            </span>
          </div>

          <nav className="p-4 space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-violet-700 bg-violet-50/70 rounded-lg transition-colors">
              <Folder size={18} />
              Workflows
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              <Settings size={18} />
              Settings
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
              <HelpCircle size={18} />
              Documentation
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <UserButton showName appearance={{ elements: { userButtonBox: "flex-row-reverse" } }} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-gray-200 bg-white px-8 flex items-center justify-between shrink-0">
          <h1 className="text-xl font-bold text-gray-900">My Workflows</h1>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 hover:bg-gray-100/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-64 transition-all"
              />
            </div>

            <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-all">
              <Upload size={16} />
              Import JSON
              <input type="file" accept=".json,application/json" onChange={handleImport} className="sr-only" />
            </label>

            <button
              onClick={handleCreate}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Workflow
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-12">
          {/* Samples Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Start from a Sample</h2>
                <p className="text-sm text-gray-500">Kickstart your automation with pre-built workflows.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleImportSample(sample.id)}
                  disabled={isPending}
                  className="group text-left p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-violet-200 transition-all flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-violet-50 text-violet-600 rounded-lg group-hover:bg-violet-600 group-hover:text-white transition-colors">
                        <Workflow size={20} />
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
                        {sample.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{sample.description}</p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-semibold text-violet-600 group-hover:text-violet-700">
                    Import Sample →
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Workflows Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Your Workflows</h2>
            </div>
            {filteredWorkflows.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
              <div className="text-center max-w-sm p-6">
                <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
                  <Workflow size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No workflows found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery
                    ? "No results match your search."
                    : "Get started by creating a new workflow or importing an existing JSON file."}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleCreate}
                    disabled={isPending}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Create First Workflow
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkflows.map((wf) => {
                const isRunning = wf.status === "running";
                return (
                  <div
                    key={wf.id}
                    onClick={() => router.push(`/workflow/${wf.id}`)}
                    className="group border border-gray-200 rounded-xl bg-white hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-violet-50 text-violet-600 rounded-lg shrink-0">
                            <Workflow size={20} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors line-clamp-1">
                              {wf.name}
                            </h3>
                            {/* Locale/timezone differ between server and client; let
                                React patch the client value instead of erroring */}
                            <p className="text-xs text-gray-400 mt-0.5" suppressHydrationWarning>
                              Edited{" "}
                              {new Date(wf.updatedAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            isRunning
                              ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {isRunning ? "Running" : "Idle"}
                        </span>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between rounded-b-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/api/workflows/${wf.id}/export`, "_blank");
                        }}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Download size={14} />
                        Export JSON
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameId(wf.id);
                            setRenameName(wf.name);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(wf.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </section>
        </div>
      </main>

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
    </div>
  );
}
