"use client";

import clsx from "clsx";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  Hospital,
  Play,
  RotateCcw,
  Square,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { BearMark } from "@/components/shared/logo";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { useSimClock } from "@/hooks/use-sim-clock";
import { apiFetch, errorMessage, fetcher } from "@/lib/api-client";
import { playVoice, stopVoice, unlockAudio } from "@/lib/bear-audio";
import type { BearStateDTO } from "@/lib/contracts/bear";
import {
  DEMO_PASSWORD,
  type ClockActionResultDTO,
  type DemoDeviceDTO,
  type DemoOverviewDTO,
  type ResetResultDTO,
} from "@/lib/contracts/demo";
import { FAMILY_APP_READY } from "@/lib/features";
import { WEEKDAYS, formatTime, manilaWeekday } from "@/lib/time";

const DEVICE_ID = "BEAR-0001";
const ACCOUNTS = { family: "family@yakap.demo", clinician: "doctor@yakap.demo", admin: "admin@yakap.demo" } as const;

/** Launcher data: the demo bear, next dose, alerts, latest text and who's who. */
export function useDemoOverview() {
  return useSWR<DemoOverviewDTO>(`/api/demo/overview?deviceId=${DEVICE_ID}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}

function signIn(email: string, area: "family" | "clinic") {
  return apiFetch("/api/auth/login", { json: { email, password: DEMO_PASSWORD, area } });
}
const clockAction = (action: object) => apiFetch<ClockActionResultDTO>("/api/demo/clock", { json: action });
const resetDemo = () => apiFetch<ResetResultDTO>("/api/demo/reset", { json: {} });

const firstName = (name: string) => name.replace(/^Dr\.\s+/, "").split(" ")[0];
const initials = (name: string) =>
  name
    .replace(/^Dr\.\s+/, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* ------------------------------------------------------------------ clock + reset */

/** Shared demo clock with a confirmed reset (tasks B13, S9). */
export function ClockCard() {
  const { now, demoMode, error, refresh } = useSimClock(5000);
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ResetResultDTO | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const r = await resetDemo();
      setDone(r);
      setOpen(false);
      await refresh();
      await mutate(() => true, undefined, { revalidate: true });
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 max-w-[540px]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[17px] border border-[#d8cbb9] bg-white/70 py-3 pr-3.5 pl-[18px] shadow-card">
        <div className="flex items-center gap-3">
          <Clock3 className="size-5 shrink-0 text-cocoa" aria-hidden />
          <div>
            <p className="eyebrow !text-[11px] !font-bold text-muted">Shared demo clock</p>
            <p className="tabular mt-0.5 text-body-lg font-bold text-cocoa" aria-live="off">
              {error
                ? "Clock offline"
                : now
                  ? `${WEEKDAYS[manilaWeekday(now)]}, ${formatTime(now)} · Manila`
                  : "Loading…"}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={<RotateCcw className="size-4" aria-hidden />}
          onClick={() => setOpen(true)}
          disabled={!demoMode || !!error}
        >
          Reset demo
        </Button>
      </div>
      {error && (
        <Notice tone="error" className="mt-3" title="The Yakap API isn't reachable">
          Start the Rust server with <code>npm run dev:api</code>, then reload this page.
        </Notice>
      )}
      {!error && now && !demoMode && (
        <p className="mt-2 text-body-sm text-muted">Demo mode is off on this server, so the clock can&apos;t be changed.</p>
      )}
      {done && (
        <Notice tone="success" className="mt-3" title="Demo data restored">
          Clock set to {formatTime(done.now)}. {done.counts.patients} patients, {done.counts.doseEvents} dose records and{" "}
          {done.counts.sms} simulated texts rebuilt.
        </Notice>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={busy}
        title="Reset the demo?"
        description="This wipes every change made during the demo (holds, recordings, consents, sign-ups) and rebuilds the fictional dataset. The clock goes back to 7:45 PM today, 15 minutes before Lola Rosa's 8:00 PM dose."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={reset}>
              Reset demo data
            </Button>
          </>
        }
      >
        {failure && <Notice tone="error">{failure}</Notice>}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ voice card */

/** The reminder the bear would play next. Plays through the bear's own credentials (demo mode). */
export function VoiceCard() {
  const { data } = useDemoOverview();
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const r = data?.reminder;

  const play = async () => {
    if (state === "playing") {
      stopVoice();
      setState("idle");
      return;
    }
    setState("loading");
    setError(null);
    try {
      await unlockAudio();
      const { devices } = await apiFetch<{ devices: DemoDeviceDTO[] }>("/api/demo/devices");
      const device = devices.find((d) => d.id === DEVICE_ID);
      if (!device) throw new Error("The demo bear isn't paired.");
      const headers = { "x-bear-key": device.deviceKey, "x-bear-device": device.id };
      const bear = await apiFetch<BearStateDTO>(`/api/bear/${device.id}/state`, { headers });
      const voice = (bear.activeDose ?? bear.nextDose)?.voice;
      if (!voice) throw new Error("No reminder is assigned to the next dose.");
      const res = await fetch(`/api/voice/${voice.id}/audio`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`The recording couldn't be loaded (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      try {
        await playVoice(url, () => setState("playing"));
      } finally {
        URL.revokeObjectURL(url);
      }
      setState("idle");
    } catch (e) {
      setError(errorMessage(e));
      setState("idle");
    }
  };

  if (!data) return <Skeleton className="h-[70px] w-[min(86vw,300px)] rounded-soft" />;
  if (!r) return null;
  const who = r.recordedByName && !r.isSample ? r.recordedByName : null;
  return (
    <div className="w-[min(86vw,300px)]">
      <div className="motion-lift flex items-center gap-3 rounded-soft bg-white py-3 pr-3 pl-4 shadow-card-hover transition-transform duration-300 ease-out-expo hover:-translate-y-1">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-rose text-body-sm font-bold text-cocoa"
          aria-hidden
        >
          {who ? initials(who) : <BearMark className="size-5" />}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="font-display block truncate text-body-lg font-bold text-cocoa">
            {who ? `${firstName(who)}'s reminder` : "Sample reminder"}
          </span>
          <span className="block text-body-sm text-muted">
            {r.isSample ? "A chime until the family records one" : `“${r.title}”`}
          </span>
        </span>
        <button
          type="button"
          onClick={play}
          disabled={state === "loading"}
          aria-label={state === "playing" ? "Stop the reminder" : "Play the reminder"}
          className="grid size-11 shrink-0 place-items-center rounded-full text-cocoa hover:bg-cocoa/5"
        >
          {state === "loading" ? (
            <Spinner className="size-4" />
          ) : state === "playing" ? (
            <Square className="size-4 fill-current" aria-hidden />
          ) : (
            <Play className="size-[18px]" aria-hidden />
          )}
        </button>
      </div>
      <p className="mt-1.5 min-h-4 text-body-sm font-semibold text-missed-ink" role="status">
        {error}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ role cards */

type RoleKey = "bear" | "family" | "clinician" | "admin";

const ROLE_STYLE: Record<RoleKey, { tint: string; icon: ReactNode; title: string }> = {
  bear: { tint: "bg-[#f9e0cf] border-peach", icon: <BearMark className="size-5" />, title: "Patient's bear" },
  family: { tint: "bg-[#f6dcdd] border-rose", icon: <Users className="size-5" aria-hidden />, title: "Family app" },
  clinician: { tint: "bg-[#dcebe2] border-mint", icon: <Hospital className="size-5" aria-hidden />, title: "Clinic" },
  admin: { tint: "bg-[#e8e1f3] border-lavender", icon: <ClipboardList className="size-5" aria-hidden />, title: "Clinic admin" },
};

/** One-tap entry per role. Names come from the API; sign-in uses the demo accounts. */
export function RoleCards() {
  const router = useRouter();
  const { data, error } = useDemoOverview();
  const [busy, setBusy] = useState<RoleKey | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const open = async (role: RoleKey) => {
    setFailure(null);
    setBusy(role);
    try {
      if (role === "bear") router.push("/bear");
      else if (role === "family") {
        await signIn(ACCOUNTS.family, "family");
        router.push("/family");
      } else {
        await signIn(role === "admin" ? ACCOUNTS.admin : ACCOUNTS.clinician, "clinic");
        router.push("/clinic");
      }
    } catch (e) {
      setFailure(errorMessage(e));
      setBusy(null);
    }
  };

  const p = data?.people;
  const sub: Record<RoleKey, string | undefined> = {
    bear: data && `${data.patient.nickname} · ${data.device.id}`,
    family: p?.family ? [p.family.name, p.family.relationship].filter(Boolean).join(" · ") : data && "No caregiver linked",
    clinician: p?.clinician ? p.clinician.name : data && "No clinician has consent",
    admin: p?.admin ? p.admin.name : data && "No clinic admin",
  };

  return (
    <div>
      <ul className="grid gap-3 mobile:grid-cols-2 tablet:grid-cols-4">
        {(Object.keys(ROLE_STYLE) as RoleKey[]).map((role, i) => {
          const s = ROLE_STYLE[role];
          const soon = role === "family" && !FAMILY_APP_READY;
          return (
            <Reveal as="li" key={role} className="flex" delay={i * 90}>
              <button
                type="button"
                onClick={() => open(role)}
                disabled={soon || busy !== null}
                aria-busy={busy === role || undefined}
                className={clsx(
                  "motion-lift group flex min-h-[186px] w-full flex-col rounded-card border p-[22px] text-left shadow-card transition-[transform,box-shadow] duration-300 ease-out-expo",
                  s.tint,
                  soon
                    ? "cursor-not-allowed opacity-75"
                    : "hover:-translate-y-1.5 hover:shadow-card-hover active:scale-[0.98] disabled:hover:translate-y-0",
                )}
              >
                <span className="flex w-full items-start justify-between">
                  <span className="grid size-[42px] place-items-center rounded-xl bg-white/90 text-cocoa shadow-[0_2px_8px_rgb(61_43_37/0.1)]">
                    {s.icon}
                  </span>
                  <span className="grid size-8 place-items-center rounded-full bg-white/90 text-cocoa shadow-[0_2px_8px_rgb(61_43_37/0.1)] transition-transform duration-300 ease-out-expo group-hover:translate-x-1">
                    {busy === role ? <Spinner className="size-4" /> : <ArrowRight className="size-4" aria-hidden />}
                  </span>
                </span>
                <span className="font-display mt-5 block text-card-title font-bold text-cocoa">{s.title}</span>
                <span className="mt-1.5 block min-h-[18px] text-body-sm text-cocoa-700">
                  {error ? "Not available" : (sub[role] ?? <Skeleton className="h-3.5 w-28 bg-white/60" />)}
                </span>
                {soon && (
                  <span className="mt-2.5 inline-flex self-start rounded-full bg-white/[0.72] px-2 py-1 text-[11px] leading-none font-extrabold tracking-[0.07em] text-[#765a62] uppercase">
                    Future phase
                  </span>
                )}
              </button>
            </Reveal>
          );
        })}
      </ul>
      {failure && (
        <Notice tone="error" className="mt-4">
          {failure}
        </Notice>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ hero actions */

/** "Explore the demo" opens the bear at the reminder; "How it works" scrolls to the roles. */
export function HeroActions() {
  const router = useRouter();
  const { data } = useDemoOverview();
  const { demoMode } = useSimClock(5000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explore = async () => {
    setBusy(true);
    setError(null);
    try {
      // Jump to the reminder only when the next dose is still ahead, never past an open one.
      const next = data?.nextDose;
      if (demoMode && data && next && new Date(next.scheduledFor) > new Date(data.now)) {
        await clockAction({ action: "next-dose", deviceId: DEVICE_ID });
      }
      router.push("/bear");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="mt-7">
      <div className="flex flex-col gap-3 mobile:flex-row">
        <Button variant="teal" icon={<Play className="size-4" aria-hidden />} loading={busy} onClick={explore}>
          Explore the demo
        </Button>
        <a href="#who-its-for" className={buttonClasses("secondary", "md")}>
          <ArrowRight className="size-[18px]" aria-hidden />
          How it works
        </a>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-body-sm font-semibold text-missed-ink">
          {error}
        </p>
      )}
    </div>
  );
}
