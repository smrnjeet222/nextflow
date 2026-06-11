"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowUpRight } from "lucide-react";
import { createSampleWorkflowAction } from "../actions";
import GraphPreview from "./GraphPreview";

export interface SampleItem {
  id: string;
  name: string;
  description: string;
}

export default function SamplesSection({ samples }: { samples: SampleItem[] }) {
  const router = useRouter();
  const [isPending, startActionTransition] = useTransition();
  // Which template was clicked — the spinner belongs to that card only,
  // while isPending still disables the whole grid against double imports.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleImportSample = (sampleId: string) => {
    setPendingId(sampleId);
    startActionTransition(async () => {
      const result = await createSampleWorkflowAction(sampleId);
      if ("error" in result) {
        alert(`Failed to import sample: ${result.error}`);
      } else {
        router.push(`/workflow/${result.id}`);
      }
    });
  };

  return (
    <section className="mt-10">
      <h2 className="text-[15px] font-bold text-gray-900">Templates</h2>
      <p className="mt-0.5 text-[13px] text-gray-500">
        Pre-built workflows — click one to copy it into your account and start editing.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {samples.map((sample) => (
          <button
            key={sample.id}
            onClick={() => handleImportSample(sample.id)}
            disabled={isPending}
            className="group relative text-left rounded-xl border border-gray-200 bg-white overflow-hidden cursor-pointer hover:border-violet-300 hover:shadow-[0_4px_16px_rgba(124,58,237,0.08)] transition-all disabled:opacity-60 disabled:cursor-default"
          >
            <div className="h-28 border-b border-gray-100">
              <GraphPreview seed={sample.id} />
            </div>
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold text-gray-900 truncate">
                  {sample.name}
                </h3>
                {isPending && pendingId === sample.id ? (
                  <Loader2 size={14} className="shrink-0 text-violet-500 animate-spin" />
                ) : (
                  <ArrowUpRight
                    size={14}
                    className="shrink-0 text-gray-300 group-hover:text-violet-600 transition-colors"
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {sample.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
