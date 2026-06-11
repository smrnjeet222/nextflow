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
 * Debounced autosave of the graph. The debounce timer lives outside the
 * mutation on purpose — an effect on [nodes, edges] is a write trigger,
 * the honest exception to no-fetch-in-effect.
 *
 * Saves are serialized latest-wins: if a PATCH is still in flight when the
 * timer fires, it re-arms instead of racing a second request. Runtime fields
 * (status/output/error/duration) are stripped from the payload — the
 * executor is the sole writer of persisted runtime state.
 *
 * Two classes of churn never reach Postgres:
 * - runtime paints during a run change the nodes array identity without
 *   changing anything we persist, so the stripped payload is diffed against
 *   the last saved snapshot and identical payloads are dropped;
 * - viewport pans/zooms don't trigger saves at all. The current viewport
 *   piggybacks on graph saves and is otherwise flushed exactly once on exit
 *   (unmount or pagehide) via a keepalive PATCH.
 *
 * Returns the combined "Saving…" flag for the TopBar.
 */
export function useAutosave(workflowId: string): boolean {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  const { mutateAsync, isPending } = useSaveWorkflowMutation(workflowId);
  const [debouncePending, setDebouncePending] = useState(false);
  const hydratedRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);
  const lastSavedViewportRef = useRef<string | null>(null);

  // Allow autosave only after hydration has rendered, so loading the
  // workflow into the store doesn't immediately save it back.
  useEffect(() => {
    hydratedRef.current = false;
    lastSavedRef.current = null;
    lastSavedViewportRef.current = null;
    const t = setTimeout(() => {
      hydratedRef.current = true;
    }, HYDRATION_GRACE_MS);
    return () => clearTimeout(t);
  }, [workflowId]);

  useEffect(() => {
    const graph = {
      nodes: stripRuntimeNodeState(nodes as unknown as WorkflowNodeInput[]),
      edges: edges as unknown as WorkflowEdgeInput[],
    };
    const snapshot = JSON.stringify(graph);

    if (!hydratedRef.current) {
      // Baseline: what the store hydrated to is by definition already saved.
      lastSavedRef.current = snapshot;
      lastSavedViewportRef.current = JSON.stringify(useFlowStore.getState().viewport);
      return;
    }
    if (snapshot === lastSavedRef.current) return;

    setDebouncePending(true);

    let timer: NodeJS.Timeout;
    const fire = async () => {
      if (inFlightRef.current) {
        timer = setTimeout(fire, RETRY_WHILE_IN_FLIGHT_MS);
        return;
      }
      setDebouncePending(false);
      inFlightRef.current = true;
      // Viewport rides along at whatever it is right now, so a graph save
      // also brings the persisted viewport up to date.
      const viewport = useFlowStore.getState().viewport;
      try {
        await mutateAsync({ ...graph, viewport });
        lastSavedRef.current = snapshot;
        lastSavedViewportRef.current = JSON.stringify(viewport);
      } catch (err) {
        console.error("Failed to auto-save workflow:", err);
      } finally {
        inFlightRef.current = false;
      }
    };
    timer = setTimeout(fire, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflowId, mutateAsync]);

  // Viewport persistence on exit only: pagehide covers tab close/refresh,
  // the effect cleanup covers SPA navigation away from the editor.
  useEffect(() => {
    const flushViewport = () => {
      const viewport = useFlowStore.getState().viewport;
      const snapshot = JSON.stringify(viewport);
      if (snapshot === lastSavedViewportRef.current) return;
      lastSavedViewportRef.current = snapshot;
      // keepalive lets the request outlive the page; sendBeacon can't PATCH.
      void fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewport }),
        keepalive: true,
      }).catch(() => {
        /* page is going away; nothing to recover */
      });
    };

    window.addEventListener("pagehide", flushViewport);
    return () => {
      window.removeEventListener("pagehide", flushViewport);
      flushViewport();
    };
  }, [workflowId]);

  return debouncePending || isPending;
}
