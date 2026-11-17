"use client";

import clsx from "clsx";
import { useEffect } from "react";
import { useHoldGesture } from "@/hooks/use-hold-gesture";
import { HOLD_MIN_MS } from "@/lib/dose-rules";

const R = 62;
const C = 2 * Math.PI * R;

/**
 * The bear's paw (task S2): press and hold, and the ring fills linearly over
 * exactly 3 seconds. Releasing early logs nothing (the short squeeze is still
 * reported so the server's accidental-squeeze filter records the attempt).
 */
export function PawButton({
  disabled,
  onComplete,
  onRelease,
  onHoldingChange,
  flash,
  attention,
  className,
}: {
  disabled?: boolean;
  onComplete: (ms: number) => void;
  onRelease: (ms: number) => void;
  onHoldingChange?: (holding: boolean) => void;
  /** Briefly colors the ring after a result. */
  flash?: "success" | "reject" | null;
  /** Pulses to draw the eye when a dose is waiting to be logged. */
  attention?: boolean;
  className?: string;
}) {
  const { progress, holding, handlers } = useHoldGesture({ durationMs: HOLD_MIN_MS, disabled, onComplete, onRelease });
  useEffect(() => {
    onHoldingChange?.(holding);
  }, [holding, onHoldingChange]);

  const ringColor =
    flash === "success" || progress >= 1 ? "var(--color-taken)" : flash === "reject" ? "var(--color-late)" : "var(--color-honey)";
  const secondsLeft = Math.max(0, Math.ceil(((1 - progress) * HOLD_MIN_MS) / 1000));

  return (
    <button
      type="button"
      aria-label="Bear paw. Press and hold for 3 seconds after taking your medicine"
      aria-disabled={disabled || undefined}
      className={clsx(
        "no-touch-select grid size-[112px] place-items-center rounded-full outline-offset-4 transition-transform duration-200",
        holding ? "scale-95" : "hover:scale-[1.03]",
        disabled && "cursor-not-allowed opacity-60",
        attention && !holding && !disabled && "animate-attention",
        // Callers position the paw (e.g. "absolute …"); it is its own containing block either way.
        className ?? "relative",
      )}
      {...handlers}
    >
      <svg viewBox="0 0 140 140" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgb(255 253 249 / 0.85)" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={flash === "success" ? 0 : C * (1 - progress)}
          className={clsx(!holding && "transition-[stroke-dashoffset] duration-300")}
        />
      </svg>
      <span className="relative grid size-[82%] place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#a8704b,#87583d)] text-paper shadow-paw">
        <span className="flex flex-col items-center gap-0.5">
          <svg viewBox="0 0 100 80" className="h-7 w-9" aria-hidden>
            <ellipse cx="50" cy="56" rx="22" ry="18" fill="currentColor" />
            <ellipse cx="22" cy="30" rx="9" ry="11" fill="currentColor" />
            <ellipse cx="40" cy="17" rx="9" ry="11" fill="currentColor" />
            <ellipse cx="60" cy="17" rx="9" ry="11" fill="currentColor" />
            <ellipse cx="78" cy="30" rx="9" ry="11" fill="currentColor" />
          </svg>
          <span className="tabular text-[11px] font-extrabold tracking-[0.08em]">
            {holding ? (progress >= 1 ? "DONE" : `${secondsLeft}s`) : "HOLD"}
          </span>
        </span>
      </span>
    </button>
  );
}
