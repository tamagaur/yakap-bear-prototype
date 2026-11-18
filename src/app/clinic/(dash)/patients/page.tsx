"use client";

import clsx from "clsx";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { Pill, StatusPill } from "@/components/ui/status-pill";
import { useClinicUser } from "@/hooks/use-clinic-user";
import { useSimClock } from "@/hooks/use-sim-clock";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { ClinicPatientRowDTO } from "@/lib/contracts/clinic";
import { formatDateTime, formatShortDate, manilaParts } from "@/lib/time";

function pctTone(p: number | null) {
  if (p === null) return "text-cocoa-400";
  if (p >= 85) return "text-taken-ink";
  if (p >= 65) return "text-late-ink";
  return "text-missed-ink";
}

function Bar({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-cocoa-100" aria-hidden>
        <div
          className={clsx("h-full rounded-full", value === null ? "" : value >= 85 ? "bg-taken" : value >= 65 ? "bg-late" : "bg-missed")}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      <span className={clsx("w-10 text-sm font-extrabold tabular", pctTone(value))}>{value === null ? "—" : `${value}%`}</span>
    </div>
  );
}

function PatientList() {
  const { user } = useClinicUser();
  const { now } = useSimClock();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const url = `/api/clinic/patients${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`;
  const { data, error, isLoading } = useSWR<{ patients: ClinicPatientRowDTO[]; role: string }>(url, fetcher, {
    keepPreviousData: true,
  });
  const year = now ? manilaParts(now).year : new Date().getFullYear();

  if (user?.role === "CLINIC_ADMIN") {
    return (
      <>
        <PageHeader title="Patients" />
        <Card>
          <EmptyState title="Clinic admins don't open patient dose logs" mood="calm" action={<ButtonLink href="/clinic/audit">Open the audit log</ButtonLink>}>
            Families give written consent to a specific clinician. As clinic administrator you can review who viewed or
            exported what (audit log) and the clinic plan.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="Only patients whose family signed written consent for you appear here."
        action={
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search patients</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cocoa-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or nickname"
              className="h-11 w-full rounded-xl bg-white pl-9 pr-3 text-sm ring-1 ring-cocoa-200 focus:outline-none focus:ring-2 focus:ring-honey-500"
            />
          </label>
        }
      />
      {error && (
        <Notice tone="error" title="Couldn't load patients" className="mb-4">
          {errorMessage(error)}
        </Notice>
      )}

      <Card className="overflow-hidden">
        {isLoading && !data ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : data && data.patients.length === 0 ? (
          debounced ? (
            <EmptyState title={`No consented patient matches “${debounced}”`}>Try another name or nickname.</EmptyState>
          ) : (
            <EmptyState title="No patients have shared their dose logs with you yet">
              When a family signs written consent for you in the Yakap family app, the patient will appear here.
            </EmptyState>
          )
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-cocoa-100 bg-cream-50 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Patient</th>
                  <th scope="col" className="px-3 py-3">On time · 7 days</th>
                  <th scope="col" className="px-3 py-3">Adherence · 30 days</th>
                  <th scope="col" className="px-3 py-3">Missed · 7 days</th>
                  <th scope="col" className="px-3 py-3">Last dose</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cocoa-100">
                {data?.patients.map((p) => (
                  <tr key={p.id} className="group transition-colors duration-200 hover:bg-cream/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/clinic/patients/${p.id}`} className="block focus:outline-none">
                        <span className="font-extrabold text-cocoa-900 group-hover:underline">{p.fullName}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-cocoa-500">
                          “{p.nickname}”{p.birthYear ? ` · ${year - p.birthYear} y/o` : ""}
                          <span className="inline-flex items-center gap-1 text-taken-ink">
                            <ShieldCheck className="size-3" aria-hidden /> consent since {formatShortDate(p.consentSince)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      {p.hasData ? <span className={clsx("text-base font-black tabular", pctTone(p.onTimePct7))}>{p.onTimePct7 === null ? "—" : `${p.onTimePct7}%`}</span> : <Pill>No data yet</Pill>}
                    </td>
                    <td className="px-3 py-3.5">{p.hasData ? <Bar value={p.adherencePct30} /> : <span className="text-cocoa-400">—</span>}</td>
                    <td className="px-3 py-3.5">
                      <span className={clsx("font-extrabold tabular", p.missed7 > 0 ? "text-missed-ink" : "text-cocoa-500")}>{p.missed7}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      {p.awayNow ? (
                        <Pill tone="away">Away mode</Pill>
                      ) : p.lastDose ? (
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill status={p.lastDose.status} short />
                          <span className="text-xs font-semibold text-cocoa-500">{formatDateTime(p.lastDose.scheduledFor)}</span>
                        </div>
                      ) : (
                        <span className="text-cocoa-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <Link href={`/clinic/patients/${p.id}`} aria-label={`Open ${p.fullName}`} className="inline-grid size-8 place-items-center rounded-lg text-cocoa-400 group-hover:bg-white group-hover:text-cocoa-800">
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs font-semibold text-cocoa-500">
        Self-reported by paw hold on the bear (or corrected by family). Away-mode days are excluded from percentages.
      </p>
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <PatientList />
    </Suspense>
  );
}
