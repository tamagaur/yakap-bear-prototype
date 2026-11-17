#!/usr/bin/env node
/**
 * `npm run dev:all` — runs the Rust API (port 8080) and the Next.js frontend
 * (port 3000) together, with prefixed output. Ctrl+C stops both.
 */
import { spawn } from "node:child_process";

const procs = [
  { name: "api", color: "\x1b[33m", cmd: "cargo", args: ["run", "--manifest-path", "backend/Cargo.toml"] },
  // Through scripts/next.mjs so Tailwind's file watching works from "c:\…" terminals on Windows.
  { name: "web", color: "\x1b[36m", cmd: "node", args: ["scripts/next.mjs", "dev"] },
];

const children = procs.map((p) => {
  const child = spawn(p.cmd, p.args, { shell: process.platform === "win32", env: process.env });
  const prefix = `${p.color}[${p.name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on("data", (buf) =>
      buf
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => out.write(prefix + line + "\n")),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    children.forEach((c) => c !== child && c.kill());
    process.exit(code ?? 0);
  });
  return child;
});

process.on("SIGINT", () => {
  children.forEach((c) => c.kill());
  process.exit(0);
});
