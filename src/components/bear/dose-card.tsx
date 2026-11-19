import clsx from "clsx";
import { Hand } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { BearDoseDTO } from "@/lib/contracts/bear";
import { formatDate, formatTime } from "@/lib/time";

/** On-time and late windows drawn to scale, with the dose time marked (same data as the text below it). */
function WindowBar({ dose }: { dose: BearDoseDTO }) {
  const start = Date.parse(dose.windowStart);
  const onTimeEnd = Date.parse(dose.onTimeEnd);
  const lateEnd = Date.parse(dose.lateEnd);
  const at = Date.parse(dose.scheduledFor);
  const span = Math.max(1, lateEnd - start);
  const onTimePct = ((onTimeEnd - start) / span) * 100;
  const atPct = Math.min(100, Math.max(0, ((at - start) / span) * 100));
  return (
    <div className="relative mt-4 h-2.5" aria-hidden>
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        <span className="h-full bg-taken/70" style={{ width: `${onTimePct}%` }} />
        <span className="h-full flex-1 bg-late/45" />
      </div>
      <span
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-paper bg-cocoa shadow"
        style={{ left: `${atPct}%` }}
      />
    </div>
  );
}

/** Current / next dose with its windows and the "one hold per dose time" rule (S5). */
export function DoseCard({ dose, kind }: { dose: BearDoseDTO | null; kind: "current" | "next" }) {
  if (!dose) {
    return (
      <div className="rounded-[24px] bg-paper/80 px-5 py-4 text-center text-body-lg text-muted ring-1 ring-line/70">
        No dose scheduled in the next day.
      </div>
    );
  }
  const [clock, meridiem] = formatTime(dose.scheduledFor).split(" ");
  return (
    <article className="rounded-[24px] bg-paper px-5 py-4 shadow-card ring-1 ring-line/70 mobile:px-6 mobile:py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-body-sm font-bold text-honey-dark">
            {dose.label} dose, {kind === "current" ? "now" : formatDate(dose.scheduledFor)}
          </p>
          <p className="font-display tabular mt-0.5 text-[34px] leading-none font-extrabold whitespace-nowrap text-cocoa">
            {clock}
            <span className="ml-1 text-body-lg font-bold text-muted">{meridiem}</span>
          </p>
        </div>
        <StatusPill status={dose.status} short />
      </div>

      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-body-lg font-bold text-cocoa">
        <Hand className="size-4 text-honey-dark" aria-hidden />
        {dose.pillNote ? `${dose.pillNote} = 1 paw hold` : "One paw hold per dose time"}
      </p>

      <WindowBar dose={dose} />
      <div className="tabular mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-body-sm text-muted">
        <span>
          <span className="font-bold text-taken-ink">On time</span> {formatTime(dose.windowStart)} to {formatTime(dose.onTimeEnd)}
        </span>
        <span>
          <span className="font-bold text-late-ink">Late</span> until {formatTime(dose.lateEnd)}
        </span>
      </div>

      {dose.reminderCount > 0 && (
        <p className="mt-3 flex items-center gap-2 border-t border-line/70 pt-3 text-body-sm font-semibold text-cocoa-700">
          <span className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={clsx("size-2 rounded-full", n <= dose.reminderCount ? "bg-upcoming" : "bg-line")} />
            ))}
          </span>
          Reminder {dose.reminderCount} of 3
        </p>
      )}
    </article>
  );
}
