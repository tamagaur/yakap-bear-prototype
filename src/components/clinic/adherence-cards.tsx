import clsx from "clsx";
import { CalendarOff, CheckCircle2, Clock4, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { AdherenceSummaryDTO } from "@/lib/contracts/clinic";

function Tile({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-cocoa-200/70">
      <div className="flex items-center gap-2 text-sm font-bold text-cocoa-600">
        <span className={clsx("grid size-7 place-items-center rounded-lg", accent)} aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-3xl font-black text-cocoa-900 tabular">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-cocoa-500">{sub}</p>
    </div>
  );
}

/** Adherence stat tiles (task D9). Away doses are excluded from percentages. */
export function AdherenceCards({ s }: { s: AdherenceSummaryDTO }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Taken on time"
        value={s.onTimePct === null ? "—" : `${s.onTimePct}%`}
        sub={`${s.taken} of ${s.counted} doses`}
        icon={<CheckCircle2 className="size-4" />}
        accent="bg-taken-soft text-taken-ink"
      />
      <Tile
        label="Taken late"
        value={s.late}
        sub={s.counted ? `${Math.round((s.late / s.counted) * 100)}% of doses` : "no doses yet"}
        icon={<Clock4 className="size-4" />}
        accent="bg-late-soft text-late-ink"
      />
      <Tile
        label="Missed"
        value={s.missed}
        sub={s.counted ? `${Math.round((s.missed / s.counted) * 100)}% of doses` : "no doses yet"}
        icon={<XCircle className="size-4" />}
        accent="bg-missed-soft text-missed-ink"
      />
      <Tile
        label="Away (excluded)"
        value={s.away}
        sub="not counted in percentages"
        icon={<CalendarOff className="size-4" />}
        accent="bg-away-soft text-away-ink"
      />
    </div>
  );
}
