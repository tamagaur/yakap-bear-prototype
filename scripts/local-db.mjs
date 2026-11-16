#!/usr/bin/env node
/**
 * Local PostgreSQL helper for teammates who have PostgreSQL binaries installed
 * (e.g. a portable install with PG_BIN set, or pg_ctl on PATH).
 *
 *   node scripts/local-db.mjs init    # create .local/pgdata + yakap & yakap_test DBs
 *   node scripts/local-db.mjs start   # start the server on localhost:5432
 *   node scripts/local-db.mjs stop
 *   node scripts/local-db.mjs status
 *
 * Teammates without local Postgres should use Neon instead (see README).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const dataDir = path.join(root, ".local", "pgdata");
const logFile = path.join(root, ".local", "postgres.log");
const port = process.env.LOCAL_PG_PORT || "5432";
const exe = (name) => {
  const bin = process.env.PG_BIN;
  const suffix = process.platform === "win32" ? ".exe" : "";
  return bin ? path.join(bin, name + suffix) : name;
};

function run(name, args, opts = {}) {
  const r = spawnSync(exe(name), args, { stdio: "inherit", ...opts });
  if (r.error) {
    console.error(`Could not run ${name}. Set PG_BIN to your PostgreSQL bin folder.`);
    process.exit(1);
  }
  return r.status ?? 1;
}

const cmd = process.argv[2] ?? "status";

if (cmd === "init") {
  if (existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("Local cluster already initialized at", dataDir);
  } else {
    mkdirSync(path.dirname(dataDir), { recursive: true });
    run("initdb", ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"]);
  }
  console.log("Next: node scripts/local-db.mjs start, then createdb yakap / yakap_test.");
} else if (cmd === "start") {
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.error("No local cluster. Run: node scripts/local-db.mjs init");
    process.exit(1);
  }
  mkdirSync(path.dirname(logFile), { recursive: true });
  // Detach with stdio redirected to a file so the server outlives this script.
  const out = openSync(logFile, "a");
  const child = spawn(
    exe("pg_ctl"),
    ["-D", dataDir, "-o", `-p ${port} -c listen_addresses=localhost`, "start"],
    { detached: true, stdio: ["ignore", out, out], windowsHide: true },
  );
  child.unref();
  setTimeout(() => {
    run("pg_isready", ["-h", "localhost", "-p", port]);
    for (const db of ["yakap", "yakap_test"]) {
      spawnSync(exe("createdb"), ["-h", "localhost", "-p", port, "-U", "postgres", db], {
        stdio: "ignore",
      });
    }
    console.log(`Databases ready: postgresql://postgres@localhost:${port}/yakap (+ yakap_test)`);
  }, 2500);
} else if (cmd === "stop") {
  run("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"]);
} else {
  run("pg_isready", ["-h", "localhost", "-p", port]);
}
