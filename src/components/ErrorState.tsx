"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

/**
 * Shared UI for route-level error boundaries. Each segment's error.tsx
 * stays a thin wrapper around this so the look and the "Try again" /
 * "Back to dashboard" affordances are consistent everywhere.
 */
export default function ErrorState({
  error,
  reset,
  title = "Something went wrong",
}: ErrorStateProps) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
          <AlertTriangle size={22} className="text-red-500" />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-base text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 leading-relaxed">
            {error.message || "An unexpected error occurred while loading this page."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-gray-400 font-mono mt-1">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <RotateCcw size={13} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <LayoutDashboard size={13} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
