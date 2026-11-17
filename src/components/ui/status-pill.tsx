import clsx from "clsx";
import type { ReactNode } from "react";
import type { DoseStatusT } from "@/lib/contracts/common";
import { STATUS_META, TONE_CLASSES, type Tone } from "@/lib/status";

const BASE = "inline-flex items-center rounded-full font-bold whitespace-nowrap";
const SIZE = {
  md: "gap-1.5 px-[9px] py-[5px] text-eyebrow leading-none",
  compact: "gap-1 px-2 py-1 text-[11px] leading-none",
};

/** Dose status: always a dot plus a text label, never color alone. */
export function StatusPill({
  status,
  short = false,
  compact = false,
  className,
}: {
  status: DoseStatusT;
  short?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={clsx(BASE, SIZE[compact ? "compact" : "md"], tone.pill, className)}>
      <span className={clsx("size-[7px] shrink-0 rounded-full", tone.dot)} aria-hidden />
      {short ? meta.short : meta.label}
    </span>
  );
}

/** Generic pill for non-dose states: online, offline, consent active, warning, service… */
export function Pill({
  tone = "neutral",
  dot = false,
  icon,
  compact = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span className={clsx(BASE, SIZE[compact ? "compact" : "md"], t.pill, className)}>
      {dot && <span className={clsx("size-[7px] shrink-0 rounded-full", t.dot)} aria-hidden />}
      {icon}
      {children}
    </span>
  );
}
