import { Pill as PillIcon } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { BearDoseDTO } from "@/lib/contracts/bear";
import { formatDate, formatTime } from "@/lib/time";

/** Current / next dose with its windows and the "one hold per dose time" rule (S5). */
export function DoseCard({ dose, kind }: { dose: BearDoseDTO | null; kind: "current" | "next" }) {
  if (!dose) {
    return (
      <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-cocoa-600 ring-1 ring-cocoa-200">
        No dose scheduled in the next day.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-cocoa-200">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-cocoa-500">
            {kind === "current" ? "This dose" : "Next dose"} · {formatDate(dose.scheduledFor)}
          </p>
          <p className="text-lg font-black text-cocoa-900 tabular">
            {formatTime(dose.scheduledFor)} <span className="text-base font-bold text-cocoa-600">· {dose.label}</span>
          </p>
        </div>
        <StatusPill status={dose.status} short />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-cocoa-600 tabular">
        <span>
          On time {formatTime(dose.windowStart)}–{formatTime(dose.onTimeEnd)}
        </span>
        <span>Late until {formatTime(dose.lateEnd)}</span>
        {dose.reminderCount > 0 && <span>Reminder {dose.reminderCount} of 3</span>}
      </div>
      {dose.pillNote && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-honey-200 px-2.5 py-1 text-xs font-extrabold text-cocoa-800">
          <PillIcon className="size-3.5" aria-hidden />
          {dose.pillNote} = 1 hold
        </p>
      )}
    </div>
  );
}
