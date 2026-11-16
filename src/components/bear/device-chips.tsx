import clsx from "clsx";
import { BatteryFull, BatteryLow, BatteryMedium, MicOff, Wifi, WifiOff } from "lucide-react";
import { LOW_BATTERY_PCT } from "@/lib/dose-rules";

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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1",
          connection === "online" ? "bg-taken-soft text-taken-ink ring-taken/20" : "bg-away-soft text-away-ink ring-away/20",
        )}
      >
        {connection === "online" ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
        {connection === "online" ? "Online" : connection === "offline" ? "Offline" : "No connection"}
        {queued > 0 && <span className="ml-1 rounded-full bg-white/80 px-1.5 tabular">{queued} saved</span>}
      </span>
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 tabular",
          low ? "bg-late-soft text-late-ink ring-late/30 animate-pulse" : "bg-white text-cocoa-700 ring-cocoa-200",
        )}
      >
        <BatteryIcon className="size-4" aria-hidden />
        {battery === null ? "—" : `${battery}%`}
        {low && <span className="sr-only">Low battery</span>}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-cocoa-900 px-3 py-1 text-xs font-bold text-cream-50"
        title="The bear has no microphone. It never records the patient's voice."
      >
        <MicOff className="size-3.5 text-honey-300" aria-hidden />
        No microphone
      </span>
    </div>
  );
}
