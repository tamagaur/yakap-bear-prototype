"use client";

import { useState } from "react";
import type { AdherenceSummaryDTO } from "@/lib/contracts/clinic";
import { formatDateKey } from "@/lib/time";

type Day = AdherenceSummaryDTO["daily"][number];

const SERIES = [
  { key: "taken", label: "Taken on time", color: "var(--color-taken)" },
  { key: "late", label: "Taken late", color: "var(--color-late)" },
  { key: "missed", label: "Missed", color: "var(--color-missed)" },
  { key: "away", label: "Away (excused)", color: "var(--color-away)" },
] as const;

/**
 * Doses per day, stacked by outcome (task D9). Status colors carry meaning
 * (taken / late / missed / away) and always come with a legend, hover
 * tooltip and a table view. 2px surface gaps separate segments.
 */
export function DailyChart({ daily }: { daily: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...daily.map((d) => d.taken + d.late + d.missed + d.away));
  const H = 168;
  // Short ranges get a label under every day; long ranges only at the ends.
  const labelEach = daily.length <= 10;
  const dayLabel = (i: number) => (i === daily.length - 1 ? "Today" : formatDateKey(daily[i].date));
  const unit = (H - 8) / max;
  const h = hover !== null ? daily[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-cocoa-700" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-bold text-cocoa-600 underline-offset-2 hover:underline"
          aria-expanded={showTable}
        >
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl ring-1 ring-cocoa-100">
          <table className="w-full text-left text-sm tabular">
            <thead className="sticky top-0 bg-cream-50 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
              <tr>
                <th scope="col" className="px-3 py-2">Day</th>
                {SERIES.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cocoa-100">
              {daily.map((d) => (
                <tr key={d.date}>
                  <th scope="row" className="px-3 py-1.5 font-semibold">{formatDateKey(d.date)}</th>
                  <td className="px-3 py-1.5">{d.taken}</td>
                  <td className="px-3 py-1.5">{d.late}</td>
                  <td className="px-3 py-1.5">{d.missed}</td>
                  <td className="px-3 py-1.5">{d.away}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-4">
          <div className="flex items-end gap-[3px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {daily.map((d, i) => {
              const total = d.taken + d.late + d.missed + d.away;
              return (
                <button
                  key={d.date}
                  type="button"
                  className="group relative flex h-full flex-1 flex-col justify-end focus:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${formatDateKey(d.date)}: ${d.taken} on time, ${d.late} late, ${d.missed} missed, ${d.away} away`}
                >
                  {total === 0 ? (
                    <span className="block h-1 rounded-full bg-cocoa-100" />
                  ) : (
                    <span className="flex flex-col-reverse gap-[2px]">
                      {SERIES.map((s, idx) => {
                        const v = d[s.key];
                        if (!v) return null;
                        const isTop = SERIES.slice(idx + 1).every((t) => !d[t.key]);
                        return (
                          <span
                            key={s.key}
                            className="block w-full"
                            style={{
                              height: Math.max(3, v * unit - 2),
                              background: s.color,
                              borderRadius: isTop ? "4px 4px 0 0" : 0,
                              opacity: hover === null || hover === i ? 1 : 0.45,
                            }}
                          />
                        );
                      })}
                    </span>
                  )}
                  <span className="pointer-events-none absolute inset-x-0 -inset-y-1 rounded-md ring-honey-500 group-focus-visible:ring-2" />
                </button>
              );
            })}
          </div>
          {labelEach ? (
            <div className="mt-1.5 flex gap-[3px] text-[11px] font-semibold text-cocoa-500 tabular">
              {daily.map((d, i) => (
                <span key={d.date} className={i === daily.length - 1 ? "flex-1 text-center font-bold text-cocoa-700" : "flex-1 text-center"}>
                  {dayLabel(i)}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-cocoa-500 tabular">
              <span>{daily[0] && formatDateKey(daily[0].date)}</span>
              <span className="font-bold text-cocoa-700">Today</span>
            </div>
          )}
          <p className="mt-2 text-[11px] font-semibold text-cocoa-500">Today shows only doses already logged, missed or excused; later doses appear once they happen.</p>
          {h && hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 w-44 -translate-x-1/2 -translate-y-full rounded-xl bg-cocoa-900 px-3 py-2 text-xs text-cream-50 shadow-lift"
              style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}
            >
              <p className="font-extrabold">{formatDateKey(h.date)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="mt-0.5 flex items-center justify-between gap-2 tabular">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
                    {s.label}
                  </span>
                  <span className="font-bold">{h[s.key]}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
