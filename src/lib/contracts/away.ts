import { z } from "zod";
import { DateKeySchema } from "./common";

export const AWAY_REASONS = ["Travel", "Hospital stay", "Staying with family", "Other"] as const;

export const AwayRequestSchema = z
  .object({
    startDate: DateKeySchema,
    endDate: DateKeySchema,
    reason: z.enum(AWAY_REASONS),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
export type AwayRequest = z.input<typeof AwayRequestSchema>;

export const AwaySchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  note: z.string().nullable(),
  createdByName: z.string(),
  state: z.enum(["ACTIVE", "UPCOMING", "ENDED", "CANCELLED"]),
});
export type AwayDTO = z.infer<typeof AwaySchema>;
