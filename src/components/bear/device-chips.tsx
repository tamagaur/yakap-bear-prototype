import clsx from "clsx";
import { BatteryFull, BatteryLow, BatteryMedium, MicOff } from "lucide-react";
import { LOW_BATTERY_PCT } from "@/lib/dose-rules";

const chip = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-body-sm font-bold whitespace-nowrap";

/** Device status strip: connection, battery, and the "No microphone" promise. */
export function DeviceChips({
  connection,
  battery,
  queued,
}: {
  connection: "online" | "offline" | "error";
  battery: number | null;
  queued: number;
}) {
  const low = battery !== null && battery <= LOW_BATTERY_PCT;
  const BatteryIcon = battery === null ? BatteryMedium : low ? BatteryLow : battery > 60 ? BatteryFull : BatteryMedium;
  const online = connection === "online";
  return (
    <ul
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-paper/85 p-1 shadow-card ring-1 ring-line/70 backdrop-blur"
      aria-label="Bear status"
    >
      <li className={clsx(chip, online ? "bg-taken-soft text-taken-ink" : "bg-away-soft text-away-ink")}>
        <span className="relative grid size-2 place-items-center" aria-hidden>
          {online && <span className="absolute inset-0 animate-ping-soft rounded-full bg-taken" />}
          <span className={clsx("relative size-2 rounded-full", online ? "bg-taken" : "bg-away")} />
        </span>
        {online ? "Online" : connection === "offline" ? "Offline" : "No connection"}
        {queued > 0 && <span className="tabular rounded-full bg-paper px-1.5 text-[11px]">{queued} saved</span>}
      </li>
      <li className={clsx(chip, "tabular", low ? "bg-late-soft text-late-ink" : "text-cocoa")}>
        <BatteryIcon className="size-4" aria-hidden />
        {battery === null ? "—" : `${battery}%`}
        {low && <span className="font-semibold">low</span>}
      </li>
      <li className={clsx(chip, "text-cocoa-700")} title="The bear has a speaker but no microphone. It never records the patient.">
        <MicOff className="size-3.5" aria-hidden />
        No microphone
      </li>
    </ul>
  );
}
