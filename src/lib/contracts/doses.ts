import { z } from "zod";
import { DateKeySchema, DoseStatusSchema, IsoDateTimeSchema, LoggedBySchema } from "./common";

export const CorrectionSchema = z.object({
  id: z.string(),
  fromStatus: DoseStatusSchema,
  toStatus: DoseStatusSchema,
  fromTakenAt: z.string().nullable(),
  toTakenAt: z.string().nullable(),
  reason: z.string(),
  correctedByName: z.string(),
  correctedAt: z.string(),
});
export type CorrectionDTO = z.infer<typeof CorrectionSchema>;

export const DoseEventSchema = z.object({
  id: z.string(),
  scheduleId: z.string(),
  label: z.string(),
  pillNote: z.string().nullable(),
  scheduledFor: z.string(),
  windowStart: z.string(),
  onTimeEnd: z.string(),
  lateEnd: z.string(),
  status: DoseStatusSchema,
  takenAt: z.string().nullable(),
  holdMs: z.number().nullable(),
  loggedBy: LoggedBySchema.nullable(),
  reminderCount: z.number(),
  corrected: z.boolean(),
  originalStatus: DoseStatusSchema.nullable(),
  corrections: z.array(CorrectionSchema),
});
export type DoseEventDTO = z.infer<typeof DoseEventSchema>;

export const TodaySchema = z.object({
  now: z.string(),
  dateKey: z.string(),
  doses: z.array(DoseEventSchema),
  nextDose: DoseEventSchema.nullable(),
  openAlerts: z.number(),
  awayNow: z.boolean(),
});
export type TodayDTO = z.infer<typeof TodaySchema>;

export const DoseHistoryQuerySchema = z.object({
  from: DateKeySchema.optional(),
  to: DateKeySchema.optional(),
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : undefined))
    .pipe(z.array(DoseStatusSchema).optional()),
});

export const DoseHistorySchema = z.object({
  from: z.string(),
  to: z.string(),
  now: z.string(),
  doses: z.array(DoseEventSchema),
});
export type DoseHistoryDTO = z.infer<typeof DoseHistorySchema>;

export const CorrectionRequestSchema = z.object({
  toStatus: z.enum(["TAKEN", "LATE", "MISSED"]),
  takenAt: IsoDateTimeSchema.nullable().optional(),
  reason: z.string().trim().min(5, "Please explain the correction (at least 5 characters)").max(300),
});
export type CorrectionRequest = z.input<typeof CorrectionRequestSchema>;
