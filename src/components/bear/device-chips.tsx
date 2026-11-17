import clsx from "clsx";
import { BatteryFull, BatteryLow, BatteryMedium, MicOff } from "lucide-react";
import { LOW_BATTERY_PCT } from "@/lib/dose-rules";

const chip = "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-body-sm font-bold";

/** Device status row: connection, battery, and the "No microphone" promise. */
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
    <ul className="flex flex-wrap items-center gap-2" aria-label="Bear status">
      <li
        className={clsx(
          chip,
          online ? "border-taken/20 bg-taken-soft text-taken-ink" : "border-away/25 bg-away-soft text-away-ink",
        )}
      >
        <span className={clsx("size-[7px] rounded-full", online ? "bg-taken" : "bg-away")} aria-hidden />
        {online ? "Online" : connection === "offline" ? "Offline" : "No connection"}
        {queued > 0 && <span className="tabular ml-1 rounded-full bg-white/80 px-1.5">{queued} saved</span>}
      </li>
      <li
        className={clsx(
          chip,
          "tabular",
          low ? "border-late/30 bg-late-soft text-late-ink" : "border-line bg-white text-cocoa",
        )}
      >
        <BatteryIcon className="size-4" aria-hidden />
        {battery === null ? "—" : `${battery}%`}
        {low && <span>· low</span>}
      </li>
      <li
        className={clsx(chip, "border-line bg-white text-cocoa")}
        title="The bear has a speaker but no microphone. It never records the patient."
      >
        <MicOff className="size-3.5" aria-hidden />
        No microphone
      </li>
    </ul>
  );
}
