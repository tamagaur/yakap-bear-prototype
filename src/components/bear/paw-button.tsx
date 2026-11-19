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
        "no-touch-select grid size-[112px] place-items-center rounded-full outline-offset-4 transition-transform duration-200 ease-out",
        holding ? "scale-[0.94]" : "hover:scale-[1.04]",
        disabled && "cursor-not-allowed opacity-60 grayscale-[0.4]",
        attention && !holding && !disabled && "animate-attention",
        // Callers position the paw (e.g. "absolute …"); it is its own containing block either way.
        className ?? "relative",
      )}
      {...handlers}
    >
      <span className="absolute inset-0 rounded-full bg-paper shadow-soft ring-1 ring-line/60" aria-hidden />
      <svg viewBox="0 0 140 140" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-cream-deep)" strokeWidth="9" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={flash === "success" ? 0 : C * (1 - progress)}
          className={clsx(!holding && "transition-[stroke-dashoffset] duration-300")}
        />
      </svg>
      {/* plush paw: caramel fur, cream pad and toe beans */}
      <span className="relative grid size-[76%] place-items-center rounded-full bg-[radial-gradient(circle_at_38%_30%,#e2a467,#b8743f_70%,#9c5f33)] shadow-[inset_0_-6px_12px_rgb(80_45_20/0.25),inset_0_4px_8px_rgb(255_235_205/0.35)]">
        <span className="flex flex-col items-center">
          <svg viewBox="0 0 100 84" className="h-9 w-10 drop-shadow-[0_1px_0_rgb(90_50_25/0.25)]" aria-hidden>
            <ellipse cx="50" cy="57" rx="23" ry="19" fill="#f6dcb6" />
            <ellipse cx="21" cy="31" rx="9.5" ry="11.5" fill="#f6dcb6" />
            <ellipse cx="40" cy="16" rx="9.5" ry="11.5" fill="#f6dcb6" />
            <ellipse cx="60" cy="16" rx="9.5" ry="11.5" fill="#f6dcb6" />
            <ellipse cx="79" cy="31" rx="9.5" ry="11.5" fill="#f6dcb6" />
          </svg>
          <span className="tabular mt-0.5 rounded-full bg-[rgb(70_38_18/0.28)] px-2 py-px text-[11px] font-extrabold tracking-[0.06em] text-[#fff6ea]">
            {holding ? (progress >= 1 ? "Done" : `${secondsLeft}s`) : "Hold"}
          </span>
        </span>
      </span>
    </button>
  );
}
