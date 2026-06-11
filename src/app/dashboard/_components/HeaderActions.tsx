"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Loader2 } from "lucide-react";
import { createWorkflowAction, importWorkflowAction } from "../actions";

export default function HeaderActions() {
  const router = useRouter();
  const [isPending, startActionTransition] = useTransition();

  const handleCreate = () => startActionTransition(() => createWorkflowAction());

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        startActionTransition(async () => {
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

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 cursor-pointer transition-all shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Upload size={15} />
        Import
        <input
          type="file"
          accept=".json,application/json"
          onChange={handleImport}
          className="sr-only"
        />
      </label>

      <button
        onClick={handleCreate}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Plus size={15} />
        )}
        New workflow
      </button>
    </div>
  );
}
