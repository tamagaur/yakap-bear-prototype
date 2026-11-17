#!/usr/bin/env node
/**
 * Runs the Next.js CLI from a working directory with an UPPERCASE drive letter.
 *
 * On Windows, terminals that start in "c:\…" (VS Code and its forks) are known
 * to make Node tools resolve the same file under two spellings (that is what
 * broke Vitest, see scripts/vitest.mjs). This wrapper is a guard against the
 * same class of problem for Next.js. It is NOT the fix for stale Tailwind
 * styles: that was the Turbopack CSS loader, replaced by @tailwindcss/postcss
 * (see postcss.config.mjs).
 *
 *   node scripts/next.mjs dev | build | start | typegen
 */
import { spawn } from "node:child_process";
import path from "node:path";

const cwd =
  process.platform === "win32"
    ? process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase())
    : process.cwd();
const bin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
