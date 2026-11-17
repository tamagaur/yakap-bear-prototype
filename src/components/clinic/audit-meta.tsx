import { Download, Eye, FileCheck2, FileX2, PencilLine, Printer } from "lucide-react";
import type { ReactNode } from "react";
import type { AuditEntryDTO } from "@/lib/contracts/clinic";
import type { AuditActionT } from "@/lib/contracts/common";

/** Labels, icons and tones for audit actions (audit log + dashboard). */
export const AUDIT_ACTIONS: Record<AuditActionT, { label: string; icon: ReactNode; tone: string }> = {
  VIEW_PATIENT: { label: "Viewed record", icon: <Eye className="size-3.5" />, tone: "bg-upcoming-soft text-upcoming-ink" },
  EXPORT_CSV: { label: "Exported CSV", icon: <Download className="size-3.5" />, tone: "bg-honey-200 text-cocoa-800" },
  EXPORT_PDF: { label: "Exported PDF", icon: <Download className="size-3.5" />, tone: "bg-honey-200 text-cocoa-800" },
  PRINT_CHECKUP: { label: "Printed check-up sheet", icon: <Printer className="size-3.5" />, tone: "bg-honey-200 text-cocoa-800" },
  CORRECT_LOG: { label: "Log corrected", icon: <PencilLine className="size-3.5" />, tone: "bg-late-soft text-late-ink" },
  CONSENT_GRANT: { label: "Consent given", icon: <FileCheck2 className="size-3.5" />, tone: "bg-taken-soft text-taken-ink" },
  CONSENT_REVOKE: { label: "Consent revoked", icon: <FileX2 className="size-3.5" />, tone: "bg-missed-soft text-missed-ink" },
};

export function describeAudit(e: AuditEntryDTO): string {
  const d = (e.details ?? {}) as Record<string, string | number>;
  switch (e.action) {
    case "VIEW_PATIENT":
      return `Opened the ${d.section === "dose-log" ? "dose log" : "patient overview"}`;
    case "EXPORT_CSV":
    case "EXPORT_PDF":
      return `${d.rows ?? "?"} dose rows${d.from ? `, ${d.from} → ${d.to}` : ""}`;
    case "PRINT_CHECKUP":
      return `One-page summary${d.from ? `, ${d.from} → ${d.to}` : ""}`;
    case "CORRECT_LOG":
      return `${d.dose ?? "Dose"}: ${d.from} → ${d.to} — “${d.reason ?? ""}”`;
    case "CONSENT_GRANT":
      return `For ${d.clinician}, signed by ${d.signedName} (${d.version})`;
    case "CONSENT_REVOKE":
      return `Access removed for ${d.clinician}`;
  }
}

export function roleLabel(role: string | null): string {
  return role === "FAMILY" ? "Family" : role === "CLINICIAN" ? "Clinician" : role === "CLINIC_ADMIN" ? "Clinic admin" : "System";
}
