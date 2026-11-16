#!/usr/bin/env node
/**
 * Runs Vitest from a working directory with an UPPERCASE drive letter.
 * On Windows, terminals that start in "c:\…" (e.g. VS Code) make Vitest load
 * two copies of its runner and every test file fails with
 * "Cannot read properties of undefined (reading 'config')".
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd =
  process.platform === "win32"
    ? process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase())
    : process.cwd();
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(result.status ?? 1);
