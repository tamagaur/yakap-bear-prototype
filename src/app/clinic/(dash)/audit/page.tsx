"use client";

import clsx from "clsx";
import { Download, Eye, FileCheck2, FileX2, PencilLine } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/clinic/clinic-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { AuditEntryDTO } from "@/lib/contracts/clinic";
import type { AuditActionT } from "@/lib/contracts/common";
import { formatDateTime } from "@/lib/time";

const ACTIONS: Record<AuditActionT, { label: string; icon: React.ReactNode; tone: string }> = {
  VIEW_PATIENT: { label: "Viewed record", icon: <Eye className="size-3.5" />, tone: "bg-upcoming-soft text-upcoming-ink" },
  EXPORT_CSV: { label: "Exported CSV", icon: <Download className="size-3.5" />, tone: "bg-honey-200 text-cocoa-800" },
  EXPORT_PDF: { label: "Exported PDF", icon: <Download className="size-3.5" />, tone: "bg-honey-200 text-cocoa-800" },
  CORRECT_LOG: { label: "Log corrected", icon: <PencilLine className="size-3.5" />, tone: "bg-late-soft text-late-ink" },
  CONSENT_GRANT: { label: "Consent given", icon: <FileCheck2 className="size-3.5" />, tone: "bg-taken-soft text-taken-ink" },
  CONSENT_REVOKE: { label: "Consent revoked", icon: <FileX2 className="size-3.5" />, tone: "bg-missed-soft text-missed-ink" },
};

function describe(e: AuditEntryDTO): string {
  const d = (e.details ?? {}) as Record<string, string | number>;
  switch (e.action) {
    case "VIEW_PATIENT":
      return `Opened the ${d.section === "dose-log" ? "dose log" : "patient overview"}`;
    case "EXPORT_CSV":
    case "EXPORT_PDF":
      return `${d.rows ?? "?"} dose rows${d.from ? `, ${d.from} → ${d.to}` : ""}`;
    case "CORRECT_LOG":
      return `${d.dose ?? "Dose"}: ${d.from} → ${d.to} — “${d.reason ?? ""}”`;
    case "CONSENT_GRANT":
      return `For ${d.clinician}, signed by ${d.signedName} (${d.version})`;
    case "CONSENT_REVOKE":
      return `Access removed for ${d.clinician}`;
  }
}

/** Clinic-admin audit view (task D5): who viewed/exported what and when. */
export default function AuditPage() {
  const [action, setAction] = useState<"" | AuditActionT>("");
  const { data, error, isLoading } = useSWR<{ entries: AuditEntryDTO[]; clinicName: string }>(
    `/api/clinic/audit${action ? `?action=${action}` : ""}`,
    fetcher,
    { keepPreviousData: true },
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`${data?.clinicName ?? "Your clinic"} · append-only record of clinician views, exports, consent changes and family corrections.`}
        action={
          <div className="w-56">
            <label htmlFor="action" className="sr-only">Filter by action</label>
            <Select id="action" value={action} onChange={(e) => setAction(e.target.value as "" | AuditActionT)}>
              <option value="">All actions</option>
              {(Object.keys(ACTIONS) as AuditActionT[]).map((a) => (
                <option key={a} value={a}>{ACTIONS[a].label}</option>
              ))}
            </Select>
          </div>
        }
      />
      {error && <Notice tone="error" className="mb-4">{errorMessage(error)}</Notice>}
      <Card className="overflow-hidden">
        {isLoading && !data ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : data && data.entries.length === 0 ? (
          <EmptyState title="No audit entries for this filter" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-cocoa-100 bg-cream-50 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
                <tr>
                  <th scope="col" className="px-5 py-3">When</th>
                  <th scope="col" className="px-3 py-3">Who</th>
                  <th scope="col" className="px-3 py-3">Action</th>
                  <th scope="col" className="px-3 py-3">Patient</th>
                  <th scope="col" className="px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cocoa-100">
                {data?.entries.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-cream-50/70">
                    <td className="px-5 py-3 whitespace-nowrap font-semibold text-cocoa-700 tabular">{formatDateTime(e.simTime)}</td>
                    <td className="px-3 py-3">
                      <span className="font-bold whitespace-nowrap text-cocoa-900">{e.actorName}</span>
                      <span className="block text-xs font-semibold text-cocoa-500">
                        {e.actorRole === "FAMILY" ? "Family" : e.actorRole === "CLINICIAN" ? "Clinician" : e.actorRole === "CLINIC_ADMIN" ? "Clinic admin" : "System"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", ACTIONS[e.action].tone)}>
                        {ACTIONS[e.action].icon}
                        {ACTIONS[e.action].label}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-cocoa-800">{e.patientName ?? "—"}</td>
                    <td className="px-3 py-3 text-cocoa-700">{describe(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs font-semibold text-cocoa-500">
        Entries can&apos;t be edited or deleted (enforced by the database). Revoking consent never removes past entries.
      </p>
    </>
  );
}
