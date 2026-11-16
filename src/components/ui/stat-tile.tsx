import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

/** Stat tile: label · value · supporting line. Optionally links somewhere. */
export function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  /** Tailwind classes for the icon badge, e.g. "bg-taken-soft text-taken-ink". */
  accent: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm font-bold text-cocoa-600">
        <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg", accent)} aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-3xl font-black text-cocoa-900 tabular">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-cocoa-500">{sub}</p>}
    </>
  );
  const cls = "block rounded-2xl bg-white p-4 ring-1 ring-cocoa-200/70";
  return href ? (
    <Link href={href} className={clsx(cls, "transition-shadow hover:shadow-soft hover:ring-cocoa-300")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
