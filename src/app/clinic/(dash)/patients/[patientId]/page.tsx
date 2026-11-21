"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  BatteryCharging,
  BatteryLow,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  MessageSquare,
  Printer,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AdherenceCards } from "@/components/clinic/adherence-cards";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { DailyChart } from "@/components/clinic/daily-chart";
import { DoseLogTable, type LogFilters } from "@/components/clinic/dose-log-table";
import { ExportButtons } from "@/components/clinic/export-buttons";
import { PatternHeatmap } from "@/components/clinic/pattern-heatmap";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Skeleton, SkeletonPage } from "@/components/ui/spinner";
import { Pill, StatusPill } from "@/components/ui/status-pill";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { ApiClientError, apiFetch, errorMessage, fetcher } from "@/lib/api-client";
import type { AdherenceSummaryDTO, ClinicPatientDetailDTO, PatternDTO } from "@/lib/contracts/clinic";
import { LOGGED_BY_LABEL } from "@/lib/status";
import {
  WEEKDAYS_LONG,
  addDaysToKey,
  formatDateKey,
  formatDateTime,
  formatShortDate,
  formatTime,
  formatTimeOfDay,
  manilaDateKey,
  manilaParts,
} from "@/lib/time";

const TABS: TabItem<"overview" | "log" | "patterns" | "checkup">[] = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Dose log" },
  { id: "patterns", label: "Patterns" },
  { id: "checkup", label: "Check-up sheet" },
];
type TabId = (typeof TABS)[number]["id"];

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-cream-200/70 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-lg px-3 py-1.5 text-sm font-bold transition-colors",
            value === o.value ? "bg-white text-cocoa-900 shadow-sm" : "text-cocoa-600 hover:text-cocoa-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AccessDenied() {
  return (
    <Card>
      <EmptyState
        title="You don't have consent to view this record"
        mood="sleepy"
        action={
          <ButtonLink href="/clinic/patients" variant="secondary">
            Back to your patients
          </ButtonLink>
        }
      >
        Dose logs are only visible to the clinician the family gave written consent to. If consent was revoked, access
        stopped immediately. This attempt was not shown any patient data.
      </EmptyState>
    </Card>
  );
}

/** Paired bear device summary: ID, battery %, last check-in, no-mic guarantee. */
function PairedBearSection({ device }: { device: ClinicPatientDetailDTO["device"] }) {
  if (!device) {
    return (
      <div className="border-t border-cocoa-100 px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
          <Radio className="size-3.5" aria-hidden /> Paired Yakap Bear
        </p>
        <p className="mt-1 text-sm font-semibold text-cocoa-500">No bear paired yet</p>
      </div>
    );
  }
  const lowBattery = device.batteryPct <= 20;
  return (
    <div className="border-t border-cocoa-100 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
          <Radio className="size-3.5 text-teal" aria-hidden /> Paired Yakap Bear
        </p>
        <Pill
          tone={lowBattery ? "late" : "taken"}
          compact
          icon={lowBattery ? <BatteryLow className="size-3.5" aria-hidden /> : <BatteryCharging className="size-3.5" aria-hidden />}
        >
          {device.batteryPct}% battery
        </Pill>
      </div>
      <p className="mt-1.5 text-sm font-extrabold text-cocoa-900 tabular">
        {device.id}
        <span className="ml-2 text-xs font-semibold text-cocoa-500">
          {device.lastSeenAt ? `Last synced ${formatDateTime(device.lastSeenAt)}` : "Awaiting first sync"}
        </span>
      </p>
    </div>
  );
}

function Detail() {
  const { patientId } = useParams<{ patientId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as TabId;
  const setTab = (t: TabId) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const { data: d, error } = useSWR<ClinicPatientDetailDTO>(`/api/clinic/patients/${patientId}`, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const [days, setDays] = useState<7 | 30>(7);
  const [pdays, setPdays] = useState<28 | 42>(28);
  const { data: summary } = useSWR<AdherenceSummaryDTO>(
    d ? `/api/clinic/patients/${patientId}/summary?days=${days}` : null,
    fetcher,
  );
  const { data: summary30 } = useSWR<AdherenceSummaryDTO>(
    d && tab === "checkup" ? `/api/clinic/patients/${patientId}/summary?days=30` : null,
    fetcher,
  );
  const { data: pattern } = useSWR<PatternDTO>(
    d && (tab === "patterns" || tab === "checkup") ? `/api/clinic/patients/${patientId}/pattern?days=${pdays}` : null,
    fetcher,
  );

  const today = d ? manilaDateKey(d.now) : null;
  const [chosenFilters, setFilters] = useState<LogFilters | null>(null);
  const filters: LogFilters | null =
    chosenFilters ??
    (today
      ? {
          from: addDaysToKey(today, -29),
          to: today,
          statuses: ["TAKEN", "LATE", "MISSED", "AWAY"],
          sort: "scheduledFor",
          order: "desc",
        }
      : null);
  const [toast, setToast] = useState<string | null>(null);
  const [printingSheet, setPrintingSheet] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const age = useMemo(() => (d?.birthYear ? manilaParts(d.now).year - d.birthYear : null), [d]);

  const printOnScreenSheet = async () => {
    if (!d || !filters) return;
    setPrintingSheet(true);
    try {
      await apiFetch(`/api/clinic/patients/${d.id}/export-log`, {
        json: { format: "print", from: filters.from, to: filters.to },
      });
      setToast("Check-up sheet audited (PRINT_CHECKUP) and sent to printer.");
      if (typeof window !== "undefined" && typeof window.print === "function") {
        window.print();
      }
    } catch (e) {
      setToast(`Check-up sheet print failed: ${errorMessage(e)}`);
    } finally {
      setPrintingSheet(false);
    }
  };

  if (error) {
    return error instanceof ApiClientError && error.status === 403 ? (
      <AccessDenied />
    ) : (
      <Notice tone="error" title="Couldn't open this patient">
        {errorMessage(error)}
      </Notice>
    );
  }
  if (!d || !filters) return <SkeletonPage label="Opening the dose log…" />;
  const hasData = !!d.firstDoseDate;

  return (
    <div>
      <Link
        href="/clinic/patients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-cocoa-600 hover:text-cocoa-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> All patients
      </Link>
      <PageHeader
        title={
          <span>
            {d.fullName}{" "}
            <span className="text-lg font-bold text-cocoa-500">
              “{d.nickname}”{age ? ` · ${age} y/o` : ""}
            </span>
          </span>
        }
        description={
          <span className="inline-flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-taken" aria-hidden />
            <span>
              Written consent since {formatShortDate(d.consent.grantedAt)} · signed by {d.consent.signedName} (
              {d.consent.consentVersion})
            </span>
          </span>
        }
        action={<ExportButtons patientId={d.id} from={filters.from} to={filters.to} onExported={setToast} />}
      />
      {toast && (
        <Notice tone={toast.includes("failed") ? "error" : "success"} className="mb-4">
          {toast}
        </Notice>
      )}

      <Tabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        label="Patient record"
        idPrefix="patient-tab"
        className="mb-5"
      />

      {tab === "overview" && (
        <div id="patient-tab-panel-overview" className="space-y-5" role="tabpanel" aria-labelledby="patient-tab-overview">
          {!hasData ? (
            <Card>
              <EmptyState title="No dose data yet" mood="calm">
                {d.nickname}&apos;s bear was set up recently.
                {d.schedules[0] ? ` The first scheduled dose is at ${formatTimeOfDay(d.schedules[0].timeOfDay)}.` : ""}{" "}
                Adherence cards and patterns will appear after the first doses.
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-black">Adherence</h2>
                <Segmented
                  label="Period"
                  value={days}
                  onChange={setDays}
                  options={[
                    { value: 7, label: "Last 7 days" },
                    { value: 30, label: "Last 30 days" },
                  ]}
                />
              </div>
              {summary ? <AdherenceCards s={summary} /> : <Skeleton className="h-28" />}
              {d.awayPeriods.some((a) => a.active) && (
                <Notice tone="info" title="Away mode is on">
                  {d.awayPeriods
                    .filter((a) => a.active)
                    .map((a) => `${a.reason}: ${formatDateKey(a.startDate)} – ${formatDateKey(a.endDate)}`)
                    .join("; ")}
                  . Doses on these days are excused and excluded from the percentages.
                </Notice>
              )}
            </>
          )}

          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
            {hasData && (
              <Card className="lg:col-span-2">
                <CardHeader
                  title={`Doses per day · last ${days} days`}
                  description="Stacked by outcome. Hover a day for details."
                />
                <div className="p-5">{summary ? <DailyChart daily={summary.daily} /> : <Skeleton className="h-36" />}</div>
              </Card>
            )}
            <Card className={clsx(!hasData && "lg:col-span-3")}>
              <CardHeader title="Schedule" description="One check-in per dose time" />
              <ul className="divide-y divide-cocoa-100 px-5 pb-2 pt-3">
                {d.schedules.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <p className="font-extrabold tabular">
                      {formatTimeOfDay(s.timeOfDay)} <span className="font-bold text-cocoa-600">· {s.label}</span>
                    </p>
                    <p className="text-xs font-semibold text-cocoa-500">
                      ±{s.windowMinutes} min on time · +{s.lateMinutes} min late{s.pillNote ? ` · ${s.pillNote}` : ""}
                    </p>
                  </li>
                ))}
              </ul>

              <PairedBearSection device={d.device} />

              <div className="border-t border-cocoa-100 px-5 py-4">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                  <Users className="size-3.5" aria-hidden /> Family caregivers
                </p>
                {d.familyContacts.length === 0 ? (
                  <p className="mt-1 text-sm font-semibold text-cocoa-500">—</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {d.familyContacts.map((c) => (
                      <li key={`${c.name}-${c.relationship}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-cocoa-800">
                          {c.name} <span className="text-xs text-cocoa-500">({c.relationship})</span>
                        </span>
                        <Pill
                          tone={c.receivesSms ? "upcoming" : "neutral"}
                          compact
                          icon={c.receivesSms ? <MessageSquare className="size-3" aria-hidden /> : undefined}
                        >
                          {c.receivesSms ? "SMS alerts on" : "No SMS"}
                        </Pill>
                      </li>
                    ))}
                  </ul>
                )}
                {d.awayPeriods.length > 0 && (
                  <>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                      <CalendarOff className="size-3.5" aria-hidden /> Away periods
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-cocoa-700">
                      {d.awayPeriods.map((a) => (
                        <li key={a.startDate}>
                          {formatDateKey(a.startDate)} – {formatDateKey(a.endDate)} · {a.reason}{" "}
                          {a.active && <Pill tone="away">now</Pill>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-3 flex items-start gap-1.5 text-xs text-cocoa-500">
                  <Lock className="mt-0.5 size-3 shrink-0" aria-hidden /> Family voice recordings are never shared with
                  clinicians, and the bear has no microphone.
                </p>
              </div>
            </Card>
          </div>

          {hasData && (
            <Card>
              <CardHeader
                title="Recent doses"
                action={
                  <button
                    type="button"
                    className="text-sm font-bold text-cocoa-600 hover:underline"
                    onClick={() => setTab("log")}
                  >
                    Full dose log →
                  </button>
                }
              />
              <ul className="divide-y divide-cocoa-100 px-5 pb-3 pt-2">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="font-semibold text-cocoa-800">
                      {formatDateTime(r.scheduledFor)} <span className="text-cocoa-500">· {r.label}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-cocoa-500">
                        {r.takenAt ? `at ${formatTime(r.takenAt)}` : ""}{" "}
                        {r.loggedBy ? `· ${LOGGED_BY_LABEL[r.loggedBy]}` : ""}
                        {r.corrected ? " · corrected" : ""}
                      </span>
                      <StatusPill status={r.status} short />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "log" && (
        <Card id="patient-tab-panel-log" className="overflow-hidden" role="tabpanel" aria-labelledby="patient-tab-log">
          <DoseLogTable patientId={d.id} filters={filters} onChange={setFilters} />
        </Card>
      )}

      {tab === "patterns" && (
        <Card id="patient-tab-panel-patterns" role="tabpanel" aria-labelledby="patient-tab-patterns">
          <CardHeader
            title="When are doses missed?"
            description="Missed doses by weekday and dose time — simple counts, no prediction."
            action={
              <Segmented
                label="Window"
                value={pdays}
                onChange={setPdays}
                options={[
                  { value: 28, label: "4 weeks" },
                  { value: 42, label: "6 weeks" },
                ]}
              />
            }
          />
          <div className="p-5">
            {!pattern ? (
              <Skeleton className="h-72" />
            ) : pattern.times.length === 0 ? (
              <EmptyState title="Not enough data for patterns yet" />
            ) : (
              <>
                {pattern.hotspots.length > 0 ? (
                  <Notice tone="warning" className="mb-4" title="Most often missed">
                    {pattern.hotspots
                      .map((h) => `${WEEKDAYS_LONG[h.weekday]} ${formatTimeOfDay(h.timeOfDay)} (${h.missed} of ${h.total})`)
                      .join(" · ")}
                  </Notice>
                ) : (
                  <Notice tone="success" className="mb-4">
                    No missed doses in this period.
                  </Notice>
                )}
                <PatternHeatmap pattern={pattern} />
              </>
            )}
          </div>
        </Card>
      )}

      {tab === "checkup" && (
        <div id="patient-tab-panel-checkup" className="space-y-5" role="tabpanel" aria-labelledby="patient-tab-checkup">
          <Card>
            <CardHeader
              icon={<ClipboardCheck className="size-4" aria-hidden />}
              title="One-page check-up summary sheet"
              description="Prepared for your appointment conversation with the patient and their family caregiver."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  loading={printingSheet}
                  icon={<Printer className="size-4" aria-hidden />}
                  onClick={printOnScreenSheet}
                >
                  Print this sheet
                </Button>
              }
            />
            <div className="space-y-5 p-5">
              {!hasData ? (
                <EmptyState title="No dose history for a check-up sheet yet" mood="calm">
                  Once {d.nickname} begins logging doses on the bear, this sheet summarizes 30-day adherence and weekly
                  patterns for your check-up conversation.
                </EmptyState>
              ) : !summary30 || !pattern ? (
                <Skeleton className="h-64" />
              ) : (
                <>
                  <AdherenceCards s={summary30} />

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-soft border border-line bg-cream/60 p-4">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-teal">
                        <Sparkles className="size-3.5" aria-hidden /> Suggested check-up conversation starters
                      </p>
                      <ul className="mt-3 space-y-2.5 text-sm text-cocoa-800">
                        {pattern.hotspots.length > 0 ? (
                          pattern.hotspots.map((h) => (
                            <li key={`${h.weekday}-${h.timeOfDay}`} className="flex items-start gap-2">
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-missed" aria-hidden />
                              <span>
                                <strong className="font-extrabold">
                                  {WEEKDAYS_LONG[h.weekday]} at {formatTimeOfDay(h.timeOfDay)}
                                </strong>{" "}
                                was missed {h.missed} of {h.total} times over the last {pattern.days} days — ask about{" "}
                                {WEEKDAYS_LONG[h.weekday]} routine changes or whether a slightly shifted dose window would
                                fit better.
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-taken" aria-hidden />
                            <span>
                              No recurring weekday/time missed-dose hotspots over the last {pattern.days} days — reinforce
                              the current routine!
                            </span>
                          </li>
                        )}
                        {summary30.late > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-late" aria-hidden />
                            <span>
                              <strong className="font-extrabold">{summary30.late} doses were logged late</strong> in the
                              last 30 days (within the +{d.schedules[0]?.lateMinutes ?? 60} min grace period). Check if the
                              family voice reminder volume or timing feels comfortable.
                            </span>
                          </li>
                        )}
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" aria-hidden />
                          <span>
                            <strong className="font-extrabold">
                              {summary30.onTimePct ?? 0}% on-time check-ins ({summary30.taken} of {summary30.counted} doses)
                            </strong>{" "}
                            — acknowledge the effort of both {d.nickname} and{" "}
                            {d.familyContacts.map((c) => c.name).join(" & ") || "the family"}.
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-soft border border-line bg-paper p-4">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                        Routine &amp; Care Circle Snapshot
                      </p>
                      <dl className="mt-3 space-y-2.5 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cocoa-100 pb-2">
                          <dt className="font-bold text-cocoa-600">Dose schedule</dt>
                          <dd className="font-extrabold text-cocoa-900 tabular">
                            {d.schedules.map((s) => `${formatTimeOfDay(s.timeOfDay)} (${s.label})`).join(" · ") || "—"}
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cocoa-100 pb-2">
                          <dt className="font-bold text-cocoa-600">Paired Yakap Bear</dt>
                          <dd className="font-extrabold text-cocoa-900 tabular">
                            {d.device ? `${d.device.id} (${d.device.batteryPct}% battery)` : "None"}
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cocoa-100 pb-2">
                          <dt className="font-bold text-cocoa-600">SMS alert recipients</dt>
                          <dd className="font-semibold text-cocoa-800">
                            {d.familyContacts
                              .filter((c) => c.receivesSms)
                              .map((c) => `${c.name} (${c.relationship})`)
                              .join(", ") || "None enabled"}
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <dt className="font-bold text-cocoa-600">Written consent</dt>
                          <dd className="font-semibold text-cocoa-800">
                            Signed by {d.consent.signedName} · {formatShortDate(d.consent.grantedAt)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function PatientDetailPage() {
  return (
    <Suspense>
      <Detail />
    </Suspense>
  );
}
