"use client";

import clsx from "clsx";
import {
  ArrowRight,
  BadgePercent,
  CalendarOff,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  Flame,
  PencilLine,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { AUDIT_ACTIONS, roleLabel } from "@/components/clinic/audit-meta";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Skeleton, SkeletonTiles } from "@/components/ui/spinner";
import { KPI_TONES, StatTile, type KpiTone, type Trend } from "@/components/ui/stat-tile";
import { Pill } from "@/components/ui/status-pill";
import { useClinicUser } from "@/hooks/use-clinic-user";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { ClinicOverviewDTO } from "@/lib/contracts/clinic";
import {
  WEEKDAYS_LONG,
  formatDate,
  formatDateKey,
  formatDateTime,
  formatTime,
  formatTimeOfDay,
  greetingFor,
} from "@/lib/time";

type ClinicianData = NonNullable<ClinicOverviewDTO["clinician"]>;
type AdminData = NonNullable<ClinicOverviewDTO["admin"]>;

/** Placeholder shaped like the dashboard: four KPI cards, two equal cards, one wide card. */
function LoadingTiles() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading the dashboard">
      <SkeletonTiles />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-soft" />
        <Skeleton className="h-64 rounded-soft" />
        <Skeleton className="h-48 rounded-soft lg:col-span-2" />
      </div>
    </div>
  );
}

/** Sections settle in one after another: short, small, and off with reduced motion. */
const ENTER = ["animate-page-in", "animate-page-in [animation-delay:70ms]", "animate-page-in [animation-delay:140ms]"];

function onTimeTrend(curr: number | null, prev: number | null): Trend | null {
  if (curr === null || prev === null) return null;
  const diff = curr - prev;
  // The change between two percentages is in percentage points (79% → 58% is −21 pts, not −21%).
  if (diff > 0) return { direction: "up", text: `+${diff} pts vs last week`, good: true };
  if (diff < 0) return { direction: "down", text: `−${Math.abs(diff)} pts vs last week`, good: false };
  return { direction: "flat", text: "Same as last week" };
}

function missedTrend(curr: number, prev: number, prevCounted: number): Trend | null {
  if (prevCounted === 0) return null;
  const diff = curr - prev;
  if (diff < 0) return { direction: "down", text: `${Math.abs(diff)} fewer vs last week`, good: true };
  if (diff > 0) return { direction: "up", text: `+${diff} vs last week`, good: false };
  return { direction: "flat", text: "Same as last week" };
}

/** 6-week clinic adherence trend across all consented patients. */
function WeeklyTrendCard({ weekly }: { weekly: ClinicianData["weekly"] }) {
  return (
    <Card className={`lg:col-span-2 ${ENTER[2]}`}>
      <CardHeader
        icon={<TrendingUp className="size-4" aria-hidden />}
        title="6-week adherence trend"
        description="Weekly on-time and overall adherence across your consented patients (oldest → this week)."
      />
      <div className="p-5 pt-4">
        {/* One column per week: green = on time, amber = late, the empty rest = missed. */}
        <ol className="grid grid-cols-6 items-end gap-2 sm:gap-4">
          {weekly.map((w, idx) => {
            const isLatest = idx === weekly.length - 1;
            const onTime = w.onTimePct ?? 0;
            const totalAdh = w.adherencePct ?? 0;
            const latePct = Math.max(0, totalAdh - onTime);
            return (
              <li key={w.from} className="flex min-w-0 flex-col items-center">
                <span
                  className={clsx(
                    "font-display tabular text-[15px] font-extrabold sm:text-lg",
                    isLatest ? "text-teal" : "text-cocoa",
                  )}
                >
                  {w.onTimePct === null ? "—" : `${w.onTimePct}%`}
                </span>
                <span
                  className={clsx(
                    "relative mt-1.5 flex h-32 w-full max-w-[56px] flex-col-reverse overflow-hidden rounded-t-lg rounded-b-sm bg-cocoa-100/70",
                    isLatest && "ring-2 ring-teal/45 ring-offset-2 ring-offset-white",
                  )}
                  role="img"
                  aria-label={`${formatDateKey(w.from)} to ${formatDateKey(w.to)}: ${w.onTimePct ?? 0}% on time, ${w.adherencePct ?? 0}% total adherence (${w.counted} doses)`}
                >
                  <span className="w-full bg-taken transition-[height] duration-500" style={{ height: `${onTime}%` }} />
                  {latePct > 0 && <span className="w-full bg-late transition-[height] duration-500" style={{ height: `${latePct}%` }} />}
                </span>
                <span className={clsx("mt-2 text-center text-[11px] leading-tight font-bold", isLatest ? "text-teal" : "text-muted")}>
                  {isLatest ? "This week" : `${weekly.length - 1 - idx} wk ago`}
                </span>
                <span className="tabular hidden text-center text-[11px] text-muted sm:block">
                  {formatDateKey(w.from)} · {w.counted} doses
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-cocoa-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-taken" aria-hidden /> Taken on time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-late" aria-hidden /> Taken late
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-cocoa-100" aria-hidden /> Missed
          </span>
        </div>
      </div>
    </Card>
  );
}

function ClinicianOverview({ c }: { c: ClinicianData }) {
  const today: { label: string; value: number; tone: KpiTone }[] = [
    { label: "Taken", value: c.today.taken, tone: "good" },
    { label: "Late", value: c.today.late, tone: "warn" },
    { label: "Missed", value: c.today.missed, tone: "critical" },
    { label: "Still open", value: c.today.upcoming, tone: "info" },
  ];
  const todayTotal = today.reduce((n, t) => n + t.value, 0);
  return (
    <div className="space-y-5">
      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${ENTER[0]}`}>
        <StatTile
          tone="info"
          label="Patients sharing logs"
          value={c.patients}
          sub={`${c.withData} with dose data`}
          icon={<Users className="size-4" />}
          href="/clinic/patients"
        />
        <StatTile
          tone="good"
          label="On time · 7 days"
          value={c.week.onTimePct === null ? "—" : `${c.week.onTimePct}%`}
          sub={`${c.week.taken} of ${c.week.counted} doses, all patients`}
          trend={onTimeTrend(c.week.onTimePct, c.weekPrev.onTimePct)}
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatTile
          tone="critical"
          label="Missed · 7 days"
          value={c.week.missed}
          sub={`${c.week.late} more taken late`}
          trend={missedTrend(c.week.missed, c.weekPrev.missed, c.weekPrev.counted)}
          icon={<XCircle className="size-4" />}
        />
        <StatTile
          tone="neutral"
          label="In away mode now"
          value={c.awayNow}
          sub="excused, excluded from %"
          icon={<CalendarOff className="size-4" />}
        />
      </div>

      {/* Needs attention and Today: one row, same width, same height, same padding. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className={`flex flex-col ${ENTER[1]}`}>
          <CardHeader
            title="Needs attention"
            description="2+ missed doses or under 70% on time this week, or one dose time missed 3+ times in 4 weeks."
            action={
              <Link
                href="/clinic/patients"
                className="inline-flex min-h-9 items-center text-sm font-bold whitespace-nowrap text-muted transition-colors hover:text-cocoa"
              >
                All patients →
              </Link>
            }
          />
          {c.needsAttention.length === 0 ? (
            <div className="grid flex-1 place-items-center">
              <EmptyState title="Everyone is on track this week" mood="happy">
                No patient has two or more missed doses or low on-time adherence in the last 7 days.
              </EmptyState>
            </div>
          ) : (
            <ul className="flex-1 divide-y divide-cocoa-100 px-5 pt-2 pb-3">
              {c.needsAttention.map((p) => {
                const topText =
                  p.topPattern &&
                  `${WEEKDAYS_LONG[p.topPattern.weekday]} ${formatTimeOfDay(p.topPattern.timeOfDay)} (${p.topPattern.missed}/${p.topPattern.total} missed)`;
                const showTopPill = topText && !p.reasons.some((r) => r.includes(WEEKDAYS_LONG[p.topPattern!.weekday]));
                return (
                  <li key={p.id}>
                    <Link
                      href={`/clinic/patients/${p.id}?tab=patterns`}
                      className="group -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-200 hover:bg-cream/70"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-bold text-cocoa group-hover:underline">{p.fullName}</span>
                          <span className="text-xs font-semibold text-muted">“{p.nickname}”</span>
                          {p.onTimePct7 !== null && (
                            <span className="tabular text-xs font-extrabold text-cocoa-600">· {p.onTimePct7}% on time (7d)</span>
                          )}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {p.reasons.map((r) => (
                            <Pill key={r} tone={r.includes("missed") ? "missed" : "late"}>
                              {r}
                            </Pill>
                          ))}
                          {showTopPill && (
                            <Pill tone="late" icon={<Flame className="size-3" aria-hidden />}>
                              Hotspot: {topText}
                            </Pill>
                          )}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-bold whitespace-nowrap text-muted group-hover:text-cocoa">
                        See patterns
                        <ArrowRight
                          className="size-4 transition-transform duration-300 ease-out-expo group-hover:translate-x-1"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className={`flex flex-col ${ENTER[1]}`}>
          <CardHeader title="Today" description="Doses across your patients so far" />
          <div className="flex flex-1 flex-col justify-center gap-5 p-5">
            <p className="flex items-baseline gap-2">
              <span className="font-display tabular text-[40px] leading-none font-extrabold text-cocoa">{todayTotal}</span>
              <span className="text-body font-semibold text-muted">
                {todayTotal === 1 ? "dose scheduled today" : "doses scheduled today"}
              </span>
            </p>
            {todayTotal > 0 && (
              <span className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-cocoa-100" aria-hidden>
                {today
                  .filter((t) => t.value > 0)
                  .map((t) => (
                    <span key={t.label} className={clsx("h-full", KPI_TONES[t.tone].dot)} style={{ flexGrow: t.value }} />
                  ))}
              </span>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {today.map((t) => (
                <div key={t.label} className="flex items-center justify-between gap-3 border-b border-cocoa-100 pb-2">
                  <dt className="flex items-center gap-2 text-body font-semibold text-cocoa-700">
                    <span className={clsx("size-2.5 rounded-full", KPI_TONES[t.tone].dot)} aria-hidden />
                    {t.label}
                  </dt>
                  <dd className="font-display tabular text-xl font-extrabold text-cocoa">{t.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        {c.weekly.length > 0 && <WeeklyTrendCard weekly={c.weekly} />}

        {/* Recent missed doses: directly below, laid out across the row. */}
        <Card className={`lg:col-span-2 ${ENTER[2]}`}>
          <CardHeader title="Recent missed doses" description="Last 7 days" />
          {c.recentMissed.length === 0 ? (
            <p className="px-5 pt-3 pb-5 text-body font-semibold text-muted">No missed doses this week.</p>
          ) : (
            <ul className="grid gap-3 p-5 pt-4 mobile:grid-cols-2 xl:grid-cols-3">
              {c.recentMissed.map((m) => (
                <li key={`${m.patientId}-${m.scheduledFor}`}>
                  <Link
                    href={`/clinic/patients/${m.patientId}?tab=log`}
                    className="motion-lift group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-card"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-cocoa group-hover:underline">{m.fullName}</span>
                      <span className="tabular block truncate text-body-sm text-muted">
                        {formatDate(m.scheduledFor)} · {formatTime(m.scheduledFor)} {m.label}
                      </span>
                    </span>
                    <Pill tone="missed" dot>
                      Missed
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="text-body-sm text-muted">
        Self-reported by paw hold on the bear (or corrected by family). Only patients whose family gave you written consent are
        included; away-mode doses are excluded from percentages.
      </p>
    </div>
  );
}

function AdminOverview({ a }: { a: AdminData }) {
  return (
    <div className="space-y-5">
      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${ENTER[0]}`}>
        <StatTile tone="info" label="Clinicians" value={a.clinicians} sub="at this clinic" icon={<Stethoscope className="size-4" />} />
        <StatTile
          tone="good"
          label="Active consents"
          value={a.activeConsents}
          sub={`${a.consentingPatients} patients sharing logs`}
          icon={<ShieldCheck className="size-4" />}
        />
        <StatTile
          tone="info"
          label="Record views · 7 days"
          value={a.views7}
          sub="by clinic staff"
          icon={<Eye className="size-4" />}
          href="/clinic/audit"
        />
        <StatTile
          tone="info"
          label="Exports · 7 days"
          value={a.exports7}
          sub="CSV, PDF and printed sheets"
          icon={<Download className="size-4" />}
          href="/clinic/audit"
        />
      </div>

      <div className={`grid gap-5 lg:grid-cols-3 ${ENTER[1]}`}>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            description="Latest entries in the clinic audit log"
            action={
              <Link href="/clinic/audit" className="text-sm font-bold text-cocoa-600 hover:underline">
                Open audit log →
              </Link>
            }
          />
          {a.recentActivity.length === 0 ? (
            <EmptyState title="No activity recorded yet" />
          ) : (
            <ul className="divide-y divide-cocoa-100 px-5 pb-3 pt-2">
              {a.recentActivity.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-bold text-cocoa-900">{e.actorName}</span>{" "}
                    <span className="text-xs font-semibold text-cocoa-500">({roleLabel(e.actorRole)})</span>
                    {e.patientName && <span className="text-cocoa-700"> · {e.patientName}</span>}
                    <span className="block text-xs font-semibold text-cocoa-500">{formatDateTime(e.simTime)}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${AUDIT_ACTIONS[e.action].tone}`}>
                    {AUDIT_ACTIONS[e.action].icon}
                    {AUDIT_ACTIONS[e.action].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Privacy activity" description="Last 7 days" />
            <ul className="space-y-3 p-5 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-semibold text-cocoa-700">
                  <FileCheck2 className="size-4 text-taken" aria-hidden /> Consents given or revoked
                </span>
                <span className="text-lg font-black tabular">{a.consentChanges7}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-semibold text-cocoa-700">
                  <PencilLine className="size-4 text-late" aria-hidden /> Family log corrections
                </span>
                <span className="text-lg font-black tabular">{a.corrections7}</span>
              </li>
            </ul>
            <p className="border-t border-cocoa-100 px-5 py-3 text-xs font-semibold text-cocoa-500">
              Patient dose logs are visible only to the clinician each family consented to — not to clinic admins.
            </p>
          </Card>
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-honey-200 text-cocoa-800">
                <BadgePercent className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-extrabold">Clinic plan</p>
                <p className="text-sm text-cocoa-600">₱30,000 / year · pilot (prototype — no billing)</p>
                <Link href="/clinic/plan" className="mt-2 inline-block text-sm font-bold text-cocoa-700 hover:underline">
                  View plan &amp; bulk orders →
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const { user } = useClinicUser();
  const { data, error, isLoading } = useSWR<ClinicOverviewDTO>("/api/clinic/overview", fetcher, { refreshInterval: 30_000 });
  // "Dr. Paolo Reyes" → "Dr. Reyes"; "Carla Dizon" → "Carla"
  const firstName = !user ? "" : user.name.startsWith("Dr.") ? `Dr. ${user.name.split(" ").at(-1)}` : user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={data ? `${greetingFor(data.now)}, ${firstName}` : "Dashboard"}
        description={
          user?.role === "CLINIC_ADMIN"
            ? `${user.clinicName ?? "Your clinic"} · clinic-wide summary`
            : `${user?.clinicName ?? "Your clinic"} · overview of the patients who share their dose log with you`
        }
        action={
          user?.role === "CLINIC_ADMIN" ? (
            <ButtonLink href="/clinic/audit" variant="secondary">
              Audit log
            </ButtonLink>
          ) : (
            <ButtonLink href="/clinic/patients" variant="secondary">
              All patients
            </ButtonLink>
          )
        }
      />
      {params.get("denied") === "audit" && (
        <Notice tone="warning" className="mb-5">
          The audit log is only available to clinic administrators.
        </Notice>
      )}
      {error ? (
        <Notice tone="error" title="Couldn't load the dashboard">
          {errorMessage(error)}
        </Notice>
      ) : isLoading || !data ? (
        <LoadingTiles />
      ) : data.admin ? (
        <AdminOverview a={data.admin} />
      ) : data.clinician ? (
        <ClinicianOverview c={data.clinician} />
      ) : null}
    </>
  );
}

/** Clinic dashboard home page (default landing after sign-in). */
export default function ClinicDashboardPage() {
  return (
    <Suspense fallback={<LoadingTiles />}>
      <Dashboard />
    </Suspense>
  );
}
