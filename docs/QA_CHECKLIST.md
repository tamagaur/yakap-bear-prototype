# QA checklist & audit record (tasks Q2, Q3)

Last verified: **Mon, Nov 16, 2026** on Windows 11 (local PostgreSQL 17, Rust 1.99, Node 22, Edge headless for
screenshots). Real phones and the deployed site were **not** tested yet — that is task Q3 for the team.

## How to verify

| Command | Result on last run |
|---|---|
| `npm run test:api` | ✅ 26 Rust unit tests + 11 HTTP integration tests passed |
| `npm test` | ✅ 30 frontend unit tests passed (dose-rule mirror, offline memory, time helpers) |
| `npm run e2e` (app running) | ✅ 43/43 end-to-end checks passed |
| `npm run lint` · `npm run typecheck` | ✅ clean |
| `cargo clippy --all-targets` (backend) | ✅ 0 warnings |
| `npm run build` | ✅ production build succeeds |

## Checklist by feature category

Legend: ✅ verified · 🖥 verified in a desktop/mobile-emulated browser · ⏸ not built (family app on hold) · ☐ team to verify on real devices

### Hold-paw log (S1–S3, B6)
- ✅ 2.99 s hold rejected (`TOO_SHORT`), 3.00 s accepted — unit + integration + e2e
- ✅ Exact on-time and late boundaries (7:30:00, 8:30:00, 8:30:00.001, 9:30:00, 9:30:00.001)
- ✅ One log per dose time — second hold → `ALREADY_LOGGED`; DB unique constraint holds
- ✅ Duplicate submission (same `clientEventId`) is idempotent
- 🖥 Progress ring fills over 3 s; early release resets; mouse, touch emulation, keyboard (Space/Enter)
- 🖥 Bear feedback: happy (taken), puzzled (ignored), already recorded
- ☐ Long-press menu / text selection suppressed on real iOS/Android

### Reminders (S4, S5)
- ✅ Reminder due at dose time; max 3; ≥ 20 s apart (server-enforced); stops when logged
- ✅ Family voice assigned to the dose time is served to the bear (audio download, correct MIME)
- ✅ No family voice → chime fallback
- 🖥 "Turn on bear" unlocks audio; "Continue without sound" works; speaker waves while playing
- ☐ Audio playback on real iPhone (Safari) and Android (Chrome)

### Dose logic & alerts (B5, B7)
- ✅ Missed after the late period → exactly one alert + one simulated SMS per opted-in contact
- ✅ Re-evaluation never duplicates alerts/SMS; demo reset is repeatable with identical counts
- ✅ Alert acknowledgement is idempotent

### Offline & battery (B10, S6, S7)
- ✅ Offline sync re-validates original hold time; duplicates skipped; MISSED → TAKEN/LATE resolves the alert
- 🖥 Wi-Fi toggle → hold saved on the bear → server marks missed → reconnect → synced as TAKEN
- ✅ Battery ≤ 20 % → one low-battery alert; recharge re-arms and resolves
- 🖥 Amber blinking heart, sleepy bear, warning sound

### Access control & privacy (B4, B8, B11, D1, D5)
- ✅ Invalid login 401; wrong area 403; missing/tampered session 401
- ✅ Family can't read other families' patients (404)
- ✅ Clinician sees only consented patients; guessed IDs → 403 on every clinic endpoint (detail, log, summary, pattern, CSV)
- ✅ Consent grant → access; revoke → access removed immediately; past audit entries intact
- ✅ Audit log is append-only (DB trigger rejects UPDATE/DELETE)
- ✅ Clinic admin: audit log yes, patient records no; clinicians can't open the audit log
- ✅ Voice audio never public (family cookie or the patient's own bear only); clinicians never get voice data
- 🖥 Page guard redirects signed-out visitors to /clinic/login

### Clinic dashboard (D2–D12)
- 🖥 `/clinic` signed out → login; sign-in → dashboard overview at `/clinic` (no intermediate page); refresh keeps it; `/clinic/login` while signed in → dashboard
- 🖥 Persistent sidebar with icons: Dashboard, Patients, Audit log (admins only), Clinic plan; active item highlighted; drawer on mobile
- ✅ `GET /api/clinic/overview` is role-specific: clinicians see only consented patients (never Jun's data); admins get counts and audit activity, no patient dose data
- ✅ Clinician opening `/clinic/audit` → dashboard with "only for clinic administrators" notice
- 🖥 Patient list with search, adherence, last dose, away badge, "No data yet"
- 🖥 Detail: adherence cards (7/30 days, away excluded), doses-per-day chart with legend/tooltip/table view, schedule, family caregivers, recent doses
- 🖥 Dose log: date range, status filters, sortable date/status, correction details
- 🖥 Patterns heatmap (weekday × dose time, missed/total text in every cell, legend, hotspots)
- ✅ CSV export (audited) · ✅ PDF export data (audited) · 🖥 PDF generated in browser
- 🖥 Empty/edge states: no consent (access denied), no data yet, away mode notice, admin empty state
- 🖥 Clinic plan page (₱30,000/year, bulk orders, "prototype only")

### Demo tools (B12, B13, S8, S9)
- ✅ +1 hour, jump to next dose, jump past window; time never moves backwards
- ✅ Reset → 7:45 PM Manila today; seeded sessions survive reset
- 🖥 Launcher: open views, one-click clinician sign-in, reset with confirmation, demo accounts

### Responsive & visual
- 🖥 Bear and clinic at 1366 px and 390 px (mobile emulation); clinic menu collapses to a drawer
- ✅ Status colors validated for color-blind separation; "late" amber is 2.95:1 on white, so every chart has text labels, a legend, tooltips and a table view

### Family app (M1–M13)
- ⏸ Screens not built (decision). API endpoints for schedules, voice, history, corrections, alerts, SMS, consent, away mode and contacts are implemented and exercised by the integration and e2e tests.

### Deployment (B13, Q3)
- ☐ Deploy API (container) + frontend (Vercel) with HTTPS
- ☐ Test on a phone over mobile data; verify mic permission once the family recorder exists

## Audit record (findings during implementation)

| # | Finding | Severity | Area | Evidence | Correction | Verification | Remaining |
|---|---|---|---|---|---|---|---|
| 1 | Vitest 5.1 / Vite 8.3 failed every test (“reading 'config'”) | Major (tooling) | Tests | minimal one-line test failed | Pinned Vitest 4.1.12 + Vite 7.3; found Windows drive-letter casing (`c:` vs `C:`) loads two runner copies → `scripts/vitest.mjs` normalizes cwd | `npm test` passes from both casings | — |
| 2 | `npm install` crashed (“edgesOut”) on Vite 8 optional peer chain | Major (tooling) | Setup | npm debug log | Vite 7 pin | clean `npm install` works | — |
| 3 | Seeded audit rows had `created_at = now()`, so the 5-min view de-dupe hid a genuine new clinician view | Major | Privacy/audit | integration test failed | seed writes historical `created_at` | test passes | — |
| 4 | Login spent no bcrypt time for unknown emails (invalid dummy hash) | Minor | Security | code review | hash the attempted password instead | code path reviewed | No login rate limiting (prototype) |
| 5 | React Compiler lint: setState in effects, component created in render, self-referencing rAF loop | Major | Frontend correctness | ESLint errors | moved to SWR `onSuccess`, derived state, inner tick closure | lint clean; flows re-tested in browser | — |
| 6 | “Ignored” bear face read as angry | Minor | UX tone | screenshot | gently puzzled brows | screenshot | — |
| 7 | Hearts overlapped the speech bubble; console showed 7:59 for an 8:00 reminder | Cosmetic | Bear | screenshot | repositioned; use server time for the log | screenshot | — |
| 8 | Demo buttons wrapped; clinic sidebar stopped at viewport height; mobile demo bar crowded; names wrapping | Minor | Layout | screenshots | full-width buttons, sticky inner sidebar, compact bar, nowrap | screenshots | — |
| 9 | Integration tests assumed an exact demo-clock instant (clock ticks in real time) | Minor | Tests | flaky assertion | tolerance + boundary covered by unit tests | 11/11 pass | — |
| 10 | Local `.env` secrets accidentally emptied while editing config | Minor (environment) | Dev setup | lengths 0 | regenerated secrets, restarted servers, reseeded | e2e 43/43 | Teammates generate their own secrets |
| 11 | Status amber (late) contrast 2.95:1 | Minor | Accessibility | palette validator WARN | kept for separation from “missed”; added labels, legend, tooltips, table view | validator + screenshots | — |
| 12 | Demo reset failed (500) on the shared Neon DB while the bear page was polling: deadlock, then a pooled connection stuck in a failed transaction | Major | Demo tools (B13) | API log: `deadlock detected`, `current transaction is aborted` | Reset now runs as one transaction (5 s lock timeout) and retries on deadlock/lock timeout/aborted connection | 3 resets during 60 concurrent bear polls: all OK, 0 errors; `cargo test` 42/42; e2e 56/56 | Reset takes ~10 s over Neon |
| 13 | Clinic dashboard slow on the shared Neon DB: patient list ~8 s, overview 4–6 s, dose log 4–5 s | Major (demo risk) | Clinic dashboard (D2–D4) | `curl` timings; SQLx query log: 41 sequential queries per patient list, plus a ping before each | Per-patient reads and the overview totals run concurrently; pool no longer pings before every query (idle connections close after 60 s) | typical 0.6–1.2 s per screen; `cargo test` 42/42; e2e 56/56 | Occasional 2–3 s spikes from Wi-Fi jitter to Singapore |

## Known limitations (not defects)

- Family app UI paused; consent/recording/corrections are not clickable yet.
- Demo endpoints (clock, reset, device pairing) are open when `DEMO_MODE=true`.
- Sessions are stateless JWTs (12 h): sign-out clears the cookie but a copied token stays valid until expiry.
- Browser recording formats differ (Chrome WebM/Opus, Safari MP4/AAC); test the family recorder across browsers when built.
- Not tested on real phones or the deployed site from this environment.
