"use client";

import clsx from "clsx";
import { Home, Power, VolumeX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BearFigure, type LedColor } from "@/components/bear/bear-figure";
import { DemoPanel } from "@/components/bear/demo-panel";
import { DeviceChips } from "@/components/bear/device-chips";
import { DoseCard } from "@/components/bear/dose-card";
import { PawButton } from "@/components/bear/paw-button";
import { SpeechBubble, type BubbleTone } from "@/components/bear/speech-bubble";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { useBearDevice } from "@/hooks/use-bear-device";
import { errorMessage } from "@/lib/api-client";

/** The heart light always comes with words, never color alone. */
const LIGHT: Record<LedColor, { dot: string; text: string }> = {
  green: { dot: "bg-[#4cc27a]", text: "Heart light: green · connected" },
  blue: { dot: "bg-[#4a9be0]", text: "Heart light: blue · reminder waiting" },
  amber: { dot: "bg-[#f2a33a]", text: "Heart light: amber · low battery" },
  gray: { dot: "bg-[#a39a93]", text: "Heart light: off · offline" },
};

export default function BearSimulatorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BearSimulator />
    </Suspense>
  );
}

/** Placeholder for the bear stage while the simulated device pairs. */
function StageSkeleton() {
  return (
    <div className="mt-6 flex flex-col items-center" role="status" aria-label="Pairing the simulated bear">
      <Skeleton className="h-[120px] w-full max-w-[510px] rounded-card" />
      <Skeleton className="mt-8 size-[240px] rounded-full" />
      <Skeleton className="mt-6 h-7 w-56 rounded-full" />
      <Skeleton className="mt-4 h-[92px] w-full max-w-[620px] rounded-soft" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-cream">
      <div className="h-[74px] border-b border-line bg-white" />
      <div className="grid tablet:grid-cols-[minmax(0,1fr)_410px]">
        <div className="bg-cream-deep px-5 py-6 tablet:px-12">
          <StageSkeleton />
        </div>
        <div className="space-y-4 border-line bg-white px-5 py-7 tablet:border-l tablet:px-9">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-soft" />
          <Skeleton className="h-32 rounded-soft" />
        </div>
      </div>
    </div>
  );
}

function BearSimulator() {
  const params = useSearchParams();
  const bear = useBearDevice({ startOffline: params.get("scenario") === "offline" });
  const { view, state } = bear;
  const [holding, setHolding] = useState(false);
  const showDose = state?.activeDose ?? state?.nextDose ?? null;
  const nickname = state?.patient.nickname ?? bear.device?.patientNickname ?? "the patient";

  const tone: BubbleTone = holding
    ? "normal"
    : view.flash === "success"
      ? "success"
      : view.flash === "reject"
        ? "reject"
        : view.mood === "reminder"
          ? "reminder"
          : "normal";
  const bubble = holding
    ? { kicker: "Holding", text: "Keep holding…", sub: "A gentle 3-second hold logs this dose." }
    : { kicker: view.kicker, text: view.bubble, sub: view.sub };

  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex h-[74px] items-center justify-between gap-4 border-b border-line bg-white px-5 tablet:px-8">
        <div className="flex min-w-0 items-center gap-5">
          <Logo subtitle="A warm hug between visits" />
          <span className="hidden border-l border-line pl-5 text-body-lg font-bold text-cocoa mobile:inline">
            Patient&apos;s bear simulator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] font-bold tracking-[0.12em] text-muted tablet:inline">DEMO · FICTIONAL DATA</span>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-body-lg font-bold text-muted hover:bg-cocoa/5 hover:text-cocoa"
          >
            <Home className="size-[18px]" aria-hidden />
            Launcher
          </Link>
        </div>
      </header>

      <main className="grid tablet:min-h-[calc(100dvh-74px)] tablet:grid-cols-[minmax(0,1fr)_410px]">
        <section aria-label="Yakap Bear device" className="plush relative bg-cream-deep px-5 py-6 tablet:px-12 tablet:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DeviceChips connection={bear.connection} battery={bear.battery} queued={bear.queue.length} />
            <p className="text-body-sm font-semibold text-cocoa-700">
              {bear.device ? `${bear.device.id} · ${nickname}'s bear` : "Pairing…"}
            </p>
          </div>

          {bear.devError && (
            <Notice tone="error" title="Can't reach the Yakap API" className="mt-4">
              {errorMessage(bear.devError)} Start the Rust server (<code>npm run dev:api</code>) and reload.
            </Notice>
          )}
          {bear.connection === "error" && !bear.devError && (
            <Notice tone="warning" title="Connection problem" className="mt-4">
              The bear can&apos;t reach the server ({errorMessage(bear.liveError)}). Paw holds are saved on the bear and
              synced later.
            </Notice>
          )}

          {!bear.device && !bear.devError ? (
            <StageSkeleton />
          ) : (
            bear.device && (
              <div className="mt-6 flex flex-col items-center">
                <SpeechBubble kicker={bubble.kicker} text={bubble.text} sub={bubble.sub} speaking={bear.speaking} tone={tone} />

                <div className="relative mt-6 w-[220px] mobile:w-[260px]">
                  <span
                    className="absolute top-1/2 left-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fffaf0_0,#fff6e0_52%,rgb(255_246_224/0)_70%)]"
                    aria-hidden
                  />
                  <BearFigure mood={view.mood} led={view.led} shakeKey={bear.shakeKey} className="relative w-full" />
                  <PawButton
                    className="absolute -right-12 bottom-0 mobile:-right-14"
                    disabled={!state}
                    flash={view.flash}
                    onComplete={bear.submitHold}
                    onRelease={bear.submitHold}
                    onHoldingChange={setHolding}
                    attention={view.due}
                  />
                </div>

                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-body-sm font-semibold text-cocoa-700">
                  <span className={clsx("size-2 rounded-full", LIGHT[view.led].dot)} aria-hidden />
                  {LIGHT[view.led].text}
                </p>

                <div className="mt-4 w-full max-w-[620px]">
                  <DoseCard dose={showDose} kind={state?.activeDose ? "current" : "next"} />
                </div>
              </div>
            )
          )}

          {bear.audio === "locked" && bear.device && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-cream/85 p-6 backdrop-blur-[3px]">
              <div className="max-w-sm text-center">
                <h1 className="text-title font-bold text-cocoa">Turn on the bear</h1>
                <p className="mt-2 text-body-lg text-muted">
                  Browsers need one tap before the bear can play the family&apos;s voice reminders.
                </p>
                <Button size="lg" className="mt-6" icon={<Power className="size-5" aria-hidden />} onClick={bear.turnOn}>
                  Turn on bear
                </Button>
                <div>
                  <Button
                    variant="ghost"
                    className="mt-2"
                    icon={<VolumeX className="size-4" aria-hidden />}
                    onClick={bear.continueMuted}
                  >
                    Continue without sound
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside
          aria-label="Presenter controls"
          className="border-t border-line bg-white px-5 py-7 tablet:border-t-0 tablet:border-l tablet:px-9 tablet:py-9"
        >
          <DemoPanel
            simNow={bear.simNow}
            devices={bear.devices}
            deviceId={bear.device?.id ?? null}
            onSelectDevice={bear.selectDevice}
            onClock={bear.clockAction}
            onReset={bear.resetDemo}
            online={bear.online}
            onOnline={bear.setOnline}
            battery={bear.battery}
            onBattery={bear.setBattery}
            queued={bear.queue.length}
            log={bear.log}
            onClearLog={bear.clearLog}
            patientNickname={nickname}
          />
        </aside>
      </main>
    </div>
  );
}
