import clsx from "clsx";
import type { DoseStatusT } from "@/lib/contracts/common";
import { STATUS_META, TONE_CLASSES, type Tone } from "@/lib/status";

export function StatusPill({
  status,
  short = false,
  className,
}: {
  status: DoseStatusT;
  short?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        tone.pill,
        className,
      )}
    >
      <span className={clsx("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {short ? meta.short : meta.label}
    </span>
  );
}

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
        TONE_CLASSES[tone].pill,
        className,
      )}
    >
      {children}
    </span>
  );
}
