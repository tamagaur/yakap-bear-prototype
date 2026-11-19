"use client";

import clsx from "clsx";
import { Home, Power, VolumeX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BearStage } from "@/components/bear/bear-stage";
import { DemoPanel } from "@/components/bear/demo-panel";
import { DeviceChips } from "@/components/bear/device-chips";
import { DoseCard } from "@/components/bear/dose-card";
import { HEART_LIGHT } from "@/components/bear/heart-light";
import { PawButton } from "@/components/bear/paw-button";
import { SpeechBubble, type BubbleTone } from "@/components/bear/speech-bubble";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { useBearDevice } from "@/hooks/use-bear-device";
import { errorMessage } from "@/lib/api-client";

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
      <Skeleton className="h-[112px] w-full max-w-[540px] rounded-[28px]" />
      <Skeleton className="mt-8 size-[260px] rounded-full" />
      <Skeleton className="mt-6 h-8 w-56 rounded-full" />
      <Skeleton className="mt-4 h-[150px] w-full max-w-[540px] rounded-[24px]" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-cream">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="grid tablet:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
        <div className="px-5 py-6 tablet:px-10">
          <StageSkeleton />
        </div>
        <div className="space-y-4 border-line bg-cream-deep/50 px-5 py-7 tablet:border-l tablet:px-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-52 rounded-[22px]" />
          <Skeleton className="h-44 rounded-[22px]" />
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
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line/80 bg-paper/90 px-4 backdrop-blur-md mobile:px-6 tablet:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Logo subtitle="A warm hug between visits" />
          <span className="hidden rounded-full bg-cream px-3 py-1 text-body font-bold text-cocoa-700 mobile:inline">
            Patient&apos;s bear simulator
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full px-3 py-1 text-body-sm font-semibold text-muted ring-1 ring-line tablet:inline">
            Fictional demo data
          </span>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-body-lg font-bold text-muted transition-colors hover:bg-cocoa/5 hover:text-cocoa"
          >
            <Home className="size-[18px]" aria-hidden />
            Launcher
          </Link>
        </div>
      </header>

      <main className="grid tablet:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
        <section
          aria-label="Yakap Bear device"
          className="relative overflow-hidden bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,#fffaf1_0%,#fbf1e2_55%,#f3e5d0_100%)] px-4 pt-5 pb-10 mobile:px-6 tablet:h-[calc(100dvh-4rem)] tablet:overflow-y-auto tablet:px-10 tablet:py-7"
        >
          <div className="mx-auto flex max-w-[680px] flex-wrap items-center justify-between gap-3">
            <DeviceChips connection={bear.connection} battery={bear.battery} queued={bear.queue.length} />
            <p className="text-body font-semibold text-cocoa-700">{bear.device ? `${nickname}'s bear` : "Pairing…"}</p>
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
              <div className="mx-auto mt-6 flex max-w-[680px] flex-col items-center">
                <SpeechBubble kicker={bubble.kicker} text={bubble.text} sub={bubble.sub} speaking={bear.speaking} tone={tone} />

                <div className="relative mt-5 w-[236px] mobile:w-[290px] tablet:w-[320px]">
                  {/* soft spotlight and a felt display base under the toy */}
                  <span
                    className="absolute top-[45%] left-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#fffdf8_0,rgb(255_247_232/0.85)_45%,rgb(255_247_232/0)_70%)]"
                    aria-hidden
                  />
                  <span
                    className="absolute bottom-[3%] left-1/2 h-[13%] w-[88%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,#f1dfc6_0,#ead3b4_60%,rgb(234_211_180/0)_72%)]"
                    aria-hidden
                  />
                  <BearStage
                    mood={view.mood}
                    led={view.led}
                    shakeKey={bear.shakeKey}
                    holding={holding}
                    speaking={bear.speaking}
                    className="relative w-full"
                  />
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

                <p className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-paper/90 py-1.5 pr-4 pl-2 text-body font-semibold shadow-card ring-1 ring-line/60">
                  <span className="relative grid size-5 place-items-center" aria-hidden>
                    <span className={clsx("absolute inset-0 rounded-full opacity-35 blur-[3px]", HEART_LIGHT[view.led].dot)} />
                    <span className={clsx("relative size-2.5 rounded-full", HEART_LIGHT[view.led].dot)} />
                  </span>
                  <span className="text-cocoa">Heart light {HEART_LIGHT[view.led].color}</span>
                  <span className="h-3.5 w-px bg-line" aria-hidden />
                  <span className="text-muted">{HEART_LIGHT[view.led].meaning}</span>
                </p>

                <div className="mt-5 w-full max-w-[540px]">
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
          className="border-t border-line bg-cream-deep/50 tablet:h-[calc(100dvh-4rem)] tablet:overflow-y-auto tablet:border-t-0 tablet:border-l"
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
            led={view.led}
            doseStatus={showDose?.status ?? null}
          />
        </aside>
      </main>
    </div>
  );
}
