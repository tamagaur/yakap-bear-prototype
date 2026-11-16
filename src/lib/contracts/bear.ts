import { z } from "zod";
import { AttemptReasonSchema, DoseStatusSchema, IsoDateTimeSchema } from "./common";

/** Header carrying the device token on every /api/bear/* request. */
export const BEAR_KEY_HEADER = "x-bear-key";

export const BearDoseSchema = z.object({
  doseId: z.string(),
  label: z.string(),
  pillNote: z.string().nullable(),
  scheduledFor: z.string(),
  windowStart: z.string(),
  onTimeEnd: z.string(),
  lateEnd: z.string(),
  status: DoseStatusSchema,
  takenAt: z.string().nullable(),
  reminderCount: z.number(),
  voice: z
    .object({ id: z.string(), title: z.string(), isSample: z.boolean(), recordedByName: z.string().nullable() })
    .nullable(),
});
export type BearDoseDTO = z.infer<typeof BearDoseSchema>;

export const BearStateSchema = z.object({
  now: z.string(),
  device: z.object({ id: z.string(), batteryPct: z.number(), lowBattery: z.boolean() }),
  patient: z.object({ nickname: z.string() }),
  away: z.boolean(),
  /** Dose whose window contains "now" (open or just logged), if any. */
  activeDose: BearDoseSchema.nullable(),
  /** True when the reminder should play right now (server-side 20 s / 3× rule). */
  reminderDue: z.boolean(),
  nextDose: BearDoseSchema.nullable(),
  /** Doses from 12 h ago to 36 h ahead — cached for offline feedback. */
  doses: z.array(BearDoseSchema),
});
export type BearStateDTO = z.infer<typeof BearStateSchema>;

export const HoldRequestSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  holdMs: z.number().int().min(0).max(120_000),
  /** Required for offline sync; ignored for live holds (server time is used). */
  heldAt: IsoDateTimeSchema.optional(),
});
export type HoldRequest = z.infer<typeof HoldRequestSchema>;

export const HoldResultSchema = z.object({
  clientEventId: z.string(),
  accepted: z.boolean(),
  duplicate: z.boolean(),
  status: DoseStatusSchema.nullable(),
  reason: AttemptReasonSchema.nullable(),
  doseId: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  heldAt: z.string(),
  holdMs: z.number(),
  resolvedMissed: z.boolean(),
});
export type HoldResultDTO = z.infer<typeof HoldResultSchema>;

export const ReminderRequestSchema = z.object({ doseId: z.string().min(1) });
export const ReminderResultSchema = z.object({
  play: z.boolean(),
  reminderCount: z.number(),
  voiceId: z.string().nullable(),
});
export type ReminderResultDTO = z.infer<typeof ReminderResultSchema>;

export const HeartbeatRequestSchema = z.object({
  batteryPct: z.number().int().min(0).max(100),
});
export const HeartbeatResultSchema = z.object({
  ok: z.literal(true),
  batteryPct: z.number(),
  lowBattery: z.boolean(),
  alertCreated: z.boolean(),
});
export type HeartbeatResultDTO = z.infer<typeof HeartbeatResultSchema>;

export const SyncRequestSchema = z.object({
  events: z
    .array(HoldRequestSchema.extend({ heldAt: IsoDateTimeSchema }))
    .min(1)
    .max(100),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;
export const SyncResultSchema = z.object({ results: z.array(HoldResultSchema) });
export type SyncResultDTO = z.infer<typeof SyncResultSchema>;
