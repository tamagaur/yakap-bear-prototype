"use client";

import { useState } from "react";
import type { PatternDTO } from "@/lib/contracts/clinic";
import { formatTimeOfDay, WEEKDAYS_LONG } from "@/lib/time";

// Monday-first reading order; indices into the API's Sunday-first rows.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Sequential single-hue ramp (rose) for the missed-dose rate. */
const RAMP = [
  { max: 0, bg: "#f6f1eb", ink: "var(--color-cocoa-500)" },
  { max: 0.2, bg: "#f7d9d5", ink: "var(--color-cocoa-900)" },
  { max: 0.4, bg: "#eeb0a9", ink: "var(--color-cocoa-900)" },
  { max: 0.6, bg: "#de7a71", ink: "#ffffff" },
  { max: 1, bg: "#b23a32", ink: "#ffffff" },
];
const shade = (rate: number) => RAMP.find((r) => rate <= r.max) ?? RAMP[RAMP.length - 1];

/**
 * Weekday × dose-time heatmap of missed doses (task D10). Simple counts — no
 * ML. Every cell shows "missed / total" as text, so color is never the only
 * cue; hover/focus shows the full breakdown.
 */
export function PatternHeatmap({ pattern }: { pattern: PatternDTO }) {
  const [focus, setFocus] = useState<{ w: number; t: number } | null>(null);
  if (pattern.times.length === 0) return null;
  const f = focus ? pattern.cells[focus.w][focus.t] : null;

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-[3px] text-sm">
          <caption className="sr-only">
            Missed doses by weekday and dose time over the last {pattern.days} days. Each cell shows missed out of total doses.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-28 text-left text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                Day
              </th>
              {pattern.times.map((t) => (
                <th key={t.timeOfDay} scope="col" className="px-1 pb-1 text-center text-xs font-extrabold text-cocoa-700">
                  {formatTimeOfDay(t.timeOfDay)}
                  <span className="block text-[11px] font-semibold text-cocoa-500">{t.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDER.map((w) => (
              <tr key={w}>
                <th scope="row" className="pr-2 text-left text-sm font-bold text-cocoa-700">
                  {WEEKDAYS_LONG[w]}
                </th>
                {pattern.cells[w].map((c, t) => {
                  const rate = c.total ? c.missed / c.total : 0;
                  const s = shade(rate);
                  return (
                    <td key={t} className="p-0">
                      <button
                        type="button"
                        onMouseEnter={() => setFocus({ w, t })}
                        onMouseLeave={() => setFocus(null)}
                        onFocus={() => setFocus({ w, t })}
                        onBlur={() => setFocus(null)}
                        className="h-11 w-full rounded-lg text-center text-sm font-extrabold tabular transition-transform hover:scale-[1.04] focus-visible:scale-[1.04]"
                        style={{ background: s.bg, color: s.ink }}
                        aria-label={`${WEEKDAYS_LONG[w]} ${formatTimeOfDay(pattern.times[t].timeOfDay)}: ${c.missed} missed of ${c.total}, ${c.late} late`}
                      >
                        {c.total ? `${c.missed}/${c.total}` : "–"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-cocoa-600" aria-hidden>
          <span>Missed rate</span>
          <span className="flex overflow-hidden rounded-md">
            {RAMP.map((r) => (
              <span key={r.max} className="h-3 w-8" style={{ background: r.bg }} />
            ))}
          </span>
          <span>0% → 100%</span>
        </div>
        <p className="min-h-5 text-xs font-semibold text-cocoa-700 tabular" role="status">
          {f && focus
            ? `${WEEKDAYS_LONG[focus.w]} ${formatTimeOfDay(pattern.times[focus.t].timeOfDay)} — ${f.missed} missed, ${f.late} late, ${f.taken} on time (of ${f.total})`
            : "Hover or focus a cell for details."}
        </p>
      </div>
    </div>
  );
}
