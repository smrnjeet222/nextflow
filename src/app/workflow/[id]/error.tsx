"use client";

import ErrorState from "@/components/ErrorState";

export default function WorkflowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} title="Failed to load this workflow" />;
}
