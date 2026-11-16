"use client";

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
import { Skeleton } from "@/components/ui/spinner";
import { StatTile } from "@/components/ui/stat-tile";
import { Pill } from "@/components/ui/status-pill";
import { useClinicUser } from "@/hooks/use-clinic-user";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { ClinicOverviewDTO } from "@/lib/contracts/clinic";
import { TONE_CLASSES } from "@/lib/status";
import { formatDate, formatDateTime, formatTime, greetingFor } from "@/lib/time";

type ClinicianData = NonNullable<ClinicOverviewDTO["clinician"]>;
type AdminData = NonNullable<ClinicOverviewDTO["admin"]>;

function LoadingTiles() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function ClinicianOverview({ c }: { c: ClinicianData }) {
  const today = [
    { label: "Taken", value: c.today.taken, tone: TONE_CLASSES.taken.dot },
    { label: "Late", value: c.today.late, tone: TONE_CLASSES.late.dot },
    { label: "Missed", value: c.today.missed, tone: TONE_CLASSES.missed.dot },
    { label: "Still open", value: c.today.upcoming, tone: TONE_CLASSES.upcoming.dot },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Patients sharing logs"
          value={c.patients}
          sub={`${c.withData} with dose data`}
          icon={<Users className="size-4" />}
          accent="bg-upcoming-soft text-upcoming-ink"
          href="/clinic/patients"
        />
        <StatTile
          label="On time · 7 days"
          value={c.week.onTimePct === null ? "—" : `${c.week.onTimePct}%`}
          sub={`${c.week.taken} of ${c.week.counted} doses, all patients`}
          icon={<CheckCircle2 className="size-4" />}
          accent="bg-taken-soft text-taken-ink"
        />
        <StatTile
          label="Missed · 7 days"
          value={c.week.missed}
          sub={`${c.week.late} more taken late`}
          icon={<XCircle className="size-4" />}
          accent="bg-missed-soft text-missed-ink"
        />
        <StatTile
          label="In away mode now"
          value={c.awayNow}
          sub="excused, excluded from %"
          icon={<CalendarOff className="size-4" />}
          accent="bg-away-soft text-away-ink"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 lg:self-start">
          <CardHeader
            title="Needs attention"
            description="Two or more missed doses, or under 70% on time, in the last 7 days."
            action={
              <Link href="/clinic/patients" className="text-sm font-bold text-cocoa-600 hover:underline">
                All patients →
              </Link>
            }
          />
          {c.needsAttention.length === 0 ? (
            <EmptyState title="Everyone is on track this week" mood="happy">
              No patient has two or more missed doses or low on-time adherence in the last 7 days.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-cocoa-100 px-5 pb-3 pt-2">
              {c.needsAttention.map((p) => (
                <li key={p.id}>
                  <Link href={`/clinic/patients/${p.id}?tab=patterns`} className="group flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block font-extrabold text-cocoa-900 group-hover:underline">{p.fullName}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {p.reasons.map((r) => (
                          <Pill key={r} tone={r.includes("missed") ? "missed" : "late"}>
                            {r}
                          </Pill>
                        ))}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-cocoa-500 group-hover:text-cocoa-900">
                      See patterns <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Today" description="Doses across your patients so far" />
            <dl className="grid grid-cols-2 gap-3 p-5">
              {today.map((t) => (
                <div key={t.label} className="rounded-xl bg-cream-50 px-3 py-2.5 ring-1 ring-cocoa-100">
                  <dt className="flex items-center gap-1.5 text-xs font-bold text-cocoa-600">
                    <span className={`size-2 rounded-full ${t.tone}`} aria-hidden />
                    {t.label}
                  </dt>
                  <dd className="mt-0.5 text-2xl font-black text-cocoa-900 tabular">{t.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Recent missed doses" description="Last 7 days" />
            {c.recentMissed.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm font-semibold text-cocoa-500">No missed doses this week.</p>
            ) : (
              <ul className="divide-y divide-cocoa-100 px-5 pb-3 pt-2">
                {c.recentMissed.map((m) => (
                  <li key={`${m.patientId}-${m.scheduledFor}`}>
                    <Link href={`/clinic/patients/${m.patientId}?tab=log`} className="group flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-cocoa-900 group-hover:underline">{m.fullName}</span>
                        <span className="text-xs font-semibold text-cocoa-500">
                          {formatDate(m.scheduledFor)} · {formatTime(m.scheduledFor)} {m.label}
                        </span>
                      </span>
                      <Pill tone="missed">Missed</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <p className="text-xs font-semibold text-cocoa-500">
        Self-reported by paw hold on the bear (or corrected by family). Only patients whose family gave you written consent are
        included; away-mode doses are excluded from percentages.
      </p>
    </div>
  );
}

function AdminOverview({ a }: { a: AdminData }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clinicians" value={a.clinicians} sub="at this clinic" icon={<Stethoscope className="size-4" />} accent="bg-upcoming-soft text-upcoming-ink" />
        <StatTile
          label="Active consents"
          value={a.activeConsents}
          sub={`${a.consentingPatients} patients sharing logs`}
          icon={<ShieldCheck className="size-4" />}
          accent="bg-taken-soft text-taken-ink"
        />
        <StatTile label="Record views · 7 days" value={a.views7} sub="by clinic staff" icon={<Eye className="size-4" />} accent="bg-cream-200 text-cocoa-700" href="/clinic/audit" />
        <StatTile label="Exports · 7 days" value={a.exports7} sub="CSV and PDF" icon={<Download className="size-4" />} accent="bg-honey-200 text-cocoa-800" href="/clinic/audit" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
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
