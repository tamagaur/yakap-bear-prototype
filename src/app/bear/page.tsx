"use client";

import { Power, VolumeX } from "lucide-react";
import Link from "next/link";
import { BearFigure } from "@/components/bear/bear-figure";
import { DemoPanel } from "@/components/bear/demo-panel";
import { DeviceChips } from "@/components/bear/device-chips";
import { DoseCard } from "@/components/bear/dose-card";
import { PawButton } from "@/components/bear/paw-button";
import { SpeechBubble } from "@/components/bear/speech-bubble";
import { DemoBar } from "@/components/shared/demo-bar";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LoadingBlock } from "@/components/ui/spinner";
import { useBearDevice } from "@/hooks/use-bear-device";
import { errorMessage } from "@/lib/api-client";

export default function BearSimulatorPage() {
  const bear = useBearDevice();
  const { view, state } = bear;
  const tone =
    view.flash === "success" ? "success" : view.flash === "reject" ? "reject" : view.mood === "reminder" ? "reminder" : "normal";
  const showDose = state?.activeDose ?? state?.nextDose ?? null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,var(--color-cream-100),var(--color-cream-50)_60%)]">
      <DemoBar />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo subtitle="Bear simulator" />
        <Link href="/" className="text-sm font-bold text-cocoa-600 hover:text-cocoa-900">
          ← Launcher
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Yakap Bear device" className="relative">
          <div className="rounded-[2.5rem] bg-cream-100/80 p-5 ring-1 ring-cocoa-200/70 shadow-soft sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                  {bear.device ? `${bear.device.id} · paired with` : "Pairing…"}
                </p>
                <p className="text-xl font-black text-cocoa-900">{state?.patient.nickname ?? bear.device?.patientNickname ?? "—"}</p>
              </div>
              <DeviceChips connection={bear.connection} battery={bear.battery} queued={bear.queue.length} />
            </div>

            {bear.devError && (
              <Notice tone="error" title="Can't reach the Yakap API" className="mt-4">
                {errorMessage(bear.devError)} Start the Rust server (<code>npm run dev:api</code>) and reload.
              </Notice>
            )}
            {bear.connection === "error" && !bear.devError && (
              <Notice tone="warning" title="Connection problem" className="mt-4">
                The bear can&apos;t reach the server ({errorMessage(bear.liveError)}). Paw holds are saved on the bear and synced later.
              </Notice>
            )}

            {!bear.device && !bear.devError ? (
              <LoadingBlock label="Pairing the simulated bear…" />
            ) : (
              <div className="mt-5 flex flex-col items-center gap-4">
                <SpeechBubble text={view.bubble} sub={view.sub} speaking={bear.speaking} tone={tone} />
                <div className="relative w-full max-w-[22rem] pr-10 sm:pr-14">
                  <BearFigure mood={view.mood} led={view.led} speaking={bear.speaking} shakeKey={bear.shakeKey} />
                  <PawButton
                    className="absolute -right-1 bottom-[4%] sm:-right-2"
                    disabled={!state}
                    flash={view.flash}
                    onComplete={bear.submitHold}
                    onRelease={bear.submitHold}
                  />
                </div>
                <div className="w-full max-w-md">
                  <DoseCard dose={showDose} kind={state?.activeDose ? "current" : "next"} />
                </div>
              </div>
            )}

            {bear.audio === "locked" && bear.device && (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-[2.5rem] bg-cream-50/80 p-6 backdrop-blur-[3px]">
                <div className="max-w-sm text-center">
                  <p className="text-2xl font-black text-cocoa-900">Turn on the bear</p>
                  <p className="mt-2 text-sm font-semibold text-cocoa-600">
                    Browsers need one tap before the bear can play the family&apos;s voice reminders.
                  </p>
                  <Button size="lg" className="mt-5" icon={<Power className="size-5" />} onClick={bear.turnOn}>
                    Turn on bear
                  </Button>
                  <button
                    type="button"
                    onClick={bear.continueMuted}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-bold text-cocoa-600 hover:text-cocoa-900"
                  >
                    <VolumeX className="size-4" aria-hidden /> Continue without sound
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 px-2 text-center text-xs font-semibold text-cocoa-500">
            Simulation of the physical bear: paw squeeze sensor (3-second hold), speaker, heart status light, battery and Wi-Fi.
            There is no microphone — the bear never records the patient.
          </p>
        </section>

        <aside aria-label="Demo controls">
          <DemoPanel
            simNow={bear.simNow}
            devices={bear.devices}
            deviceId={bear.device?.id ?? null}
            onSelectDevice={bear.selectDevice}
            onClock={bear.clockAction}
            online={bear.online}
            onOnline={bear.setOnline}
            battery={bear.battery}
            onBattery={bear.setBattery}
            queued={bear.queue.length}
            log={bear.log}
            onClearLog={bear.clearLog}
          />
        </aside>
      </main>
    </div>
  );
}
