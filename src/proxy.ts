import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIES, verifySession } from "@/lib/session-token";

/**
 * Page guard for the clinic dashboard (task D1). Redirects signed-out
 * visitors to the clinic login and keeps the audit page for clinic admins.
 * This is a UX layer only — the Rust API enforces roles, ownership and
 * consent on every request.
 *
 * The /family app is on hold (not built yet); when it is, add its pages to
 * the matcher with the "family" area.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIES.clinic)?.value, "clinic");

  // Signed-in users never see the login page again — the dashboard is home.
  if (pathname === "/clinic/login") {
    return session ? NextResponse.redirect(new URL("/clinic", req.url)) : NextResponse.next();
  }
  if (!session) {
    const url = new URL("/clinic/login", req.url);
    if (pathname !== "/clinic") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/clinic/audit") && session.role !== "CLINIC_ADMIN") {
    return NextResponse.redirect(new URL("/clinic?denied=audit", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/clinic", "/clinic/:path*"],
};
