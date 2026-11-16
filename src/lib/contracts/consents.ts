import { z } from "zod";
import { AuditActionSchema } from "./common";

export const ClinicianSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  clinicName: z.string().nullable(),
});
export type ClinicianDTO = z.infer<typeof ClinicianSchema>;

export const ConsentSchema = z.object({
  id: z.string(),
  clinician: ClinicianSchema,
  grantedByName: z.string(),
  signedName: z.string(),
  signatureDataUrl: z.string(),
  consentVersion: z.string(),
  grantedAt: z.string(),
  revokedAt: z.string().nullable(),
  revokedByName: z.string().nullable(),
  active: z.boolean(),
});
export type ConsentDTO = z.infer<typeof ConsentSchema>;

export const GrantConsentRequestSchema = z.object({
  clinicianId: z.string().min(1, "Choose a clinician"),
  agreed: z.literal(true, { error: "Please tick the consent box" }),
  signedName: z.string().trim().min(2, "Type your full name").max(80),
  signatureDataUrl: z
    .string()
    .startsWith("data:image/png;base64,", "Please sign in the signature box")
    .max(400_000, "Signature image is too large"),
});
export type GrantConsentRequest = z.input<typeof GrantConsentRequestSchema>;

export const AccessLogEntrySchema = z.object({
  id: z.string(),
  action: AuditActionSchema,
  actorName: z.string(),
  clinicName: z.string().nullable(),
  simTime: z.string(),
  summary: z.string(),
});
export type AccessLogEntryDTO = z.infer<typeof AccessLogEntrySchema>;
