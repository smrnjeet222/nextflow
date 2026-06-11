"use client";

import { useEffect, useRef, TextareaHTMLAttributes } from "react";

const MAX_HEIGHT_PX = 240;

/**
 * Textarea that grows with its content (up to MAX_HEIGHT_PX, then scrolls).
 * Carries the React Flow `nodrag` / `nowheel` classes so typing, text
 * selection and scrolling stay inside the field instead of panning/zooming
 * the canvas or dragging the node.
 */
export default function AutoResizeTextarea({
  className = "",
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, MAX_HEIGHT_PX)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={`nodrag nowheel resize-none overflow-y-auto ${className}`}
      {...props}
    />
  );
}
