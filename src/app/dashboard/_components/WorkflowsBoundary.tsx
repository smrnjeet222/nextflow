"use client";

import { Component, useCallback, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Loader2 } from "lucide-react";

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<
  { children: ReactNode; onRetry: () => void; retrying: boolean },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[workflows-boundary]", error);
  }

  retry = () => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex items-center justify-center rounded-2xl border border-red-100 bg-red-50/40 py-14">
        <div className="text-center max-w-sm p-6">
          <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900">
            Failed to load your workflows
          </h3>
          <p className="mt-1 text-[13px] text-gray-500 leading-relaxed">
            {this.state.error.message || "Something went wrong while fetching this list."}
          </p>
          <button
            onClick={this.retry}
            disabled={this.props.retrying}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {this.props.retrying ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RotateCcw size={13} />
            )}
            Try again
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Error boundary scoped to the workflows list. A failed fetch shows an
 * inline retry card while the sidebar, header, and templates stay usable.
 * Retry refreshes the route so the server component re-renders.
 */
export default function WorkflowsBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  const handleRetry = useCallback(() => {
    startRetry(() => router.refresh());
  }, [router]);

  return (
    <Boundary onRetry={handleRetry} retrying={retrying}>
      {children}
    </Boundary>
  );
}
