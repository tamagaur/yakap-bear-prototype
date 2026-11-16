import { z } from "zod";

export const DoseStatusSchema = z.enum(["UPCOMING", "REMINDED", "TAKEN", "LATE", "MISSED", "AWAY"]);
export const RoleSchema = z.enum(["FAMILY", "CLINICIAN", "CLINIC_ADMIN"]);
export const LoggedBySchema = z.enum(["BEAR", "OFFLINE_SYNC", "FAMILY"]);
export const AttemptReasonSchema = z.enum(["TOO_SHORT", "OUTSIDE_WINDOW", "ALREADY_LOGGED", "AWAY"]);
export const AlertTypeSchema = z.enum(["MISSED_DOSE", "LOW_BATTERY"]);
export const AuditActionSchema = z.enum([
  "VIEW_PATIENT",
  "EXPORT_CSV",
  "EXPORT_PDF",
  "CORRECT_LOG",
  "CONSENT_GRANT",
  "CONSENT_REVOKE",
]);

export type DoseStatusT = z.infer<typeof DoseStatusSchema>;
export type RoleT = z.infer<typeof RoleSchema>;
export type LoggedByT = z.infer<typeof LoggedBySchema>;
export type AttemptReasonT = z.infer<typeof AttemptReasonSchema>;
export type AlertTypeT = z.infer<typeof AlertTypeSchema>;
export type AuditActionT = z.infer<typeof AuditActionSchema>;

/** "YYYY-MM-DD" (Manila calendar day). */
export const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
/** "HH:mm" 24-hour Manila wall-clock time. */
export const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm (24-hour)");
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IdSchema = z.string().min(1).max(64);

/** Every error response: `{ error: { code, message, details? } }`. */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const OkSchema = z.object({ ok: z.literal(true) });
export type OkDTO = z.infer<typeof OkSchema>;
