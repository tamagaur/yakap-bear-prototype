import { z } from "zod";
import { TimeOfDaySchema } from "./common";

export const WINDOW_OPTIONS = [15, 30, 45, 60] as const;
export const LATE_OPTIONS = [30, 60, 90, 120] as const;

export const ScheduleRequestSchema = z.object({
  label: z.string().trim().min(1, "Give this dose a name").max(40),
  timeOfDay: TimeOfDaySchema,
  windowMinutes: z.number().int().min(5).max(120).default(30),
  lateMinutes: z.number().int().min(0).max(240).default(60),
  pillNote: z.string().trim().max(60).nullable().optional(),
  voiceMessageId: z.string().nullable().optional(),
});
export type ScheduleRequest = z.input<typeof ScheduleRequestSchema>;
export const ScheduleUpdateSchema = ScheduleRequestSchema.partial();

export const ScheduleSchema = z.object({
  id: z.string(),
  label: z.string(),
  timeOfDay: z.string(),
  windowMinutes: z.number(),
  lateMinutes: z.number(),
  pillNote: z.string().nullable(),
  voiceMessageId: z.string().nullable(),
  voiceTitle: z.string().nullable(),
});
export type ScheduleDTO = z.infer<typeof ScheduleSchema>;
