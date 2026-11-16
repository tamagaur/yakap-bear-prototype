"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

/**
 * Press-and-hold gesture for the bear's paw (task S2).
 * - Mouse, touch and pen via Pointer Events (pointer capture keeps the hold
 *   alive if the finger drifts); keyboard via Space/Enter.
 * - Completing the hold fires `onComplete(ms)` immediately at `durationMs`.
 * - Releasing early (or pointer cancel / focus loss) fires `onRelease(ms)`.
 */
export function useHoldGesture({
  durationMs = 3000,
  disabled = false,
  onComplete,
  onRelease,
}: {
  durationMs?: number;
  disabled?: boolean;
  onComplete: (heldMs: number) => void;
  onRelease: (heldMs: number) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const frame = useRef<number | null>(null);
  const cbs = useRef({ onComplete, onRelease });
  useEffect(() => {
    cbs.current = { onComplete, onRelease };
  }, [onComplete, onRelease]);

  const begin = useCallback(() => {
    if (disabled || startedAt.current !== null) return;
    startedAt.current = performance.now();
    completed.current = false;
    setHolding(true);
    const tick = () => {
      if (startedAt.current === null) return;
      const elapsed = performance.now() - startedAt.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p >= 1 && !completed.current) {
        completed.current = true;
        cbs.current.onComplete(Math.round(elapsed));
        return; // ring stays full until release
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [disabled, durationMs]);

  const end = useCallback(() => {
    if (startedAt.current === null) return;
    const elapsed = performance.now() - startedAt.current;
    startedAt.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    setHolding(false);
    setProgress(0);
    if (!completed.current) cbs.current.onRelease(Math.round(elapsed));
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      begin();
    },
    onPointerUp: () => end(),
    onPointerCancel: () => end(),
    onLostPointerCapture: () => end(),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        begin();
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        end();
      }
    },
    onBlur: () => end(),
  };

  return { progress, holding, handlers };
}
