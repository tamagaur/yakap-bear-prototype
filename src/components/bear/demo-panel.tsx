"use client";

import clsx from "clsx";
import { BatteryLow, FastForward, RotateCcw, SkipForward, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import type { ConsoleEntry, ConsoleKind } from "@/hooks/use-bear-device";
import type { ClockAction, DemoDeviceDTO } from "@/lib/contracts/demo";
import { WEEKDAYS, formatTime, manilaWeekday } from "@/lib/time";

const KIND: Record<ConsoleKind, { label: string; className: string }> = {
  ok: { label: "Logged", className: "text-taken-ink" },
  reject: { label: "Not logged", className: "text-late-ink" },
  info: { label: "Info", className: "text-upcoming-ink" },
  warn: { label: "Heads up", className: "text-missed-ink" },
  sync: { label: "Sync", className: "text-teal" },
};

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
  const moments: { key: string; label: string; icon: React.ReactNode; go: () => Promise<void> }[] = [
    { key: "next", label: "Play reminder", icon: <SkipForward className="size-4" aria-hidden />, go: () => onClock({ action: "next-dose", deviceId: dev }) },
    { key: "past", label: "Past window", icon: <TriangleAlert className="size-4" aria-hidden />, go: () => onClock({ action: "past-window", deviceId: dev }) },
    { key: "hour", label: "+1 hour", icon: <FastForward className="size-4" aria-hidden />, go: () => onClock({ action: "advance", minutes: 60 }) },
    { key: "low", label: "Low battery", icon: <BatteryLow className="size-4" aria-hidden />, go: async () => onBattery(15) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-honey-dark">Presenter controls</p>
        <h2 className="mt-2 text-title-sm font-bold text-cocoa">Try every bear moment</h2>
      </div>

      <div className="space-y-3 border-t border-line pt-5">
        <div className="flex items-center justify-between text-body">
          <span className="text-muted">Demo time</span>
          <span className="tabular font-bold text-cocoa">
            {simNow ? `${WEEKDAYS[manilaWeekday(simNow)]}, ${formatTime(simNow)}` : "—"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {moments.map((m) => (
            <Button
              key={m.key}
              variant="secondary"
              icon={m.icon}
              loading={busy === m.key}
              disabled={busy !== null && busy !== m.key}
              onClick={() => run(m.key, m.go)}
            >
              {m.label}
            </Button>
          ))}
          <Button
            variant="secondary"
            className="col-span-2"
            icon={<RotateCcw className="size-4" aria-hidden />}
            disabled={busy !== null}
            onClick={() => setConfirmReset(true)}
          >
            Before dose (reset demo)
          </Button>
        </div>
        <p className="text-body-sm text-muted">
          “Play reminder” jumps to the next dose time. “Past window” jumps one minute after the late period, so an unlogged
          dose becomes <strong className="font-bold text-cocoa">missed</strong> and the family gets a simulated text.
        </p>
      </div>

      <div className="space-y-4 border-t border-line pt-5">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="battery" className="text-body text-muted">
              Battery
            </label>
            <span className="tabular text-body font-bold text-cocoa">{battery === null ? "—" : `${battery}%`}</span>
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
            className="mt-2 h-11 w-full accent-teal"
          />
          <p className="text-body-sm text-muted">20% or below: amber heart light, warning sound, and an alert for the family.</p>
        </div>
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
        <div>
          <label htmlFor="device" className="text-body text-muted">
            Simulated bear
          </label>
          <Select id="device" className="mt-1.5" value={deviceId ?? ""} onChange={(e) => onSelectDevice(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} · {d.patientNickname}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Notice tone="privacy" title="Private by design">
        This bear has a speaker, but no microphone. It can never record {patientNickname}.
      </Notice>

      <div className="border-t border-line pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-cocoa">Event log</h3>
          <button
            type="button"
            onClick={onClearLog}
            disabled={log.length === 0}
            className="min-h-11 px-2 text-body font-semibold text-muted hover:text-cocoa disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        {log.length === 0 ? (
          <p className="text-body text-muted">Paw holds, reminders and sync results appear here.</p>
        ) : (
          <ol className="max-h-80 space-y-3 overflow-y-auto border-l border-line pl-4" aria-label="Bear events, newest first">
            {log.map((e) => (
              <li key={e.id} className="grid grid-cols-[4.2rem_1fr] gap-x-3 text-body-sm">
                <span className="tabular text-muted">{e.simAt ? formatTime(e.simAt) : "—"}</span>
                <span>
                  <span className={clsx("block font-bold", KIND[e.kind].className)}>{KIND[e.kind].label}</span>
                  <span className="text-cocoa-700">{e.text}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

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
