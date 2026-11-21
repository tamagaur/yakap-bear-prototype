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

const DemoPersonSchema = z.object({
  name: z.string(),
  relationship: z.string().nullable(),
  title: z.string().nullable(),
  clinicName: z.string().nullable(),
});

/**
 * GET /api/demo/overview — what the launcher shows at a glance (demo mode only).
 * Never contains device keys or audio URLs.
 */
export const DemoOverviewSchema = z.object({
  now: z.string(),
  patient: z.object({ id: z.string(), fullName: z.string(), nickname: z.string() }),
  device: z.object({
    id: z.string(),
    batteryPct: z.number(),
    lowBattery: z.boolean(),
    online: z.boolean(),
    lastSeenAt: z.string().nullable(),
  }),
  /** The dose that can still be logged, else the next one. */
  nextDose: z
    .object({
      id: z.string(),
      scheduledFor: z.string(),
      label: z.string(),
      pillNote: z.string().nullable(),
      status: z.string(),
    })
    .nullable(),
  /** Alerts that are neither acknowledged nor resolved. */
  openAlerts: z.number(),
  /** The newest simulated text; `recipients` lists everyone who got it. */
  latestText: z
    .object({ body: z.string(), toName: z.string(), recipients: z.array(z.string()), createdAt: z.string() })
    .nullable(),
  /** The voice message the bear would play for that dose. */
  reminder: z
    .object({ title: z.string(), recordedByName: z.string().nullable(), isSample: z.boolean() })
    .nullable(),
  people: z.object({
    family: DemoPersonSchema.nullable(),
    clinician: DemoPersonSchema.nullable(),
    admin: DemoPersonSchema.nullable(),
  }),
});
export type DemoOverviewDTO = z.infer<typeof DemoOverviewSchema>;

export const ResetResultSchema = z.object({
  ok: z.literal(true),
  now: z.string(),
  counts: z.record(z.string(), z.number()),
});
export type ResetResultDTO = z.infer<typeof ResetResultSchema>;

/** Demo-only shared password for the seeded accounts (documented in README). */
export const DEMO_PASSWORD = "yakap-demo-2026";
export const DEMO_ACCOUNTS = [
  { email: "family@yakap.demo", role: "FAMILY", label: "Family — Ana Santos (granddaughter of Lola Rosa)" },
  { email: "doctor@yakap.demo", role: "CLINICIAN", label: "Clinician — Dr. Paolo Reyes" },
  { email: "admin@yakap.demo", role: "CLINIC_ADMIN", label: "Clinic admin — Carla Dizon" },
] as const;
