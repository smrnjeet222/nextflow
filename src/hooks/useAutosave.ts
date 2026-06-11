"use client";

import { useEffect, useRef, useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { useSaveWorkflowMutation } from "@/lib/queries";
import {
  stripRuntimeNodeState,
  WorkflowNodeInput,
  WorkflowEdgeInput,
} from "@/validators/workflow";

const AUTOSAVE_DEBOUNCE_MS = 1200;
const RETRY_WHILE_IN_FLIGHT_MS = 300;
const HYDRATION_GRACE_MS = 500;

/**
 * Debounced autosave of graph + viewport. The debounce timer lives outside
 * the mutation on purpose — an effect on [nodes, edges, viewport] is a write
 * trigger, the honest exception to no-fetch-in-effect.
 *
 * Saves are serialized latest-wins: if a PATCH is still in flight when the
 * timer fires, it re-arms instead of racing a second request. Runtime fields
 * (status/output/error/duration) are stripped from the payload — the
 * executor is the sole writer of persisted runtime state.
 *
 * Returns the combined "Saving…" flag for the TopBar.
 */
export function useAutosave(workflowId: string): boolean {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const viewport = useFlowStore((s) => s.viewport);

  const { mutateAsync, isPending } = useSaveWorkflowMutation(workflowId);
  const [debouncePending, setDebouncePending] = useState(false);
  const hydratedRef = useRef(false);
  const inFlightRef = useRef(false);

  // Allow autosave only after hydration has rendered, so loading the
  // workflow into the store doesn't immediately save it back.
  useEffect(() => {
    hydratedRef.current = false;
    const t = setTimeout(() => {
      hydratedRef.current = true;
    }, HYDRATION_GRACE_MS);
    return () => clearTimeout(t);
  }, [workflowId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setDebouncePending(true);

    let timer: NodeJS.Timeout;
    const fire = async () => {
      if (inFlightRef.current) {
        timer = setTimeout(fire, RETRY_WHILE_IN_FLIGHT_MS);
        return;
      }
      setDebouncePending(false);
      inFlightRef.current = true;
      try {
        await mutateAsync({
          nodes: stripRuntimeNodeState(nodes as unknown as WorkflowNodeInput[]),
          edges: edges as unknown as WorkflowEdgeInput[],
          viewport,
        });
      } catch (err) {
        console.error("Failed to auto-save workflow:", err);
      } finally {
        inFlightRef.current = false;
      }
    };
    timer = setTimeout(fire, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [nodes, edges, viewport, workflowId, mutateAsync]);

  return debouncePending || isPending;
}
