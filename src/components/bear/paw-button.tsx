"use client";

import clsx from "clsx";
import { useHoldGesture } from "@/hooks/use-hold-gesture";
import { HOLD_MIN_MS } from "@/lib/dose-rules";

const R = 60;
const C = 2 * Math.PI * R;

/**
 * The bear's paw (task S2): press and hold — the ring fills over 3 seconds.
 * Release early → nothing is logged (the short squeeze is still reported so
 * the server's accidental-squeeze filter can record it as an attempt).
 */
export function PawButton({
  disabled,
  onComplete,
  onRelease,
  flash,
  className,
}: {
  disabled?: boolean;
  onComplete: (ms: number) => void;
  onRelease: (ms: number) => void;
  /** Briefly colors the ring after a result. */
  flash?: "success" | "reject" | null;
  className?: string;
}) {
  const { progress, holding, handlers } = useHoldGesture({ durationMs: HOLD_MIN_MS, disabled, onComplete, onRelease });
  const ringColor =
    flash === "success" || progress >= 1
      ? "var(--color-taken)"
      : flash === "reject"
        ? "var(--color-missed)"
        : "var(--color-honey-500)";
  const seconds = Math.min(3, (progress * HOLD_MIN_MS) / 1000);

  return (
    <div className={clsx("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        aria-label="Bear paw — press and hold for 3 seconds after taking your medicine"
        aria-disabled={disabled || undefined}
        className={clsx(
          "no-touch-select relative grid size-32 place-items-center rounded-full outline-offset-4 transition-transform sm:size-36",
          holding ? "scale-95" : "hover:scale-[1.03]",
          disabled && "opacity-60 cursor-not-allowed",
        )}
        {...handlers}
      >
        <svg viewBox="0 0 140 140" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-cream-200)" strokeWidth="9" />
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
        <svg viewBox="0 0 100 100" className="relative size-[74%] drop-shadow-[0_6px_8px_rgb(59_38_24/0.25)]" aria-hidden>
          <circle cx="50" cy="50" r="48" fill="var(--color-fur-dark)" />
          <circle cx="50" cy="50" r="48" fill="url(#paw-sheen)" />
          <defs>
            <radialGradient id="paw-sheen" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="61" rx="20" ry="16" fill="var(--color-paw-pad)" />
          <ellipse cx="27" cy="38" rx="8" ry="10" fill="var(--color-paw-pad)" />
          <ellipse cx="42" cy="27" rx="8" ry="10" fill="var(--color-paw-pad)" />
          <ellipse cx="58" cy="27" rx="8" ry="10" fill="var(--color-paw-pad)" />
          <ellipse cx="73" cy="38" rx="8" ry="10" fill="var(--color-paw-pad)" />
        </svg>
      </button>
      <span
        className={clsx(
          "rounded-full px-3 py-1 text-xs font-extrabold tabular transition-colors",
          holding ? "bg-honey-400 text-cocoa-900" : "bg-white/90 text-cocoa-700 ring-1 ring-cocoa-200",
        )}
        aria-live="polite"
      >
        {holding ? (progress >= 1 ? "Done — you can let go" : `Keep holding… ${seconds.toFixed(1)} s`) : "Hold 3 seconds"}
      </span>
    </div>
  );
}
