# Yakap Bear — prototype

A plush bear that helps adults on maintenance mental-health medication take their doses on time — in a loved
one's recorded voice. This repository is Group 6's working prototype: a **bear simulator**, a **clinic
dashboard**, and the backend for a **family app**, all sharing one database, one set of dose rules and one
simulated clock.

> Academic prototype — not a medical device and not a certified data-privacy system. All data is fictional.
> SMS, payments and the physical bear are simulated.

| View | URL | Status |
|---|---|---|
| Demo launcher | `/` | ✅ Built — open views, demo clock, one-click reset |
| Bear simulator (patient) | `/bear` | ✅ Built |
| Clinic dashboard (clinicians, clinic admin) | `/clinic` | ✅ Built — login → dashboard overview (home) → Patients · Audit log (admin) · Clinic plan |
| Family app (caregivers, mobile) | `/family` | ⏸ **On hold** — the API is complete, screens not built yet |

## Architecture

```
Browser ──► Next.js 16 (frontend, port 3000) ──/api/* rewrite──► Rust API (Axum + SQLx, port 8080) ──► PostgreSQL
            src/app, src/components                              backend/src
```

- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS 4, SWR). No server-side data access — every
  screen calls the API through the `/api/*` rewrite, so session cookies stay first-party.
- **Backend:** Rust (`backend/`, crate `yakap-api`) — Axum 0.8, SQLx 0.9, PostgreSQL, bcrypt, HS256 JWT session
  cookies. Owns every rule: dose engine, accidental-squeeze filter, alerts + simulated SMS, consent checks, audit
  log, offline sync, demo clock and reset.
- **Contracts:** `src/lib/contracts` (zod) mirrors the Rust DTOs (`backend/src/dto.rs`); `docs/API.md` lists every
  endpoint.

## Quick start (Windows, macOS, Linux)

Prerequisites: **Node 20.19+**, **Rust 1.85+** (`rustup`), **PostgreSQL 15+** (local) *or* a free **Neon** database.
On Windows, Rust needs the MSVC build tools (Visual Studio Build Tools).

```bash
git clone <repo-url> && cd YakapBear_Prototype
npm install                       # frontend deps
cp .env.example .env              # Windows PowerShell: copy .env.example .env
#   fill DATABASE_URL, SESSION_SECRET (32+ chars), BEAR_DEVICE_KEY, TEST_DATABASE_URL
npm run db:seed                   # builds the API, runs migrations, loads the demo data
npm run dev:all                   # Rust API on :8080 + Next.js on :3000
```

Open <http://localhost:3000>. Prefer two terminals? Run `npm run dev:api` and `npm run dev` separately.

### Database options

- **Local PostgreSQL:** create `yakap` and `yakap_test`, then
  `DATABASE_URL=postgresql://postgres@localhost:5432/yakap`. If you have portable PostgreSQL binaries, set
  `PG_BIN` and use `npm run db:local:init` / `db:local:start` / `db:local:stop` (cluster lives in `.local/`).
- **Neon:** create a project (region *AWS Singapore*), use the **direct** (non-pooled) connection string with
  `?sslmode=require`. Create a second database or branch for `TEST_DATABASE_URL`.

Migrations run automatically when the API starts (`AUTO_MIGRATE=true`) and with `npm run db:migrate`.

## Demo accounts

Shared demo-only password: **`yakap-demo-2026`**

| Email | Role | Notes |
|---|---|---|
| `family@yakap.demo` | Family | Ana Santos — daughter of **Lola Rosa** (bear `BEAR-0001`) |
| `doctor@yakap.demo` | Clinician | Dr. Paolo Reyes — consent from Rosa, Miguel, Teresa, Carmela; **not** Jun (revoked) |
| `admin@yakap.demo` | Clinic admin | Carla Dizon — audit log + plan, no patient records |
| `liza@yakap.demo`, `mark@yakap.demo` | Clinicians | other clinicians for the consent directory |
| `joy@`, `rico@`, `mae@`, `lito@yakap.demo` | Family | caregivers of the other fictional patients |

**Reset** (launcher button or `POST /api/demo/reset`) restores everything and sets the demo clock to **7:45 PM
Manila today** — 15 minutes before Lola Rosa's 8:00 PM dose.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:all` | API + frontend together |
| `npm run dev` / `npm run dev:api` | frontend only / Rust API only |
| `npm run build` | production build of the frontend |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | frontend unit tests (Vitest — offline dose memory, time helpers, rule mirror) |
| `npm run test:api` | Rust unit + HTTP integration tests (needs `TEST_DATABASE_URL`) |
| `npm run db:seed` | migrate + rebuild the demo dataset |
| `npm run db:migrate` | apply migrations |
| `cargo clippy --all-targets` (in `backend/`) | Rust lints |

## Folder structure & ownership

```
backend/                 Rust API (M5 Hans)
  migrations/            SQL schema (B2)
  src/dose_rules.rs      pure dose rules + unit tests (B5/B6)
  src/services/          dose engine, hold filter, alerts, consent, audit, sync, insights, demo clock
  src/routes/            HTTP endpoints (auth, patients, schedules, voice, doses, alerts, consents, away, bear, clinic, demo)
  src/seed/              fictional 6-week demo data + reset (D11 M4 Ysabela)
  tests/api.rs           HTTP integration tests
src/app/page.tsx         launcher (S9 M6 Jertz)
src/app/bear/            bear simulator page (S1–S8 M6 Jertz)
src/components/bear/     bear figure, paw button, chips, dose card, demo panel (M6)
  bear-3d.tsx            3D plush device (Three.js / React Three Fiber, built from code): fixed toy face; only the heart light,
                         speaker, paw sensor and vibration react. bear-3d-stage.tsx adds
                         drag-to-turn, the 2D/3D switch and the automatic 2D fallback (no WebGL / render error)
src/hooks/use-bear-device.ts, use-hold-gesture.ts   bear logic (M6)
src/app/clinic/          login (D1 M3 Kiarra), dashboard home (D7/D9 M4), patients (D2 M3), detail (D8 M4), audit (D5 M3), plan (D6 M3)
src/components/clinic/   shell (D7 M4), dose log + export (D3/D4 M3), adherence cards, daily chart, heatmap (D9/D10 M4)
src/components/ui/       shared design system (buttons, cards, pills, notices, forms, dialog)
src/lib/contracts/       shared API contracts (M5)
src/lib/dose-rules.ts    TypeScript mirror of the rules for the bear's offline memory
src/proxy.ts             page guard for /clinic (Next 16 "proxy", formerly middleware)
docs/                    plan, API, data model, dose rules, demo script, QA checklist, reference material
```

Family app (M1 Audrey, M2 Kenrick) — on hold; when it starts, build `src/app/family/*` on the existing endpoints
(`docs/API.md` → Family) and add `/family` to `src/proxy.ts`.

## Deployment (prepared, not deployed)

1. **Database:** Neon project (Singapore). Use the direct connection string.
2. **Rust API:** any container host (Render, Fly.io, Railway). `backend/Dockerfile` builds a small image.
   Env: `DATABASE_URL`, `SESSION_SECRET`, `DEMO_MODE=true`, `BEAR_DEVICE_KEY`, `COOKIE_SECURE=true`, `PORT`.
   Health check: `GET /api/health`. Then run `yakap-api seed` once (or press *Reset demo*).
3. **Frontend:** Vercel → import the repo (root directory = repo root). Env: `API_URL=https://<your-api-host>`,
   `SESSION_SECRET` (**same value as the API**). HTTPS is required for microphone recording on phones.
4. Test from a phone on mobile data (task Q3).

## Known limitations

- Family app screens are not built (by decision) — consent, voice recording, schedules, corrections and away mode
  are available through the API and covered by integration tests, but not yet clickable.
- Demo clock and reset endpoints are open to anyone when `DEMO_MODE=true` — turn it off outside demos.
- Simulator pairing (`/api/demo/devices`) exposes device keys in demo mode by design.
- Real phones were not tested from this environment; audio autoplay and recording formats vary by browser.
- Crisis hotline numbers (family app, M13) still need to be verified when that screen is built.

More: `docs/IMPLEMENTATION_PLAN.md` (decision log), `docs/QA_CHECKLIST.md` (verification + audit record).
