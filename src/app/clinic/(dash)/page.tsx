"use client";

import clsx from "clsx";
import { ArrowRight, BadgePercent, CalendarOff, CheckCircle2, Download, Eye, FileCheck2, PencilLine, ShieldCheck, Stethoscope, Users, XCircle } from "lucide-react";
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
import { KPI_TONES, StatTile, type KpiTone } from "@/components/ui/stat-tile";
import { Pill } from "@/components/ui/status-pill";
import { useClinicUser } from "@/hooks/use-clinic-user";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { ClinicOverviewDTO } from "@/lib/contracts/clinic";
import { formatDate, formatDateTime, formatTime, greetingFor } from "@/lib/time";

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
        <Skeleton className="h-40 rounded-soft lg:col-span-2" />
      </div>
    </div>
  );
}

/** Sections settle in one after another: short, small, and off with reduced motion. */
const ENTER = ["animate-page-in", "animate-page-in [animation-delay:70ms]", "animate-page-in [animation-delay:140ms]"];

function ClinicianOverview({ c }: { c: ClinicianData }) {
  const today: { label: string; value: number; tone: KpiTone }[] = [
    { label: "Taken", value: c.today.taken, tone: "good" },
    { label: "Late", value: c.today.late, tone: "warn" },
    { label: "Missed", value: c.today.missed, tone: "critical" },
    { label: "Still open", value: c.today.upcoming, tone: "info" },
  ];
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
          icon={<CheckCircle2 className="size-4" />}
        />
        <StatTile
          tone="critical"
          label="Missed · 7 days"
          value={c.week.missed}
          sub={`${c.week.late} more taken late`}
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
              {c.needsAttention.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/clinic/patients/${p.id}?tab=patterns`}
                    className="group -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-200 hover:bg-cream/70"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-cocoa group-hover:underline">{p.fullName}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.reasons.map((r) => (
                          <Pill key={r} tone={r.includes("missed") ? "missed" : "late"}>
                            {r}
                          </Pill>
                        ))}
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
              ))}
            </ul>
          )}
        </Card>

        <Card className={`flex flex-col ${ENTER[1]}`}>
          <CardHeader title="Today" description="Doses across your patients so far" />
          <dl className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 p-5">
            {today.map((t) => (
              <div
                key={t.label}
                className={clsx(
                  "flex min-h-[84px] flex-col justify-center rounded-xl border bg-white bg-gradient-to-br to-white to-60% px-4 py-3",
                  KPI_TONES[t.tone].border,
                  KPI_TONES[t.tone].wash,
                )}
              >
                <dt className="flex items-center gap-1.5 text-body-sm font-bold text-muted">
                  <span className={clsx("size-2 rounded-full", KPI_TONES[t.tone].dot)} aria-hidden />
                  {t.label}
                </dt>
                <dd className="font-display tabular mt-0.5 text-[28px] leading-tight font-extrabold text-cocoa">{t.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

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
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
