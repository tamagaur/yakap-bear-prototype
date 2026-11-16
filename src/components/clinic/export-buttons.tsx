"use client";

import { FileDown, FileText } from "lucide-react";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { AdherenceSummaryDTO } from "@/lib/contracts/clinic";
import type { DoseEventDTO } from "@/lib/contracts/doses";
import { LOGGED_BY_LABEL, STATUS_META } from "@/lib/status";
import { formatDateKey, formatDateTime, formatShortDate, formatTime, manilaDateKey } from "@/lib/time";

interface PdfPayload {
  patient: { fullName: string; nickname: string; birthYear: number | null };
  clinician: { name: string; clinicName: string | null };
  consent: { grantedAt: string; signedName: string };
  from: string;
  to: string;
  generatedAt: string;
  summary: AdherenceSummaryDTO;
  doses: DoseEventDTO[];
}

/**
 * CSV / PDF export (task D4). The API checks consent and writes the audit
 * entry before any data leaves the server.
 */
export function ExportButtons({ patientId, from, to, onExported }: { patientId: string; from: string; to: string; onExported: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const csvHref = `/api/clinic/patients/${patientId}/export.csv?from=${from}&to=${to}`;

  const pdf = async () => {
    setBusy(true);
    try {
      const data = await apiFetch<PdfPayload>(`/api/clinic/patients/${patientId}/export-log`, {
        json: { format: "pdf", from, to },
      });
      const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const s = data.summary;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Yakap Bear - medication dose log", 40, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = [
        `Patient: ${data.patient.fullName} ("${data.patient.nickname}")${data.patient.birthYear ? `, born ${data.patient.birthYear}` : ""}`,
        `Period: ${formatDateKey(data.from)} to ${formatDateKey(data.to)}  |  Exported ${formatDateTime(data.generatedAt)} by ${data.clinician.name}${data.clinician.clinicName ? `, ${data.clinician.clinicName}` : ""}`,
        `Written consent signed by ${data.consent.signedName} on ${formatShortDate(data.consent.grantedAt)}.`,
        `Last 30 days: ${s.onTimePct ?? "-"}% on time, ${s.late} late, ${s.missed} missed, ${s.away} away (excluded).`,
      ];
      lines.forEach((l, i) => doc.text(l, 40, 70 + i * 14));
      autoTable(doc, {
        startY: 132,
        head: [["Date", "Dose", "Status", "Recorded at", "Logged by", "Corrected"]],
        body: data.doses.map((d) => [
          manilaDateKey(d.scheduledFor),
          `${formatTime(d.scheduledFor)} ${d.label}`,
          STATUS_META[d.status].label,
          d.takenAt ? formatTime(d.takenAt) : "-",
          d.loggedBy ? LOGGED_BY_LABEL[d.loggedBy] : "-",
          d.corrected ? `Yes: ${d.corrections.at(-1)?.reason ?? ""}` : "No",
        ]),
        styles: { fontSize: 8.5, cellPadding: 4 },
        headStyles: { fillColor: [59, 38, 24], textColor: [255, 250, 243] },
        alternateRowStyles: { fillColor: [253, 243, 230] },
        margin: { left: 40, right: 40 },
      });
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          "Self-reported by paw hold on the Yakap Bear (or corrected by family). Academic prototype - fictional data. This export was recorded in the audit log.",
          40,
          doc.internal.pageSize.getHeight() - 24,
        );
      }
      const slug = data.patient.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(`yakap-${slug}-dose-log-${data.from}-to-${data.to}.pdf`);
      onExported(`PDF exported (${data.doses.length} doses) — recorded in the audit log.`);
    } catch (e) {
      onExported(`PDF export failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={csvHref}
        download
        className={buttonClasses("secondary", "md")}
        onClick={() => setTimeout(() => onExported("CSV downloaded — recorded in the audit log."), 400)}
      >
        <FileDown className="size-4" aria-hidden /> Export CSV
      </a>
      <Button variant="secondary" loading={busy} icon={<FileText className="size-4" />} onClick={pdf}>
        Export PDF
      </Button>
    </div>
  );
}
