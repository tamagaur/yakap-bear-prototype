"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown, PencilLine } from "lucide-react";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { errorMessage, fetcher } from "@/lib/api-client";
import type { DoseStatusT } from "@/lib/contracts/common";
import type { DoseEventDTO } from "@/lib/contracts/doses";
import { LOGGED_BY_LABEL, STATUS_META, TONE_CLASSES } from "@/lib/status";
import { formatDate, formatShortDate, formatTime } from "@/lib/time";

export interface LogFilters {
  from: string;
  to: string;
  statuses: DoseStatusT[];
  sort: "scheduledFor" | "status";
  order: "asc" | "desc";
}

const FILTERABLE: DoseStatusT[] = ["TAKEN", "LATE", "MISSED", "AWAY"];

/** Sortable, filterable dose log (task D3) with correction flags. */
export function DoseLogTable({
  patientId,
  filters,
  onChange,
}: {
  patientId: string;
  filters: LogFilters;
  onChange: (f: LogFilters) => void;
}) {
  const qs = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    sort: filters.sort,
    order: filters.order,
    ...(filters.statuses.length && filters.statuses.length < FILTERABLE.length ? { status: filters.statuses.join(",") } : {}),
  });
  const { data, error, isLoading } = useSWR<{ from: string; to: string; doses: DoseEventDTO[] }>(
    `/api/clinic/patients/${patientId}/doses?${qs}`,
    fetcher,
    { keepPreviousData: true },
  );

  const toggleSort = (field: LogFilters["sort"]) =>
    onChange({
      ...filters,
      sort: field,
      order: filters.sort === field && filters.order === "desc" ? "asc" : "desc",
    });
  const sortIcon = (field: LogFilters["sort"]) =>
    filters.sort !== field ? (
      <ArrowUpDown className="size-3.5 opacity-50" />
    ) : filters.order === "desc" ? (
      <ArrowDown className="size-3.5" />
    ) : (
      <ArrowUp className="size-3.5" />
    );

  const toggleStatus = (s: DoseStatusT) => {
    const has = filters.statuses.includes(s);
    const next = has ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s];
    onChange({ ...filters, statuses: next.length ? next : FILTERABLE });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-cocoa-100 p-4">
        <div>
          <label htmlFor="from" className="block text-xs font-bold text-cocoa-600">From</label>
          <Input id="from" type="date" value={filters.from} max={filters.to} onChange={(e) => e.target.value && onChange({ ...filters, from: e.target.value })} className="h-9 w-40 text-sm" />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-bold text-cocoa-600">To</label>
          <Input id="to" type="date" value={filters.to} min={filters.from} onChange={(e) => e.target.value && onChange({ ...filters, to: e.target.value })} className="h-9 w-40 text-sm" />
        </div>
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">Show statuses</legend>
          {FILTERABLE.map((s) => {
            const on = filters.statuses.includes(s);
            const tone = TONE_CLASSES[STATUS_META[s].tone];
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                className={clsx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 transition-colors",
                  on ? `${tone.pill} ring-transparent` : "bg-white text-cocoa-400 ring-cocoa-200 line-through",
                )}
              >
                <span className={clsx("size-1.5 rounded-full", on ? tone.dot : "bg-cocoa-300")} aria-hidden />
                {STATUS_META[s].short}
              </button>
            );
          })}
        </fieldset>
        <span className="ml-auto text-xs font-semibold text-cocoa-500 tabular">
          {data ? `${data.doses.length} dose${data.doses.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      {error ? (
        <Notice tone="error" className="m-4">{errorMessage(error)}</Notice>
      ) : isLoading && !data ? (
        <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : data && data.doses.length === 0 ? (
        <EmptyState title="No doses match these filters">Widen the date range or turn more statuses back on.</EmptyState>
      ) : (
        <div className="relative max-h-[34rem] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-cream-50 text-xs font-extrabold uppercase tracking-wider text-cocoa-500">
              <tr>
                <th scope="col" className="px-4 py-2.5" aria-sort={filters.sort === "scheduledFor" ? (filters.order === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort("scheduledFor")} className="inline-flex items-center gap-1 uppercase">
                    Date {sortIcon("scheduledFor")}
                  </button>
                </th>
                <th scope="col" className="px-3 py-2.5">Dose time</th>
                <th scope="col" className="px-3 py-2.5" aria-sort={filters.sort === "status" ? (filters.order === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort("status")} className="inline-flex items-center gap-1 uppercase">
                    Status {sortIcon("status")}
                  </button>
                </th>
                <th scope="col" className="px-3 py-2.5">Recorded at</th>
                <th scope="col" className="px-3 py-2.5">Logged by</th>
                <th scope="col" className="px-3 py-2.5">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cocoa-100">
              {data?.doses.map((d) => {
                const last = d.corrections.at(-1);
                return (
                  <tr key={d.id} className="align-top transition-colors duration-200 hover:bg-cream/60">
                    <td className="px-4 py-2.5 font-semibold text-cocoa-800 whitespace-nowrap">{formatDate(d.scheduledFor)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-bold tabular">{formatTime(d.scheduledFor)}</span>
                      <span className="text-cocoa-500"> · {d.label}</span>
                    </td>
                    <td className="px-3 py-2.5"><StatusPill status={d.status} /></td>
                    <td className="px-3 py-2.5 tabular text-cocoa-700">{d.takenAt ? formatTime(d.takenAt) : "—"}</td>
                    <td className="px-3 py-2.5 text-cocoa-700">{d.loggedBy ? LOGGED_BY_LABEL[d.loggedBy] : "—"}</td>
                    <td className="px-3 py-2.5">
                      {d.corrected && last ? (
                        <details className="group max-w-xs">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-honey-200 px-2.5 py-0.5 text-xs font-extrabold text-cocoa-800">
                            <PencilLine className="size-3" aria-hidden /> Corrected
                          </summary>
                          <div className="mt-1.5 space-y-1 text-xs text-cocoa-700">
                            {d.originalStatus && <p>Originally: <b>{STATUS_META[d.originalStatus].label}</b></p>}
                            {d.corrections.map((c) => (
                              <p key={c.id}>
                                {STATUS_META[c.fromStatus].short} → {STATUS_META[c.toStatus].short} by {c.correctedByName} on {formatShortDate(c.correctedAt)}: “{c.reason}”
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <span className="text-cocoa-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
