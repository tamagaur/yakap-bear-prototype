import { jwtVerify } from "jose";

/**
 * Verifies the session cookies issued by the Rust API (HS256, issuer
 * "yakap-bear") so the page guard (src/proxy.ts) can redirect signed-out
 * visitors. This is UX only — the API enforces every permission itself.
 */
export type Area = "family" | "clinic";
export type SessionRole = "FAMILY" | "CLINICIAN" | "CLINIC_ADMIN";

export const SESSION_COOKIES: Record<Area, string> = {
  family: "yakap_family_session",
  clinic: "yakap_clinic_session",
};

const AREA_ROLES: Record<Area, SessionRole[]> = {
  family: ["FAMILY"],
  clinic: ["CLINICIAN", "CLINIC_ADMIN"],
};

export interface SessionClaims {
  sub: string;
  role: SessionRole;
  name: string;
  area: Area;
}

export async function verifySession(token: string | undefined, area: Area): Promise<SessionClaims | null> {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: "yakap-bear",
    });
    const role = payload.role as SessionRole;
    if (payload.area !== area || !AREA_ROLES[area].includes(role) || typeof payload.sub !== "string") {
      return null;
    }
    return { sub: payload.sub, role, name: String(payload.name ?? ""), area };
  } catch {
    return null;
  }
}
