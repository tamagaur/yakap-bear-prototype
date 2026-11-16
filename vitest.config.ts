import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Frontend unit tests (the bear simulator's offline copy of the dose rules and
 * the Manila time helpers). Backend tests live in backend/ (`npm run test:api`).
 */
// Run through `npm test` (scripts/vitest.mjs) — it works around a Windows
// drive-letter-casing issue that breaks Vitest in "c:\…" terminals.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
