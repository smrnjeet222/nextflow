"use client";

import ErrorState from "@/components/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The workflows list has its own inline boundary; this catches everything else.
  return <ErrorState error={error} reset={reset} title="Failed to load the dashboard" />;
}
