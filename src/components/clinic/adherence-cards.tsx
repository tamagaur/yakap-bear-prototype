import { CalendarOff, CheckCircle2, Clock4, XCircle } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import type { AdherenceSummaryDTO } from "@/lib/contracts/clinic";

/** Adherence KPI cards (task D9). Away doses are excluded from percentages. */
export function AdherenceCards({ s }: { s: AdherenceSummaryDTO }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        tone="good"
        label="Taken on time"
        value={s.onTimePct === null ? "—" : `${s.onTimePct}%`}
        sub={`${s.taken} of ${s.counted} doses`}
        icon={<CheckCircle2 className="size-4" />}
      />
      <StatTile
        tone="warn"
        label="Taken late"
        value={s.late}
        sub={s.counted ? `${Math.round((s.late / s.counted) * 100)}% of doses` : "no doses yet"}
        icon={<Clock4 className="size-4" />}
      />
      <StatTile
        tone="critical"
        label="Missed"
        value={s.missed}
        sub={s.counted ? `${Math.round((s.missed / s.counted) * 100)}% of doses` : "no doses yet"}
        icon={<XCircle className="size-4" />}
      />
      <StatTile
        tone="neutral"
        label="Away (excluded)"
        value={s.away}
        sub="not counted in percentages"
        icon={<CalendarOff className="size-4" />}
      />
    </div>
  );
}
