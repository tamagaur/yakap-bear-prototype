import clsx from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "./spinner";

export type Trend = { direction: "up" | "down" | "flat"; text: string; good?: boolean };

/** Stat tile: icon tile · label · value · supporting line · optional trend (arrow + text). */
export function StatTile({
  label,
  value,
  sub,
  icon,
  accent = "bg-cream text-cocoa-700",
  href,
  trend,
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** Classes for the icon tile, e.g. "bg-mint text-teal". */
  accent?: string;
  href?: string;
  trend?: Trend | null;
  loading?: boolean;
}) {
  const TrendIcon =
    trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : ArrowRight;
  const body = (
    <div className="flex items-start gap-3.5">
      {icon && (
        <span className={clsx("grid size-[39px] shrink-0 place-items-center rounded-xl", accent)} aria-hidden>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="eyebrow !tracking-[0.1em] text-muted">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p className="font-display tabular mt-1 text-2xl leading-tight font-extrabold text-cocoa">{value ?? "—"}</p>
        )}
        {sub && !loading && <p className="mt-0.5 text-body-sm text-muted">{sub}</p>}
        {trend && !loading && (
          <p
            className={clsx(
              "mt-1 inline-flex items-center gap-1 text-body-sm font-semibold",
              trend.good === undefined ? "text-muted" : trend.good ? "text-taken-ink" : "text-missed-ink",
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden />
            {trend.text}
          </p>
        )}
      </div>
    </div>
  );
  const cls = "block rounded-tile border border-line bg-white p-[18px] shadow-card";
  return href ? (
    <Link href={href} className={clsx(
        cls,
        "motion-lift transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]",
      )}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
