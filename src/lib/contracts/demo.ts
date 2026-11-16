import { z } from "zod";

export const ClockSchema = z.object({
  now: z.string(),
  realNow: z.string(),
  offsetMs: z.number(),
  demoMode: z.boolean(),
  timezone: z.string(),
});
export type ClockDTO = z.infer<typeof ClockSchema>;

export const ClockActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), minutes: z.number().int().min(1).max(7 * 24 * 60) }),
  /** Jump to the next dose time (reminder moment) of the given bear's patient. */
  z.object({ action: z.literal("next-dose"), deviceId: z.string().optional() }),
  /** Jump 1 minute past the late period of the current/next open dose → MISSED. */
  z.object({ action: z.literal("past-window"), deviceId: z.string().optional() }),
]);
export type ClockAction = z.infer<typeof ClockActionSchema>;

export const ClockActionResultSchema = ClockSchema.extend({ message: z.string() });
export type ClockActionResultDTO = z.infer<typeof ClockActionResultSchema>;

export const DemoDeviceSchema = z.object({
  id: z.string(),
  deviceKey: z.string(),
  patientNickname: z.string(),
  patientName: z.string(),
});
export type DemoDeviceDTO = z.infer<typeof DemoDeviceSchema>;

export const ResetResultSchema = z.object({
  ok: z.literal(true),
  now: z.string(),
  counts: z.record(z.string(), z.number()),
});
export type ResetResultDTO = z.infer<typeof ResetResultSchema>;

/** Demo-only shared password for the seeded accounts (documented in README). */
export const DEMO_PASSWORD = "yakap-demo-2026";
export const DEMO_ACCOUNTS = [
  { email: "family@yakap.demo", role: "FAMILY", label: "Family — Ana Santos (daughter of Lola Rosa)" },
  { email: "doctor@yakap.demo", role: "CLINICIAN", label: "Clinician — Dr. Paolo Reyes" },
  { email: "admin@yakap.demo", role: "CLINIC_ADMIN", label: "Clinic admin — Carla Dizon" },
] as const;
