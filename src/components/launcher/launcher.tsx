"use client";

import clsx from "clsx";
import {
  ArrowRight,
  BatteryMedium,
  ChevronRight,
  ClipboardList,
  Clock3,
  FastForward,
  Hospital,
  MessageSquareText,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  TriangleAlert,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
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
import { CHECKUP_TAB, FAMILY_APP_READY } from "@/lib/features";
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
        <Notice tone="error" className="mt-3" title="Can't reach the demo server">
          <span className="block">Check the internet connection and that the demo server is running.</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-current/25 px-3 text-body-sm font-bold hover:bg-white/60"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Try again
          </button>
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

/* ------------------------------------------------------------------ live strip */

type MetricTone = "plain" | "good" | "battery" | "alert";
const METRIC: Record<MetricTone, { icon: string; value: string }> = {
  plain: { icon: "text-[#ead7cb]", value: "text-white" },
  good: { icon: "text-[#ead7cb]", value: "text-[#9be0b7]" },
  battery: { icon: "text-[#f1c367]", value: "text-[#f1c367]" },
  alert: { icon: "text-[#f0a37d]", value: "text-[#f0a37d]" },
};

function Metric({
  icon,
  label,
  tone = "plain",
  loading,
  highlight,
  children,
}: {
  icon: ReactNode;
  label: string;
  tone?: MetricTone;
  loading?: boolean;
  /** Draws the eye with a small pulsing dot (e.g. open alerts). */
  highlight?: boolean;
  children: ReactNode;
}) {
  const m = METRIC[tone];
  return (
    <div className="flex min-h-[54px] min-w-0 items-center gap-2.5 tablet:border-r tablet:border-white/[0.13] tablet:px-[18px]">
      <span
        className={clsx("relative grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[0.08]", m.icon)}
        aria-hidden
      >
        {icon}
        {highlight && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#f0a37d]">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-[#f0a37d]" />
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-[#bcb0aa] uppercase">{label}</p>
        {loading ? (
          <Skeleton dark className="mt-1.5 h-4 w-16 rounded-md" />
        ) : (
          <p className={clsx("mt-0.5 truncate text-body-lg font-bold", m.value)}>{children}</p>
        )}
      </div>
    </div>
  );
}

/** "Ana and Mia", "Ana, Mia and Carl". */
function nameList(names: string[]) {
  const first = names.map(firstName);
  return first.length <= 1 ? (first[0] ?? "") : `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}`;
}

/** Live status of the demo: bear, battery, next dose, open alerts, latest simulated text. */
export function LiveStrip() {
  const { data, error } = useDemoOverview();
  const d = data?.device;
  const text = data?.latestText;
  const loading = !data && !error;
  return (
    <section
      id="live"
      aria-label="Live demo status"
      className="scroll-mt-28 rounded-panel bg-[linear-gradient(135deg,#3d2b25,#30211d)] p-4 text-white shadow-[0_24px_60px_rgba(61,43,37,0.2)] tablet:p-[22px]"
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 tablet:grid-cols-[1.05fr_repeat(4,0.8fr)] tablet:items-center tablet:gap-x-0">
        <div className="col-span-2 flex min-h-[54px] items-center gap-3 tablet:col-span-1 tablet:border-r tablet:border-white/[0.13] tablet:px-[18px]">
          <span className="relative flex size-[9px] shrink-0" aria-hidden>
            {!error && <span className="absolute inset-0 animate-ping-soft rounded-full bg-[#7dcb9b]" />}
            <span className={clsx("relative size-[9px] rounded-full", error ? "bg-missed" : "bg-[#7dcb9b] shadow-online-ring")} />
          </span>
          <div>
            <p className="text-body-lg font-extrabold tracking-wide">LIVE DEMO</p>
            <p className="text-[11px] text-[#bcb0aa]">
              {error
                ? "The Yakap API isn't reachable"
                : !data
                  ? "Connecting…"
                  : d?.online
                    ? "Everything is connected"
                    : "Open the bear to bring it online"}
            </p>
          </div>
        </div>
        <Metric
          icon={d?.online ? <Wifi className="size-5" /> : <WifiOff className="size-5" />}
          label="Bear"
          tone={d?.online ? "good" : "plain"}
          loading={loading}
        >
          {data ? (d?.online ? "Online" : "Offline") : "—"}
        </Metric>
        <Metric
          icon={<BatteryMedium className="size-5" />}
          label="Battery"
          tone={d?.lowBattery ? "alert" : "battery"}
          loading={loading}
          highlight={d?.lowBattery}
        >
          {d ? `${d.batteryPct}%${d.lowBattery ? " · low" : ""}` : "—"}
        </Metric>
        <Metric icon={<Clock3 className="size-5" />} label="Next dose" loading={loading}>
          {data ? (data.nextDose ? formatTime(data.nextDose.scheduledFor) : "None scheduled") : "—"}
        </Metric>
        <Metric
          icon={<TriangleAlert className="size-5" />}
          label="Open alerts"
          tone={data?.openAlerts ? "alert" : "plain"}
          loading={loading}
          highlight={!!data?.openAlerts}
        >
          {data ? (data.openAlerts === 0 ? "None" : `${data.openAlerts} alert${data.openAlerts === 1 ? "" : "s"}`) : "—"}
        </Metric>

        <div className="col-span-2 flex items-start gap-2.5 border-t border-white/[0.13] pt-[18px] tablet:col-span-5 tablet:px-[18px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-white/[0.08] text-[#ead7cb]" aria-hidden>
            <MessageSquareText className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-[#bcb0aa] uppercase">Latest simulated text</p>
            {loading ? (
              <div className="mt-1.5 space-y-2">
                <Skeleton dark className="h-4 w-[min(60vw,520px)] rounded-md" />
                <Skeleton dark className="h-3 w-48 rounded-md" />
              </div>
            ) : !data ? (
              <p className="mt-0.5 text-body-lg font-bold">Not available</p>
            ) : text ? (
              <>
                <p className="mt-0.5 line-clamp-2 text-body-lg font-bold">“{text.body}”</p>
                <p className="mt-1 text-body-sm text-[#bcb0aa]">
                  Sent to {nameList(text.recipients.length ? text.recipients : [text.toName])} ·{" "}
                  {WEEKDAYS[manilaWeekday(text.createdAt)]}, {formatTime(text.createdAt)} · simulated, never really sent
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-body-lg font-bold">No texts yet</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ journeys + demo tools */

type Journey = { title: string; body: string; run: () => Promise<string | void> };

/** Guided demo paths. Journeys 1–3 start from a fresh demo so they always play the same. */
export function Journeys() {
  const router = useRouter();
  const { data } = useDemoOverview();
  const { mutate } = useSWRConfig();
  const { demoMode, refresh } = useSimClock(5000);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const refreshAll = useCallback(async () => {
    await refresh();
    await mutate(() => true, undefined, { revalidate: true });
  }, [refresh, mutate]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMessage(null);
    try {
      const text = await fn();
      await refreshAll();
      if (text) setMessage({ tone: "success", text });
    } catch (e) {
      setMessage({ tone: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const nextDose = () => clockAction({ action: "next-dose", deviceId: DEVICE_ID });
  const journeys: Journey[] = [
    {
      title: "A dose on time",
      body: "Hear the family's voice, then hold the paw.",
      run: async () => {
        await resetDemo();
        await nextDose();
        router.push("/bear");
      },
    },
    {
      title: "A missed dose",
      body: "See the family's simulated text.",
      run: async () => {
        await resetDemo();
        await nextDose();
        await clockAction({ action: "past-window", deviceId: DEVICE_ID });
        if (FAMILY_APP_READY) {
          await signIn(ACCOUNTS.family, "family");
          router.push("/family/alerts");
          return;
        }
        document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return "The dose window closed with no check-in. The family's simulated text is in the live strip above.";
      },
    },
    {
      title: "Offline memory",
      body: "Save a dose, then reconnect.",
      run: async () => {
        await resetDemo();
        await nextDose();
        router.push("/bear?scenario=offline");
      },
    },
    {
      title: "The check-up",
      body: "Turn patterns into a conversation.",
      run: async () => {
        await signIn(ACCOUNTS.clinician, "clinic");
        router.push(`/clinic/patients/${data?.patient.id ?? "pat_rosa"}?tab=${CHECKUP_TAB}`);
      },
    },
  ];

  const tools: { key: string; label: string; icon: ReactNode; action: object }[] = [
    { key: "t1", label: "+1 hour", icon: <FastForward className="size-4" aria-hidden />, action: { action: "advance", minutes: 60 } },
    { key: "t2", label: "Next dose", icon: <SkipForward className="size-4" aria-hidden />, action: { action: "next-dose", deviceId: DEVICE_ID } },
    { key: "t3", label: "Past window", icon: <TriangleAlert className="size-4" aria-hidden />, action: { action: "past-window", deviceId: DEVICE_ID } },
  ];

  return (
    <div className="grid gap-10 tablet:grid-cols-[0.9fr_1.1fr] tablet:gap-16">
      <Reveal from="left">
        <p className="eyebrow text-cocoa-700">Guided journeys</p>
        <h2 className="mt-3 text-title font-bold text-cocoa tablet:text-section">
          Four stories,
          <br />
          one connected care circle.
        </h2>
        <p className="mt-4 max-w-sm text-body-lg text-muted">
          Follow a short path through the prototype or explore freely by role. The first three start from a fresh demo.
        </p>
        <p className="mt-7 text-body-sm font-bold text-cocoa">Demo tools</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {tools.map((t) => (
            <Button
              key={t.key}
              variant="secondary"
              size="sm"
              icon={t.icon}
              loading={busy === t.key}
              disabled={!demoMode || (busy !== null && busy !== t.key)}
              onClick={() => run(t.key, async () => (await clockAction(t.action)).message)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="mt-3 min-h-6" role="status" aria-live="polite">
          {message && (
            <p className={clsx("text-body font-semibold", message.tone === "error" ? "text-missed-ink" : "text-taken-ink")}>
              {message.text}
            </p>
          )}
        </div>
      </Reveal>
      <ol className="grid gap-3">
        {journeys.map((j, i) => {
          const key = `j${i}`;
          return (
            <Reveal as="li" key={j.title} delay={i * 90} from="right">
              <button
                type="button"
                onClick={() => run(key, j.run)}
                disabled={busy !== null || !demoMode}
                aria-busy={busy === key || undefined}
                className="motion-lift group flex w-full items-center gap-5 rounded-soft border border-line bg-white px-5 py-4 text-left shadow-card transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className="tabular w-7 shrink-0 text-body-lg font-bold text-honey-dark" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-[17px] font-bold text-cocoa">{j.title}</span>
                  <span className="mt-0.5 block text-body text-muted">{j.body}</span>
                </span>
                {busy === key ? (
                  <Spinner className="size-5 shrink-0" />
                ) : (
                  <ChevronRight
                    className="size-5 shrink-0 text-cocoa transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
                    aria-hidden
                  />
                )}
              </button>
            </Reveal>
          );
        })}
      </ol>
    </div>
  );
}
