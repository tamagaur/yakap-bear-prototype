# Implementation plan & status

Source material: Business Model Canvas and *Dev Tasks — Mobile App · Clinic Dashboard · Bear Simulator*
(`docs/reference/`). Hard freeze **Wed, Nov 18, 2026**.

## Product in one paragraph

Yakap Bear is a plush bear for adults on maintenance mental-health medication. At each dose time it plays a
reminder recorded by a family member; the patient holds the paw for 3 seconds to log "taken" (one check-in per
dose time, not per pill). If a dose is still missed after the reminder, the family gets a text (simulated here).
With written consent, the patient's clinician sees the dose log and weekly patterns. The bear has no microphone.

## Architecture (as built)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 App Router, TypeScript, Tailwind CSS 4, SWR, lucide icons, jsPDF |
| Backend | **Rust** — Axum 0.8, SQLx 0.9 (runtime queries), PostgreSQL, bcrypt, jsonwebtoken (HS256) |
| Contract | zod schemas in `src/lib/contracts` ↔ Rust DTOs in `backend/src/dto.rs`; `docs/API.md` |
| Database | PostgreSQL 15+ (local or Neon), SQL migrations in `backend/migrations` |
| Tests | Rust unit + HTTP integration (`cargo test`), Vitest (frontend), `scripts/e2e-smoke.mjs` |
| Hosting (prepared) | Rust API in a container (`backend/Dockerfile`), frontend on Vercel, Neon database |

Next.js forwards `/api/*` to the Rust API (`API_URL`), so cookies are first-party and the browser talks to one
origin. The Next page guard (`src/proxy.ts`) verifies the same JWT for redirects only; the API enforces all access.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Project setup (repo, scaffold, env, local DB, scripts) | ✅ Done |
| 1 | Database schema, contracts, seed (B2, B3, D11) | ✅ Done |
| 2 | Backend core (B4–B13): dose engine, hold filter, alerts + SMS, auth, consent, voice, sync, audit, demo clock/reset | ✅ Done — Rust |
| 3 | Bear simulator (S1–S9) | ✅ Done |
| 4 | Family app (M1–M13) | ⏸ **On hold by decision** — all its API endpoints are built and tested |
| 5 | Clinic dashboard (D1–D12) | ✅ Done |
| 6 | P1/P2: offline, battery, corrections (API), away (API), exports, audit view, empty states, plan pages | ✅ Done for bear + clinic; family-side screens on hold |
| 7 | Build, QA, demo script, docs, deployment readiness | ✅ Local verification done · ☐ deploy + phone test (Q3) need team accounts |

## Task coverage

| Task | Where |
|---|---|
| B1 skeleton | repo layout, `README.md` |
| B2 schema | `backend/migrations/0001_init.sql`, `docs/DATA_MODEL.md` |
| B3 contract | `docs/API.md`, `src/lib/contracts`, `backend/src/dto.rs` |
| B4 auth & roles | `backend/src/auth.rs`, `src/proxy.ts` |
| B5 dose state | `backend/src/dose_rules.rs`, `services/dose_engine.rs` |
| B6 squeeze filter | `dose_rules::classify_hold`, `services/hold_filter.rs` |
| B7 missed alert + SMS | `services/alerts.rs` |
| B8 consent | `services/consent.rs`, `auth::require_clinician_patient` |
| B9 voice | `routes/voice.rs` (upload, replace, assign, delete, Range streaming) |
| B10 offline sync | `services/sync.rs`, `src/lib/bear-offline.ts` |
| B11 audit | `services/audit.rs`, append-only trigger |
| B12 clock | `services/clock.rs`, `services/demo.rs` |
| B13 deploy + reset | `seed/reset.rs`, `backend/Dockerfile`, README → Deployment |
| S1–S9 | `src/app/bear`, `src/components/bear`, `src/hooks/use-bear-device.ts`, `src/app/page.tsx` |
| D1–D12 | `src/app/clinic`, `src/components/clinic` |
| M1–M13 | ⏸ UI on hold; endpoints in `backend/src/routes/{patients,schedules,voice,doses,alerts,consents,away}.rs` |
| Q1 / Q2 | `docs/DEMO_SCRIPT.md`, `docs/QA_CHECKLIST.md` |

## Decision log

| Date | Decision | Why / impact |
|---|---|---|
| Nov 16 | Next.js 16 with **Cache Components off** | Every screen depends on session or demo clock; static shells add constraints without benefit. |
| Nov 16 | Page guard in `src/proxy.ts` | Next 16 renamed `middleware` to `proxy`. |
| Nov 16 | First backend drafted in TypeScript (Prisma 7), then **replaced by Rust** | Team requirement (Rust backend) arrived mid-build. The TS draft stays in git history (first commit). |
| Nov 16 | Family app UI paused | Team decision; backend endpoints for it are complete so screens can be added without API work. |
| Nov 16 | Separate session cookies per area | One browser can demo family and clinic side by side. |
| Nov 16 | Timing defaults: ±30 min on time, +60 min late | Resolves the conflict between "late" and B6's "inside the window" rule — see `DOSE_RULES.md`. |
| Nov 16 | No background worker; evaluate on clock change / poll / view | Works on serverless and container hosts; idempotent and race-safe. |
| Nov 16 | Audio stored in Postgres (BYTEA) | Clips ≤ 2 MB; no extra storage service. |
| Nov 16 | Device pairing endpoint in demo mode | The simulator is the device; a real bear would have its key set at manufacturing. |
| Nov 16 | Clinic admins don't see patient records | Consent is given to a specific clinician; admins get the audit log and plan. |
| Nov 16 | Vitest 4 + Vite 7, `scripts/vitest.mjs` | Vitest 5 / Vite 8 broken here; Windows drive-letter casing workaround. |
| Nov 16 | SQLx runtime queries (no compile-time `query!`) | Teammates and Docker builds don't need a database at compile time. |
| Nov 16 | Sample chime as seeded "voice" | Bears need something to play before a family records; clearly labelled, never presented as a human voice. |

## Team ownership

| Owner | Area |
|---|---|
| M5 Hans | `backend/` (API, schema, rules, seed), `docs/API.md`, `DATA_MODEL.md`, `DOSE_RULES.md` |
| M6 Jertz | bear simulator, launcher, `QA_CHECKLIST.md`, Q2–Q4 |
| M1 Audrey | family shell, login, setup, schedule, voice (when resumed), `DEMO_SCRIPT.md` |
| M2 Kenrick | family history, alerts, SMS inbox, consent, away mode, plan, hotlines (when resumed) |
| M3 Kiarra | clinic login, patient list, dose log, exports, audit view, clinic plan |
| M4 Ysabela | clinic shell & styling, patient detail, insight cards, heatmap, seed data, edge states |

Git: `main` is deployable; feature branches named by task (e.g. `M4-voice-recorder`); commit messages start with
the task ID.
