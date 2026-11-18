import clsx from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "./spinner";

export type Trend = { direction: "up" | "down" | "flat"; text: string; good?: boolean };

/**
 * What a KPI means, not how it should look. The same kind of number uses the
 * same tone on every page:
 *   good     healthy / completed  (on time, taken, active consents)   soft green
 *   warn     needs attention      (taken late, corrections)           warm amber
 *   critical overdue / missed     (missed doses)                      muted red
 *   info     general information  (patients, clinicians, still open)  muted blue
 *   neutral  excluded / inactive  (away mode)                         grey
 * These are the dose-status colors (taken, late, missed, upcoming, away), so
 * KPI cards, status pills and charts all read the same way.
 */
export type KpiTone = "good" | "warn" | "critical" | "info" | "neutral";

export const KPI_TONES: Record<KpiTone, { icon: string; dot: string; border: string; wash: string }> = {
  good: { icon: "bg-taken-soft text-taken-ink", dot: "bg-taken", border: "border-taken/25", wash: "from-taken-soft/60" },
  warn: { icon: "bg-late-soft text-late-ink", dot: "bg-late", border: "border-late/30", wash: "from-late-soft/70" },
  critical: {
    icon: "bg-missed-soft text-missed-ink",
    dot: "bg-missed",
    border: "border-missed/25",
    wash: "from-missed-soft/60",
  },
  info: {
    icon: "bg-upcoming-soft text-upcoming-ink",
    dot: "bg-upcoming",
    border: "border-upcoming/20",
    wash: "from-upcoming-soft/70",
  },
  neutral: { icon: "bg-away-soft text-away-ink", dot: "bg-away", border: "border-line", wash: "from-away-soft/60" },
};

/**
 * KPI card: tinted icon tile · label with a status dot · value · supporting line ·
 * optional trend (arrow + text). It floats slightly above the page; the tone
 * shows in the icon, the dot, the border and a faint wash, never in the text.
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "info",
  href,
  trend,
  loading,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
  href?: string;
  trend?: Trend | null;
  loading?: boolean;
}) {
  const t = KPI_TONES[tone];
  const TrendIcon =
    trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : ArrowRight;
  // The card adapts to its own width: icon on top when narrow, beside the text when there is room.
  const body = (
    <div className="flex flex-col items-start gap-2.5 @[15.5rem]:flex-row @[15.5rem]:gap-3.5">
      {icon && (
        <span className={clsx("grid size-[39px] shrink-0 place-items-center rounded-xl", t.icon)} aria-hidden>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-1.5 !tracking-[0.1em] text-muted">
          <span className={clsx("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
          {label}
        </p>
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
  const cls = clsx(
    "@container block h-full rounded-tile border bg-white bg-gradient-to-br to-white to-55% p-4 shadow-card @[15.5rem]:p-[18px]",
    t.border,
    t.wash,
  );
  return href ? (
    <Link
      href={href}
      className={clsx(
        cls,
        "motion-lift transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]",
      )}
    >
      {body}
    </Link>
  ) : (
    <div
      className={clsx(
        cls,
        "motion-lift transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-card-hover",
      )}
    >
      {body}
    </div>
  );
}
