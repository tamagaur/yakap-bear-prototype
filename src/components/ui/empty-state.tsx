import { Building2, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Bear, type BearExpression } from "../bear/bear-figure";

export type EmptyArt = BearExpression | "lock" | "neutral";

/**
 * Illustration + heading + plain explanation + optional action.
 * happy/proud = good news · puzzled = no data · sleepy = away or paused ·
 * lock = no consent · neutral = not available here.
 */
export function EmptyState({
  title,
  children,
  action,
  art,
  mood,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  art?: EmptyArt;
  /** Earlier prop; "calm" maps to the puzzled bear. */
  mood?: "happy" | "calm" | "sleepy";
}) {
  const kind: EmptyArt = art ?? (mood === "happy" ? "happy" : mood === "sleepy" ? "sleepy" : "puzzled");
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {kind === "lock" ? (
        <span className="grid size-[68px] place-items-center rounded-[20px] bg-lavender text-cocoa" aria-hidden>
          <Lock className="size-7" />
        </span>
      ) : kind === "neutral" ? (
        <span className="grid size-[68px] place-items-center rounded-[20px] bg-cream text-muted" aria-hidden>
          <Building2 className="size-7" />
        </span>
      ) : (
        <Bear expression={kind} className="w-24" />
      )}
      <h3 className="mt-4 text-[17px] font-bold text-cocoa">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-body text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
