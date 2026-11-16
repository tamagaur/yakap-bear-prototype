import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(7, "Enter a phone number")
  .max(24)
  .regex(/^[+\d][\d\s-]+$/, "Use digits, spaces, + or -");

export const ContactRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  relationship: z.string().trim().min(2, "Enter the relationship").max(40),
  phone,
  receivesSms: z.boolean().default(true),
});
export type ContactRequest = z.input<typeof ContactRequestSchema>;
export const ContactUpdateSchema = ContactRequestSchema.partial();

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
  receivesSms: z.boolean(),
});
export type ContactDTO = z.infer<typeof ContactSchema>;

export const CreatePatientRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's full name").max(80),
  nickname: z.string().trim().min(1, "Enter what the bear should call them").max(40),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(2010, "Yakap Bear is designed for adults")
    .nullable()
    .optional(),
  relationship: z.string().trim().min(2, "Enter your relationship").max(40),
  contacts: z.array(ContactRequestSchema).max(5).default([]),
});
export type CreatePatientRequest = z.input<typeof CreatePatientRequestSchema>;

export const UpdatePatientRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  nickname: z.string().trim().min(1).max(40).optional(),
  birthYear: z.number().int().min(1900).max(2010).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const DeviceSchema = z.object({
  id: z.string(),
  batteryPct: z.number(),
  lowBattery: z.boolean(),
  online: z.boolean(),
  lastSeenAt: z.string().nullable(),
});
export type DeviceDTO = z.infer<typeof DeviceSchema>;

export const PlanSchema = z.object({
  includedUntil: z.string(),
  daysLeft: z.number(),
  status: z.enum(["INCLUDED", "EXPIRED"]),
});

export const PatientSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  nickname: z.string(),
  birthYear: z.number().nullable(),
  notes: z.string().nullable(),
  relationship: z.string().nullable(),
  device: DeviceSchema.nullable(),
  plan: PlanSchema,
  awayNow: z.boolean(),
});
export type PatientDTO = z.infer<typeof PatientSchema>;
