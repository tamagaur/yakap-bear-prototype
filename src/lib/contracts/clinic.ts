import { z } from "zod";
import { AuditActionSchema, DateKeySchema, DoseStatusSchema, RoleSchema } from "./common";
import { DoseEventSchema } from "./doses";
import { ScheduleSchema } from "./schedules";

export const AdherenceSummarySchema = z.object({
  days: z.number(),
  from: z.string(),
  to: z.string(),
  total: z.number(),
  taken: z.number(),
  late: z.number(),
  missed: z.number(),
  away: z.number(),
  counted: z.number(),
  onTimePct: z.number().nullable(),
  adherencePct: z.number().nullable(),
  /** One entry per Manila day, oldest first. */
  daily: z.array(
    z.object({
      date: z.string(),
      taken: z.number(),
      late: z.number(),
      missed: z.number(),
      away: z.number(),
    }),
  ),
});
export type AdherenceSummaryDTO = z.infer<typeof AdherenceSummarySchema>;

export const ClinicPatientRowSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  nickname: z.string(),
  birthYear: z.number().nullable(),
  consentSince: z.string(),
  onTimePct7: z.number().nullable(),
  adherencePct30: z.number().nullable(),
  missed7: z.number(),
  lastDose: z
    .object({ scheduledFor: z.string(), status: DoseStatusSchema, label: z.string() })
    .nullable(),
  awayNow: z.boolean(),
  hasData: z.boolean(),
});
export type ClinicPatientRowDTO = z.infer<typeof ClinicPatientRowSchema>;

export const ClinicPatientDetailSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  nickname: z.string(),
  birthYear: z.number().nullable(),
  consent: z.object({
    id: z.string(),
    grantedAt: z.string(),
    signedName: z.string(),
    grantedByName: z.string(),
    consentVersion: z.string(),
  }),
  familyContacts: z.array(z.object({ name: z.string(), relationship: z.string() })),
  schedules: z.array(ScheduleSchema),
  awayPeriods: z.array(
    z.object({ startDate: z.string(), endDate: z.string(), reason: z.string(), active: z.boolean() }),
  ),
  recent: z.array(DoseEventSchema),
  firstDoseDate: z.string().nullable(),
  now: z.string(),
});
export type ClinicPatientDetailDTO = z.infer<typeof ClinicPatientDetailSchema>;

export const ClinicDoseQuerySchema = z.object({
  from: DateKeySchema.optional(),
  to: DateKeySchema.optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : undefined))
    .pipe(z.array(DoseStatusSchema).optional()),
  sort: z.enum(["scheduledFor", "status"]).default("scheduledFor"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const PatternSchema = z.object({
  days: z.number(),
  from: z.string(),
  to: z.string(),
  times: z.array(z.object({ timeOfDay: z.string(), label: z.string() })),
  /** cells[weekday 0=Sun..6][timeIndex] */
  cells: z.array(
    z.array(
      z.object({ missed: z.number(), late: z.number(), taken: z.number(), total: z.number() }),
    ),
  ),
  hotspots: z.array(
    z.object({ weekday: z.number(), timeOfDay: z.string(), missed: z.number(), total: z.number() }),
  ),
});
export type PatternDTO = z.infer<typeof PatternSchema>;

export const ExportRequestSchema = z.object({
  format: z.literal("pdf"),
  from: DateKeySchema.optional(),
  to: DateKeySchema.optional(),
});

export const AuditEntrySchema = z.object({
  id: z.string(),
  action: AuditActionSchema,
  actorName: z.string(),
  actorRole: RoleSchema.nullable(),
  patientName: z.string().nullable(),
  clinicName: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  simTime: z.string(),
  createdAt: z.string(),
});
export type AuditEntryDTO = z.infer<typeof AuditEntrySchema>;
