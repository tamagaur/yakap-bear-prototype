import { z } from "zod";

export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_MAX_SECONDS = 30;
export const VOICE_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/x-m4a",
] as const;

/**
 * Upload (POST /api/patients/:id/voice) and replace (PATCH /api/voice/:id) use
 * multipart/form-data with these fields:
 *   file        Blob   (required on upload, optional on replace)
 *   title       string
 *   durationSec number (client-measured)
 *   scheduleId  string (optional: assign to this dose time)
 */
export const VoiceFieldsSchema = z.object({
  title: z.string().trim().min(1, "Give the message a title").max(60),
  durationSec: z.coerce.number().min(0).max(VOICE_MAX_SECONDS + 5).optional(),
  scheduleId: z.string().optional(),
});

export const VoiceMessageSchema = z.object({
  id: z.string(),
  title: z.string(),
  mimeType: z.string(),
  durationSec: z.number().nullable(),
  sizeBytes: z.number(),
  recordedByName: z.string().nullable(),
  isSample: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  audioUrl: z.string(),
  assignedTo: z.array(z.object({ scheduleId: z.string(), label: z.string(), timeOfDay: z.string() })),
});
export type VoiceMessageDTO = z.infer<typeof VoiceMessageSchema>;

/** Strip codec parameters: "audio/webm;codecs=opus" → "audio/webm". */
export function baseMimeType(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}
