"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Read/write a single search param as client state. Writes go through the
 * History API (Next.js shallow routing): useSearchParams re-renders
 * subscribers without a server roundtrip, and replaceState keeps toggles
 * from polluting back-button history. Setting `null` removes the param.
 */
export function useUrlParam(
  key: string
): [string | null, (next: string | null) => void] {
  const searchParams = useSearchParams();
  const value = searchParams.get(key);

  const setValue = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (next === null) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const query = params.toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [key]
  );

  return [value, setValue];
}

/**
 * Boolean flag on top of useUrlParam: true ⇢ `?key=true`, false ⇢ param
 * removed, so the URL stays clean in the default state.
 */
export function useUrlFlag(key: string): [boolean, (next: boolean) => void] {
  const [raw, setRaw] = useUrlParam(key);

  const setValue = useCallback(
    (next: boolean) => setRaw(next ? "true" : null),
    [setRaw]
  );

  return [raw === "true", setValue];
}
