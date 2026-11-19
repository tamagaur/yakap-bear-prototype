"use client";

import clsx from "clsx";
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Check,
  CircleSlash,
  Clock3,
  FastForward,
  Info,
  Lock,
  RefreshCw,
  RotateCcw,
  SkipForward,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LedColor } from "@/components/bear/bear-figure";
import { HEART_LIGHT } from "@/components/bear/heart-light";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import type { ConsoleEntry, ConsoleKind } from "@/hooks/use-bear-device";
import type { DoseStatusT } from "@/lib/contracts/common";
import type { ClockAction, DemoDeviceDTO } from "@/lib/contracts/demo";
import { LOW_BATTERY_PCT } from "@/lib/dose-rules";
import { WEEKDAYS_LONG, formatTime, manilaWeekday } from "@/lib/time";

const KIND: Record<ConsoleKind, { label: string; text: string; badge: string; icon: ReactNode }> = {
  ok: { label: "Logged", text: "text-taken-ink", badge: "bg-taken-soft text-taken-ink", icon: <Check className="size-3.5" /> },
  reject: { label: "Not logged", text: "text-late-ink", badge: "bg-late-soft text-late-ink", icon: <CircleSlash className="size-3.5" /> },
  info: { label: "Info", text: "text-upcoming-ink", badge: "bg-upcoming-soft text-upcoming-ink", icon: <Info className="size-3.5" /> },
  warn: { label: "Heads up", text: "text-missed-ink", badge: "bg-missed-soft text-missed-ink", icon: <TriangleAlert className="size-3.5" /> },
  sync: { label: "Sync", text: "text-teal", badge: "bg-mint text-teal", icon: <RefreshCw className="size-3.5" /> },
};

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[22px] bg-paper p-4 shadow-card ring-1 ring-line/60 mobile:p-5", className)}>
      <div className="mb-3.5 flex min-h-6 items-center justify-between gap-3">
        <h3 className="font-display text-body-lg font-extrabold text-cocoa">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-cream/70 px-3.5 py-3">
      <p className="text-body-sm font-semibold text-muted">{label}</p>
      <div className="mt-1 flex min-h-7 items-center gap-2 text-body-lg font-bold text-cocoa">{children}</div>
    </div>
  );
}

/** One presenter shortcut: icon, what it does, and a one-line hint. */
function MomentButton({
  icon,
  label,
  hint,
  tint,
  busy,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  tint: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className="group flex min-h-[60px] items-center gap-3 rounded-2xl bg-cream/70 p-3 text-left ring-1 ring-transparent transition-[background-color,box-shadow,transform] duration-200 hover:bg-cream hover:ring-line active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={clsx("grid size-9 shrink-0 place-items-center rounded-xl", tint)} aria-hidden>
        {busy ? <Spinner className="size-4" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-body-lg font-bold text-cocoa">{label}</span>
        <span className="mt-0.5 block text-body-sm leading-snug text-muted">{hint}</span>
      </span>
    </button>
  );
}

/** Presenter controls (tasks S6, S7, S8, S9), kept apart from the patient's bear. */
export function DemoPanel({
  simNow,
  devices,
  deviceId,
  onSelectDevice,
  onClock,
  onReset,
  online,
  onOnline,
  battery,
  onBattery,
  queued,
  log,
  onClearLog,
  patientNickname,
  led,
  doseStatus,
}: {
  simNow: Date | null;
  devices: DemoDeviceDTO[];
  deviceId: string | null;
  onSelectDevice: (id: string) => void;
  onClock: (a: ClockAction) => Promise<void>;
  onReset: () => Promise<void>;
  online: boolean;
  onOnline: (v: boolean) => void;
  battery: number | null;
  onBattery: (n: number) => void;
  queued: number;
  log: ConsoleEntry[];
  onClearLog: () => void;
  patientNickname: string;
  /** Display only: the heart light shown on the device. */
  led?: LedColor;
  /** Display only: status of the current or next dose. */
  doseStatus?: DoseStatusT | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const dev = deviceId ?? undefined;
  const moments: { key: string; label: string; hint: string; tint: string; icon: ReactNode; go: () => Promise<void> }[] = [
    {
      key: "next",
      label: "Play reminder",
      hint: "Jump to the next dose time",
      tint: "bg-upcoming-soft text-upcoming-ink",
      icon: <SkipForward className="size-[18px]" />,
      go: () => onClock({ action: "next-dose", deviceId: dev }),
    },
    {
      key: "past",
      label: "Past window",
      hint: "Unlogged dose becomes missed, family gets a text",
      tint: "bg-missed-soft text-missed-ink",
      icon: <TriangleAlert className="size-[18px]" />,
      go: () => onClock({ action: "past-window", deviceId: dev }),
    },
    {
      key: "hour",
      label: "+1 hour",
      hint: "Move the demo clock forward",
      tint: "bg-mint text-teal",
      icon: <FastForward className="size-[18px]" />,
      go: () => onClock({ action: "advance", minutes: 60 }),
    },
    {
      key: "low",
      label: "Low battery",
      hint: "Set the battery to 15%",
      tint: "bg-late-soft text-late-ink",
      icon: <BatteryLow className="size-[18px]" />,
      go: async () => onBattery(15),
    },
  ];

  const low = battery !== null && battery <= LOW_BATTERY_PCT;
  const BatteryIcon = battery === null ? BatteryMedium : low ? BatteryLow : battery > 60 ? BatteryFull : BatteryMedium;
  const light = led ? HEART_LIGHT[led] : null;
  const device = devices.find((d) => d.id === deviceId);

  return (
    <div className="flex flex-col gap-4 px-4 py-6 mobile:px-6 tablet:px-6 tablet:py-7">
      <header className="px-1">
        <h2 className="font-display text-title-sm font-extrabold text-cocoa">Presenter console</h2>
        <p className="mt-1 text-body-lg text-muted">
          Steer the demo from here. The left side is what {patientNickname} sees and hears.
        </p>
      </header>

      {/* Device monitor: clock + live status */}
      <Section
        title="Device monitor"
        action={
          device && (
            <span className="tabular rounded-full bg-cream px-2.5 py-1 text-body-sm font-bold text-cocoa-700">{device.id}</span>
          )
        }
      >
        <div className="flex items-end justify-between gap-3 rounded-2xl bg-[linear-gradient(135deg,#2f756e,#3b8f86)] px-4 py-3.5 text-white">
          <div>
            <p className="flex items-center gap-1.5 text-body-sm font-semibold text-white/80">
              <Clock3 className="size-3.5" aria-hidden />
              Demo time in Manila
            </p>
            <p className="font-display tabular mt-0.5 text-[30px] leading-none font-extrabold" aria-live="polite">
              {simNow ? formatTime(simNow) : "—"}
            </p>
          </div>
          <p className="pb-0.5 text-body-lg font-bold text-white/90">{simNow ? WEEKDAYS_LONG[manilaWeekday(simNow)] : ""}</p>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Tile label="Connection">
            {online ? <Wifi className="size-4 text-taken" aria-hidden /> : <WifiOff className="size-4 text-away" aria-hidden />}
            {online ? "Online" : "Offline"}
            {queued > 0 && <span className="tabular rounded-full bg-paper px-1.5 text-body-sm">{queued} saved</span>}
          </Tile>
          <Tile label="Battery">
            <BatteryIcon className={clsx("size-4", low ? "text-late" : "text-taken")} aria-hidden />
            <span className="tabular">{battery === null ? "—" : `${battery}%`}</span>
            {low && <span className="rounded-full bg-late-soft px-1.5 text-body-sm text-late-ink">low</span>}
          </Tile>
          <Tile label="Heart light">
            {light ? (
              <>
                <span className={clsx("size-2.5 shrink-0 rounded-full", light.dot)} aria-hidden />
                <span className="leading-tight">{light.meaning}</span>
              </>
            ) : (
              "—"
            )}
          </Tile>
          <Tile label="Dose">{doseStatus ? <StatusPill status={doseStatus} short /> : <span className="text-muted">None soon</span>}</Tile>
        </div>
      </Section>

      <Section title="Jump to a moment">
        <div className="grid gap-2">
          {moments.map((m) => (
            <MomentButton
              key={m.key}
              icon={m.icon}
              label={m.label}
              hint={m.hint}
              tint={m.tint}
              busy={busy === m.key}
              disabled={busy !== null && busy !== m.key}
              onClick={() => run(m.key, m.go)}
            />
          ))}
        </div>
        <Button
          variant="secondary"
          full
          className="mt-2.5"
          icon={<RotateCcw className="size-4" aria-hidden />}
          disabled={busy !== null}
          onClick={() => setConfirmReset(true)}
        >
          Before dose (reset demo)
        </Button>
      </Section>

      <Section title="Simulate the device">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="battery" className="text-body-lg font-bold text-cocoa">
              Battery
            </label>
            <span className={clsx("tabular text-body-lg font-bold", low ? "text-late-ink" : "text-cocoa")}>
              {battery === null ? "—" : `${battery}%`}
            </span>
          </div>
          <input
            id="battery"
            type="range"
            min={0}
            max={100}
            step={1}
            value={battery ?? 100}
            disabled={battery === null}
            onChange={(e) => onBattery(Number(e.target.value))}
            className="mt-1 h-11 w-full cursor-pointer accent-teal disabled:cursor-not-allowed"
            aria-describedby="battery-hint"
          />
          <div className="relative -mt-1 h-4 text-[11px] font-semibold text-muted" aria-hidden>
            <span className="absolute left-0">0%</span>
            <span className="absolute -translate-x-1/2 text-late-ink" style={{ left: `${LOW_BATTERY_PCT}%` }}>
              {LOW_BATTERY_PCT}% low
            </span>
            <span className="absolute right-0">100%</span>
          </div>
          <p id="battery-hint" className="mt-1.5 text-body-sm text-muted">
            At {LOW_BATTERY_PCT}% or below the heart blinks amber, a warning plays and the family gets an alert.
          </p>
        </div>
        <div className="mt-4 border-t border-line/70 pt-4">
          <Switch
            id="wifi"
            checked={online}
            onChange={onOnline}
            icon={online ? <Wifi className="size-5" aria-hidden /> : <WifiOff className="size-5" aria-hidden />}
            label="Wi-Fi connection"
            description={
              queued > 0
                ? `${queued} check-in${queued > 1 ? "s" : ""} saved on the bear. Turn Wi-Fi on to sync.`
                : "Turn off to test offline memory"
            }
          />
        </div>
        <div className="mt-4 border-t border-line/70 pt-4">
          <label htmlFor="device" className="text-body-lg font-bold text-cocoa">
            Simulated bear
          </label>
          <Select id="device" className="mt-1.5" value={deviceId ?? ""} onChange={(e) => onSelectDevice(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} ({d.patientNickname})
              </option>
            ))}
          </Select>
        </div>
      </Section>

      <p className="flex items-start gap-2.5 rounded-[18px] bg-mint/55 px-4 py-3 text-body text-[#1f4f4a]">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-bold">Private by design.</strong> This bear has a speaker but no microphone. It can never
          record {patientNickname}.
        </span>
      </p>

      <Section
        title="Event log"
        action={
          <button
            type="button"
            onClick={onClearLog}
            disabled={log.length === 0}
            className="min-h-9 rounded-full px-3 text-body font-semibold text-muted hover:bg-cocoa/5 hover:text-cocoa disabled:opacity-40"
          >
            Clear
          </button>
        }
      >
        {log.length === 0 ? (
          <p className="rounded-2xl bg-cream/70 px-4 py-5 text-center text-body text-muted">
            Paw holds, reminders and sync results appear here.
          </p>
        ) : (
          <ol className="relative max-h-[22rem] overflow-y-auto pr-1" aria-label="Bear events, newest first">
            <span className="absolute top-3 bottom-3 left-[13px] w-px bg-line" aria-hidden />
            {log.map((e) => (
              <li key={e.id} className="relative grid grid-cols-[28px_1fr_auto] items-start gap-x-3 py-2">
                <span className={clsx("relative grid size-7 place-items-center rounded-full ring-4 ring-paper", KIND[e.kind].badge)} aria-hidden>
                  {KIND[e.kind].icon}
                </span>
                <span className="min-w-0">
                  <span className={clsx("block text-body font-bold", KIND[e.kind].text)}>{KIND[e.kind].label}</span>
                  <span className="block text-body-sm text-cocoa-700">{e.text}</span>
                </span>
                <time className="tabular pt-0.5 text-body-sm whitespace-nowrap text-muted">{e.simAt ? formatTime(e.simAt) : "—"}</time>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        busy={busy === "reset"}
        title="Reset the demo?"
        description="This wipes every change made during the demo and rebuilds the fictional data. The clock goes back to 7:45 PM, 15 minutes before the evening dose."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)} disabled={busy === "reset"}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "reset"}
              onClick={() =>
                run("reset", async () => {
                  await onReset();
                  setConfirmReset(false);
                })
              }
            >
              Reset demo data
            </Button>
          </>
        }
      />
    </div>
  );
}
