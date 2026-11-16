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

const WeekCountsSchema = z.object({
  total: z.number(),
  taken: z.number(),
  late: z.number(),
  missed: z.number(),
  away: z.number(),
  counted: z.number(),
  onTimePct: z.number().nullable(),
  adherencePct: z.number().nullable(),
});

/** GET /api/clinic/overview — the clinic dashboard home page. */
export const ClinicOverviewSchema = z.object({
  role: RoleSchema,
  clinicName: z.string().nullable(),
  now: z.string(),
  clinician: z
    .object({
      patients: z.number(),
      withData: z.number(),
      awayNow: z.number(),
      week: WeekCountsSchema,
      today: z.object({
        taken: z.number(),
        late: z.number(),
        missed: z.number(),
        away: z.number(),
        upcoming: z.number(),
      }),
      needsAttention: z.array(
        z.object({
          id: z.string(),
          fullName: z.string(),
          nickname: z.string(),
          missed7: z.number(),
          onTimePct7: z.number().nullable(),
          reasons: z.array(z.string()),
        }),
      ),
      recentMissed: z.array(
        z.object({
          patientId: z.string(),
          fullName: z.string(),
          nickname: z.string(),
          scheduledFor: z.string(),
          label: z.string(),
        }),
      ),
    })
    .nullable(),
  admin: z
    .object({
      clinicians: z.number(),
      activeConsents: z.number(),
      consentingPatients: z.number(),
      views7: z.number(),
      exports7: z.number(),
      consentChanges7: z.number(),
      corrections7: z.number(),
      recentActivity: z.array(z.lazy(() => AuditEntrySchema)),
    })
    .nullable(),
});
export type ClinicOverviewDTO = z.infer<typeof ClinicOverviewSchema>;

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
