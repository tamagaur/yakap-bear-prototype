import { z } from "zod";
import { AlertTypeSchema } from "./common";

export const AlertSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema,
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  acknowledgedByName: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolution: z.string().nullable(),
  doseEventId: z.string().nullable(),
  smsCount: z.number(),
});
export type AlertDTO = z.infer<typeof AlertSchema>;

export const AlertListSchema = z.object({
  alerts: z.array(AlertSchema),
  unacknowledged: z.number(),
});
export type AlertListDTO = z.infer<typeof AlertListSchema>;

export const SmsSchema = z.object({
  id: z.string(),
  toName: z.string(),
  toPhone: z.string(),
  body: z.string(),
  sentAt: z.string(),
  alertId: z.string().nullable(),
});
export type SmsDTO = z.infer<typeof SmsSchema>;
