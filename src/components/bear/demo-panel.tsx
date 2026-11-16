"use client";

import clsx from "clsx";
import { CheckCircle2, CircleSlash, Clock3, FastForward, Info, RefreshCw, SkipForward, TriangleAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { ConsoleEntry, ConsoleKind } from "@/hooks/use-bear-device";
import type { ClockAction, DemoDeviceDTO } from "@/lib/contracts/demo";
import { formatDate, formatTime } from "@/lib/time";

const KIND: Record<ConsoleKind, { icon: React.ReactNode; className: string }> = {
  ok: { icon: <CheckCircle2 className="size-3.5" />, className: "text-taken" },
  reject: { icon: <CircleSlash className="size-3.5" />, className: "text-missed" },
  info: { icon: <Info className="size-3.5" />, className: "text-upcoming" },
  warn: { icon: <TriangleAlert className="size-3.5" />, className: "text-late" },
  sync: { icon: <RefreshCw className="size-3.5" />, className: "text-honey-600" },
};

/** Presenter controls (tasks S6, S7, S8, S9) — kept apart from the patient's bear. */
export function DemoPanel(props: {
  simNow: Date | null;
  devices: DemoDeviceDTO[];
  deviceId: string | null;
  onSelectDevice: (id: string) => void;
  onClock: (a: ClockAction) => Promise<void>;
  online: boolean;
  onOnline: (v: boolean) => void;
  battery: number | null;
  onBattery: (v: number) => void;
  queued: number;
  log: ConsoleEntry[];
  onClearLog: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, a: ClockAction) => {
    setBusy(key);
    try {
      await props.onClock(a);
    } finally {
      setBusy(null);
    }
  };
  const deviceId = props.deviceId ?? undefined;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">Demo controls · presenter</p>
          <Clock3 className="size-4 text-cocoa-400" aria-hidden />
        </div>
        <p className="mt-2 text-3xl font-black text-cocoa-900 tabular" aria-live="polite">
          {props.simNow ? formatTime(props.simNow) : "—"}
        </p>
        <p className="text-sm font-semibold text-cocoa-600">
          {props.simNow ? formatDate(props.simNow) : "Loading the demo clock…"} · Asia/Manila
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <Button variant="secondary" className="justify-start" loading={busy === "hour"} icon={<FastForward className="size-4" />} onClick={() => run("hour", { action: "advance", minutes: 60 })}>
            +1 hour
          </Button>
          <Button variant="secondary" className="justify-start" loading={busy === "next"} icon={<SkipForward className="size-4" />} onClick={() => run("next", { action: "next-dose", deviceId })}>
            Jump to next dose
          </Button>
          <Button variant="secondary" className="justify-start" loading={busy === "past"} icon={<TriangleAlert className="size-4" />} onClick={() => run("past", { action: "past-window", deviceId })}>
            Jump past dose window
          </Button>
        </div>
        <p className="mt-2 text-xs text-cocoa-500">
          “Past window” jumps 1 minute after the late period, so an unlogged dose becomes <b>missed</b> and the family gets a simulated SMS.
        </p>

        <div className="mt-5 space-y-4 border-t border-cocoa-100 pt-4">
          <div className="space-y-1.5">
            <label htmlFor="device" className="text-sm font-bold text-cocoa-800">
              Simulated bear
            </label>
            <Select id="device" value={props.deviceId ?? ""} onChange={(e) => props.onSelectDevice(e.target.value)}>
              {props.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} · {d.patientNickname}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="battery" className="text-sm font-bold text-cocoa-800">
                Battery
              </label>
              <span className={clsx("text-sm font-black tabular", (props.battery ?? 100) <= 20 ? "text-late-ink" : "text-cocoa-700")}>
                {props.battery ?? "—"}%
              </span>
            </div>
            <input
              id="battery"
              type="range"
              min={5}
              max={100}
              step={1}
              value={props.battery ?? 100}
              onChange={(e) => props.onBattery(Number(e.target.value))}
              className="w-full accent-honey-500"
              aria-describedby="battery-hint"
            />
            <p id="battery-hint" className="text-xs text-cocoa-500">
              20% or below: amber light, warning sound, and an alert in the family app.
            </p>
          </div>
          <Switch
            id="online"
            checked={props.online}
            onChange={props.onOnline}
            label="Wi-Fi connected"
            description={
              props.online
                ? "Turn off to test offline dose memory."
                : `Offline — ${props.queued} hold${props.queued === 1 ? "" : "s"} saved on the bear, synced on reconnect.`
            }
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">Event console</p>
          <button
            type="button"
            onClick={props.onClearLog}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-cocoa-500 hover:bg-cream-100"
          >
            <Trash2 className="size-3.5" aria-hidden /> Clear
          </button>
        </div>
        <ol className="mt-2 max-h-80 overflow-y-auto px-3 pb-3 font-mono text-[12.5px] leading-relaxed" aria-live="polite" aria-label="Bear event log">
          {props.log.length === 0 && <li className="px-2 py-3 text-cocoa-500">Hold the paw or skip time to see events here.</li>}
          {props.log.map((e) => (
            <li key={e.id} className="flex gap-2 rounded-lg px-2 py-1 hover:bg-cream-50">
              <span className="mt-0.5 shrink-0 text-cocoa-400 tabular">{e.simAt ? formatTime(e.simAt) : "—"}</span>
              <span className={clsx("mt-1 shrink-0", KIND[e.kind].className)} aria-hidden>
                {KIND[e.kind].icon}
              </span>
              <span className="text-cocoa-800">{e.text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
