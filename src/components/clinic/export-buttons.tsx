"use client";

import { FileDown, FileText, Printer } from "lucide-react";
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
 * CSV / PDF export + 1-page Check-up Sheet print (task D4 & design refresh B5).
 * The API checks consent and writes the audit entry (`EXPORT_CSV`, `EXPORT_PDF`,
 * or `PRINT_CHECKUP`) before any data leaves the server.
 */
export function ExportButtons({
  patientId,
  from,
  to,
  onExported,
}: {
  patientId: string;
  from: string;
  to: string;
  onExported: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null);
  const csvHref = `/api/clinic/patients/${patientId}/export.csv?from=${from}&to=${to}`;

  const pdf = async () => {
    setBusy("pdf");
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
      setBusy(null);
    }
  };

  const printCheckup = async () => {
    setBusy("print");
    try {
      const data = await apiFetch<PdfPayload>(`/api/clinic/patients/${patientId}/export-log`, {
        json: { format: "print", from, to },
      });
      const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const s = data.summary;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("Yakap Bear — One-Page Check-up Summary Sheet", 40, 48);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const headerLines = [
        `Patient: ${data.patient.fullName} ("${data.patient.nickname}")${data.patient.birthYear ? ` · Born ${data.patient.birthYear}` : ""}`,
        `Clinician: ${data.clinician.name}${data.clinician.clinicName ? ` · ${data.clinician.clinicName}` : ""}  |  Generated: ${formatDateTime(data.generatedAt)}`,
        `Written Consent: Signed by ${data.consent.signedName} on ${formatShortDate(data.consent.grantedAt)}`,
      ];
      headerLines.forEach((l, i) => doc.text(l, 40, 70 + i * 14));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("30-Day Adherence Snapshot", 40, 126);

      autoTable(doc, {
        startY: 136,
        head: [["On-time %", "Total Adherence %", "Taken On Time", "Taken Late", "Missed", "Away (Excluded)"]],
        body: [
          [
            s.onTimePct === null ? "—" : `${s.onTimePct}%`,
            s.adherencePct === null ? "—" : `${s.adherencePct}%`,
            `${s.taken} / ${s.counted}`,
            String(s.late),
            String(s.missed),
            String(s.away),
          ],
        ],
        styles: { fontSize: 9.5, cellPadding: 6 },
        headStyles: { fillColor: [47, 117, 110], textColor: [255, 253, 249] },
        margin: { left: 40, right: 40 },
      });

      const missedRows = data.doses.filter((d) => d.status === "MISSED" || d.status === "LATE").slice(-12);
      const afterSnapshotY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Recent Missed & Late Doses (for check-up discussion)", 40, afterSnapshotY + 26);

      autoTable(doc, {
        startY: afterSnapshotY + 36,
        head: [["Date", "Dose Time", "Outcome", "Recorded At", "Notes / Family Correction"]],
        body:
          missedRows.length > 0
            ? missedRows.map((d) => [
                manilaDateKey(d.scheduledFor),
                `${formatTime(d.scheduledFor)} ${d.label}`,
                STATUS_META[d.status].label,
                d.takenAt ? formatTime(d.takenAt) : "—",
                d.corrected ? `Corrected: ${d.corrections.at(-1)?.reason ?? ""}` : "—",
              ])
            : [["—", "—", "No missed or late doses in this period", "—", "—"]],
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: [61, 43, 37], textColor: [255, 250, 243] },
        alternateRowStyles: { fillColor: [248, 242, 232] },
        margin: { left: 40, right: 40 },
      });

      const afterTableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 480;
      if (afterTableY + 110 < doc.internal.pageSize.getHeight() - 36) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Clinician Check-up Notes:", 40, afterTableY + 28);
        doc.setDrawColor(200, 190, 180);
        for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
          const y = afterTableY + 52 + lineIdx * 22;
          doc.line(40, y, doc.internal.pageSize.getWidth() - 40, y);
        }
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        "Self-reported by 3-second paw hold on the Yakap Bear (no microphone). Academic prototype — fictional data. Audited as PRINT_CHECKUP.",
        40,
        doc.internal.pageSize.getHeight() - 24,
      );

      const slug = data.patient.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      doc.save(`yakap-${slug}-checkup-sheet-${data.to}.pdf`);
      onExported("One-page check-up sheet generated — recorded in the audit log.");
    } catch (e) {
      onExported(`Check-up sheet failed: ${errorMessage(e)}`);
    } finally {
      setBusy(null);
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
      <Button variant="secondary" loading={busy === "pdf"} disabled={busy !== null} icon={<FileText className="size-4" />} onClick={pdf}>
        Export PDF
      </Button>
      <Button
        variant="secondary"
        loading={busy === "print"}
        disabled={busy !== null}
        icon={<Printer className="size-4" />}
        onClick={printCheckup}
      >
        Print check-up sheet
      </Button>
    </div>
  );
}
