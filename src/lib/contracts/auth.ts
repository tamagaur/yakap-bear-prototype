import { z } from "zod";
import { RoleSchema } from "./common";

export const AreaSchema = z.enum(["family", "clinic"]);
export type Area = z.infer<typeof AreaSchema>;

export const LoginRequestSchema = z.object({
  email: z.email("Enter a valid email").transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1, "Enter your password").max(200),
  area: AreaSchema,
});
export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const SignupRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email").transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});
export type SignupRequest = z.input<typeof SignupRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  clinicName: z.string().nullable(),
  title: z.string().nullable(),
});
export type AuthUserDTO = z.infer<typeof AuthUserSchema>;

export const MeResponseSchema = z.object({ user: AuthUserSchema.nullable() });
export type MeResponse = z.infer<typeof MeResponseSchema>;
