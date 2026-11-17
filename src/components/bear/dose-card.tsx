import { StatusPill } from "@/components/ui/status-pill";
import type { BearDoseDTO } from "@/lib/contracts/bear";
import { formatDate, formatTime } from "@/lib/time";

/** Current / next dose with its windows and the "one hold per dose time" rule (S5). */
export function DoseCard({ dose, kind }: { dose: BearDoseDTO | null; kind: "current" | "next" }) {
  if (!dose) {
    return (
      <div className="rounded-soft border border-line bg-white px-5 py-4 text-body text-muted">
        No dose scheduled in the next day.
      </div>
    );
  }
  const [clock, meridiem] = formatTime(dose.scheduledFor).split(" ");
  return (
    <div className="rounded-soft border border-line bg-white px-5 py-4 shadow-card mobile:flex mobile:items-center mobile:gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display tabular text-[30px] leading-none font-extrabold whitespace-nowrap text-cocoa">
          {clock}
          <span className="ml-1 text-eyebrow font-bold tracking-wide">{meridiem}</span>
        </p>
        <span className="mobile:hidden">
          <StatusPill status={dose.status} short />
        </span>
      </div>
      <div className="mt-3 min-w-0 flex-1 border-line mobile:mt-0 mobile:border-l mobile:pl-5">
        <p className="eyebrow text-honey-dark">
          {dose.label} dose · {kind === "current" ? "now" : formatDate(dose.scheduledFor)}
        </p>
        <p className="mt-1 text-body-lg font-bold text-cocoa">
          {dose.pillNote ? `${dose.pillNote} = 1 paw hold` : "One paw hold per dose time"}
        </p>
        <p className="tabular mt-0.5 text-body-sm text-muted">
          On time {formatTime(dose.windowStart)}–{formatTime(dose.onTimeEnd)} · Late until {formatTime(dose.lateEnd)}
          {dose.reminderCount > 0 && ` · Reminder ${dose.reminderCount} of 3`}
        </p>
      </div>
      <span className="hidden shrink-0 mobile:block">
        <StatusPill status={dose.status} short />
      </span>
    </div>
  );
}
