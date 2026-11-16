import { HeartHandshake, MicOff, PauseCircle, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";
import { DemoReset, QuickLogin } from "@/components/launcher/demo-tools";
import { BearMascot } from "@/components/shared/bear-mascot";
import { DemoBar } from "@/components/shared/demo-bar";
import { Logo } from "@/components/shared/logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/contracts/demo";
import { PROTOTYPE_NOTICE } from "@/lib/consent-text";

export default function LauncherPage() {
  return (
    <div className="min-h-dvh">
      <DemoBar />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo subtitle="Prototype launcher" />
        <span className="hidden rounded-full bg-cream-200 px-3 py-1 text-xs font-bold text-cocoa-700 sm:inline">
          Group 6 · Yakap Care Technologies
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-8 py-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-cocoa-900 sm:text-5xl">
              A warm hug between visits.
            </h1>
            <p className="mt-4 max-w-xl text-lg font-semibold text-cocoa-700">
              Yakap Bear reminds adults on maintenance mental-health medication to take their doses — in a loved
              one&apos;s recorded voice. Hold the bear&apos;s paw for 3 seconds to log a dose.
            </p>
            <ul className="mt-6 grid gap-2 text-sm font-semibold text-cocoa-700 sm:grid-cols-2">
              <li className="flex items-center gap-2"><HeartHandshake className="size-4 text-honey-600" /> One check-in per dose time</li>
              <li className="flex items-center gap-2"><MicOff className="size-4 text-honey-600" /> No microphone — never records the patient</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-honey-600" /> Clinicians see logs only with written consent</li>
              <li className="flex items-center gap-2"><Smartphone className="size-4 text-honey-600" /> Missed dose → simulated SMS to family</li>
            </ul>
          </div>
          <Card className="p-6">
            <DemoReset />
          </Card>
        </section>

        <section aria-labelledby="views" className="mt-6">
          <h2 id="views" className="text-sm font-extrabold uppercase tracking-wider text-cocoa-500">
            Open a view
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col p-6">
              <span className="grid size-14 place-items-center rounded-2xl bg-cream-200">
                <BearMascot className="size-11" />
              </span>
              <h3 className="mt-4 text-lg font-black">Bear simulator</h3>
              <p className="mt-1 flex-1 text-sm text-cocoa-600">
                The patient&apos;s bear: voice reminders, the 3-second paw hold, status light, battery, offline memory and
                demo time controls.
              </p>
              <ButtonLink href="/bear" className="mt-5 self-start">
                Open the bear
              </ButtonLink>
            </Card>

            <Card className="flex flex-col p-6">
              <span className="grid size-14 place-items-center rounded-2xl bg-upcoming-soft text-upcoming-ink">
                <Stethoscope className="size-7" />
              </span>
              <h3 className="mt-4 text-lg font-black">Clinic dashboard</h3>
              <p className="mt-1 flex-1 text-sm text-cocoa-600">
                Consented patients only: dose log, adherence cards, weekly missed-dose pattern, CSV/PDF export and the
                clinic audit log.
              </p>
              <div className="mt-5 flex flex-wrap items-start gap-2">
                <QuickLogin email="doctor@yakap.demo" area="clinic" next="/clinic/patients" label="Sign in as Dr. Reyes" />
                <ButtonLink href="/clinic/login" variant="secondary">
                  Sign-in page
                </ButtonLink>
              </div>
            </Card>

            <Card className="flex flex-col border-2 border-dashed border-cocoa-200 bg-cream-50 p-6 shadow-none ring-0">
              <span className="grid size-14 place-items-center rounded-2xl bg-away-soft text-away-ink">
                <PauseCircle className="size-7" />
              </span>
              <h3 className="mt-4 text-lg font-black text-cocoa-700">Family app (mobile)</h3>
              <p className="mt-1 flex-1 text-sm text-cocoa-600">
                On hold for now. Its API is already live — schedules, voice recordings, alerts, simulated SMS, consent,
                corrections and away mode — so the screens can be built on top of it next.
              </p>
              <span className="mt-5 self-start rounded-full bg-away-soft px-3 py-1 text-xs font-bold text-away-ink">
                Not built yet
              </span>
            </Card>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Card className="p-6">
            <h2 className="text-base font-extrabold">Demo accounts</h2>
            <p className="mt-1 text-sm text-cocoa-600">
              Shared demo-only password: <code className="rounded bg-cream-200 px-1.5 py-0.5 font-bold">{DEMO_PASSWORD}</code>
            </p>
            <ul className="mt-4 divide-y divide-cocoa-100 text-sm">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-bold text-cocoa-800">{a.email}</span>
                  <span className="text-cocoa-600">{a.label}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="text-base font-extrabold">What&apos;s simulated</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-cocoa-700">
              <li>The physical bear (paw sensor, speaker, battery, Wi-Fi)</li>
              <li>SMS — messages are stored and shown, never sent</li>
              <li>Time — a shared demo clock you can skip forward</li>
              <li>Plans &amp; payments — informational only</li>
            </ul>
            <p className="mt-4 text-xs font-semibold text-cocoa-500">{PROTOTYPE_NOTICE}</p>
          </Card>
        </section>
      </main>
    </div>
  );
}
