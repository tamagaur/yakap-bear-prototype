import type { NextConfig } from "next";

/**
 * Yakap Bear prototype — Next.js frontend.
 *
 * The backend is the Rust API in backend/ (Axum + SQLx). Every `/api/*`
 * request is forwarded to it, so the browser only ever talks to one origin
 * and the httpOnly session cookies set by the API just work.
 *
 * Cache Components / Partial Prefetching are intentionally OFF: every screen
 * depends on the signed-in session or the simulated demo clock. See
 * docs/IMPLEMENTATION_PLAN.md → "Decision log".
 */
const API_URL = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The floating "N" dev badge sat over the clinic sidebar's Sign out button during demos.
  // Compile and runtime errors are still shown.
  devIndicators: false,
  experimental: {
    // The dev disk cache kept serving an old Tailwind stylesheet after component edits, even
    // across restarts (classes added in .tsx files never appeared). Off for dev only, so a
    // restart always shows current styles. Production builds are unaffected.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    // Pin the workspace root (a stray lockfile in the home folder confuses detection).
    root: process.cwd(),
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
