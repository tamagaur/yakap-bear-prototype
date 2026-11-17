# API contract (task B3)

Served by the Rust API (`backend/src/routes`). The frontend reaches it at the same origin through the Next.js
rewrite `/api/*` → `API_URL`. TypeScript shapes: `src/lib/contracts/*` (zod); Rust shapes: `backend/src/dto.rs`.

## Conventions

- JSON in/out, camelCase. Timestamps are ISO-8601 UTC with milliseconds (`2026-11-16T12:00:00.000Z`); date keys
  are Manila days `YYYY-MM-DD`; dose times are `HH:mm`.
- Errors: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "field": ["…"] } } }`.
  Codes: `BAD_REQUEST`, `VALIDATION_ERROR` (400), `UNAUTHORIZED`/`INVALID_CREDENTIALS` (401),
  `FORBIDDEN`/`WRONG_AREA` (403), `NOT_FOUND` (404), `CONFLICT` (409), `DB_UNAVAILABLE` (503), `INTERNAL` (500).
- Every response has `Cache-Control: no-store`.
- **Auth:** httpOnly cookies `yakap_family_session` / `yakap_clinic_session` (HS256 JWT, 12 h).
  **Bear:** header `x-bear-key` (+ `x-bear-device` for audio).

## Auth

| Method & path | Body / query | Response |
|---|---|---|
| `POST /api/auth/signup` | `{ name, email, password ≥ 8 }` (family only) | 201 `{ user }` + family cookie |
| `POST /api/auth/login` | `{ email, password, area: "family" \| "clinic" }` | `{ user }` + cookie · 401 wrong credentials · 403 wrong area |
| `POST /api/auth/logout?area=` | — | `{ ok: true }` (clears cookie) |
| `GET /api/auth/me?area=` | — | `{ user \| null }` |

`user = { id, name, email, role, clinicName, title }`

## Family (cookie `yakap_family_session`; patient must be linked to the user, else 404)

| Method & path | Body / query | Response |
|---|---|---|
| `GET /api/patients` | — | `{ patients: Patient[] }` |
| `POST /api/patients` | `{ fullName, nickname, birthYear?, relationship, contacts?: Contact[] }` | 201 `{ patient }` — also pairs a new bear `BEAR-000N` |
| `GET/PATCH /api/patients/:id` | PATCH `{ fullName?, nickname?, birthYear?, notes? }` | `{ patient }` |
| `GET/POST /api/patients/:id/contacts` | POST `{ name, relationship, phone, receivesSms }` | `{ contacts }` / 201 `{ contact }` |
| `PATCH/DELETE /api/contacts/:id` | partial contact | `{ contact }` / `{ ok }` |
| `GET/POST /api/patients/:id/schedules` | POST `{ label, timeOfDay, windowMinutes=30, lateMinutes=60, pillNote?, voiceMessageId? }` | `{ schedules }` / 201 `{ schedule }` · 409 same time exists |
| `PATCH/DELETE /api/schedules/:id` | partial schedule (timing change regenerates future doses) | `{ schedule }` / `{ ok }` (soft delete) |
| `GET/POST /api/patients/:id/voice` | POST multipart: `file` (audio ≤ 2 MB), `title`, `durationSec?`, `scheduleId?` | `{ voices }` / 201 `{ voice }` |
| `PATCH /api/voice/:id` | multipart: `file?` (replace), `title?`, `scheduleId?` (assign) | `{ voice }` |
| `DELETE /api/voice/:id` | — | `{ ok }` |
| `GET /api/voice/:id/audio` | family cookie **or** `x-bear-key` + `x-bear-device` (same patient) · supports `Range` | audio bytes |
| `GET /api/patients/:id/today` | — | `{ now, dateKey, doses: DoseEvent[], nextDose, openAlerts, awayNow }` |
| `GET /api/patients/:id/doses` | `?from&to&status=MISSED,LATE` (default last 30 days) | `{ from, to, now, doses }` |
| `POST /api/doses/:id/correct` | `{ toStatus: TAKEN\|LATE\|MISSED, takenAt?, reason (≥ 5 chars) }` | `{ dose }` — audited |
| `GET /api/patients/:id/alerts` | — | `{ alerts: Alert[], unacknowledged }` |
| `POST /api/alerts/:id/ack` | — | `{ alert }` (idempotent) |
| `GET /api/patients/:id/sms` | — | `{ messages: Sms[] }` oldest → newest (simulated) |
| `GET /api/clinicians` | — | `{ clinicians: [{ id, name, title, clinicName }] }` |
| `GET/POST /api/patients/:id/consents` | POST `{ clinicianId, agreed: true, signedName, signatureDataUrl: "data:image/png;base64,…" }` | `{ consents }` / 201 `{ consent }` · 409 already active |
| `POST /api/consents/:id/revoke` | — | `{ consent }` — access ends immediately |
| `GET /api/patients/:id/access-log` | — | `{ entries: [{ action, actorName, clinicName, simTime, summary }] }` |
| `GET/POST /api/patients/:id/away` | POST `{ startDate, endDate, reason: Travel\|Hospital stay\|Staying with family\|Other, note? }` | `{ periods }` / 201 `{ period }` · 409 overlap |
| `DELETE /api/away/:id` | — | `{ ok }` (cancel; reminders resume) |

Key shapes:

```jsonc
// DoseEvent
{ "id": "ev_…", "scheduleId": "sch_…", "label": "Evening", "pillNote": "3 pills",
  "scheduledFor": "…", "windowStart": "…", "onTimeEnd": "…", "lateEnd": "…",
  "status": "TAKEN", "takenAt": "…", "holdMs": 3120, "loggedBy": "BEAR", "reminderCount": 1,
  "corrected": false, "originalStatus": null, "corrections": [] }
// Alert
{ "id": "al_…", "type": "MISSED_DOSE", "title": "Missed 8:00 PM dose", "message": "…", "createdAt": "…",
  "acknowledgedAt": null, "acknowledgedByName": null, "resolvedAt": null, "resolution": null,
  "doseEventId": "ev_…", "smsCount": 2 }
// Patient
{ "id": "pat_rosa", "fullName": "Rosa Santos", "nickname": "Lola Rosa", "birthYear": 1958, "notes": null,
  "relationship": "Daughter", "device": { "id": "BEAR-0001", "batteryPct": 82, "lowBattery": false, "online": true, "lastSeenAt": "…" },
  "plan": { "includedUntil": "…", "daysLeft": 138, "status": "INCLUDED" }, "awayNow": false }
```

## Bear device (header `x-bear-key`)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/bear/:deviceId/state` | — | `{ now, device, patient: { nickname }, away, activeDose, reminderDue, nextDose, doses[] }` (doses = 12 h back → 36 h ahead, for offline memory) |
| `POST /api/bear/:deviceId/hold` | `{ clientEventId (8–64), holdMs }` | `HoldResult` — server clock decides the time |
| `POST /api/bear/:deviceId/reminder` | `{ doseId }` | `{ play, reminderCount, voiceId }` (20 s / max 3 rule) |
| `POST /api/bear/:deviceId/heartbeat` | `{ batteryPct 0–100 }` | `{ ok, batteryPct, lowBattery, alertCreated }` |
| `POST /api/bear/:deviceId/sync` | `{ events: [{ clientEventId, holdMs, heldAt }] }` (1–100) | `{ results: HoldResult[] }` |

```jsonc
// HoldResult
{ "clientEventId": "…", "accepted": false, "duplicate": false, "status": null, "reason": "TOO_SHORT",
  "doseId": "ev_…", "scheduledFor": "…", "heldAt": "…", "holdMs": 1200, "resolvedMissed": false }
```

## Clinic (cookie `yakap_clinic_session`)

Patient endpoints require role CLINICIAN **and** an active consent for that patient — otherwise **403**, even for
guessed IDs. Views and exports are audited.

| Method & path | Query / body | Response |
|---|---|---|
| `GET /api/clinic/overview` | — | Dashboard home: `{ role, clinicName, now, clinician, admin }` — clinicians get `clinician = { patients, withData, awayNow, week (7-day counts + onTimePct/adherencePct), weekPrev (the 7 days before), weekly[6] { from, to, onTimePct, adherencePct, counted } oldest → newest, today { taken, late, missed, away, upcoming }, needsAttention[] { id, fullName, nickname, missed7, onTimePct7, reasons[], topPattern }, recentMissed[] }` across **their consented patients only**; clinic admins get `admin = { clinicians, activeConsents, consentingPatients, views7, exports7 (CSV, PDF and printed sheets), consentChanges7, corrections7, recentActivity[] }` (no patient dose data) |
| `GET /api/clinic/patients` | `?q=` search | `{ patients: ClinicPatientRow[], role }` (admins get `[]`). Each row has `spark`: on-time % for the last four 7-day buckets, oldest → newest, `null` where no doses counted |
| `GET /api/clinic/patients/:id` | — | `ClinicPatientDetail` (audited: VIEW_PATIENT, de-duplicated per 5 min). Includes `device { id, batteryPct, lowBattery, online, lastSeenAt } \| null` (never the device key) and `familyContacts[] { name, relationship, receivesSms }` |
| `GET /api/clinic/patients/:id/doses` | `?from&to&status&sort=scheduledFor\|status&order=asc\|desc` | `{ from, to, doses }` |
| `GET /api/clinic/patients/:id/summary` | `?days=7` (1–90) | `AdherenceSummary` `{ days, from, to, total, taken, late, missed, away, counted, onTimePct, adherencePct, daily[] }` |
| `GET /api/clinic/patients/:id/pattern` | `?days=28` (7–90) | `{ times[], cells[weekday 0=Sun][time], hotspots[] }` |
| `GET /api/clinic/patients/:id/export.csv` | `?from&to` | CSV download (audited: EXPORT_CSV) |
| `POST /api/clinic/patients/:id/export-log` | `{ format: "pdf" \| "print", from?, to? }` | rows + 30-day summary for the browser. `pdf` = dose-log PDF (audited: EXPORT_PDF); `print` = one-page check-up sheet (audited: PRINT_CHECKUP) |
| `GET /api/clinic/audit` | `?action=` | `{ entries: AuditEntry[], clinicName }` — CLINIC_ADMIN only. Actions: VIEW_PATIENT, EXPORT_CSV, EXPORT_PDF, PRINT_CHECKUP, CORRECT_LOG, CONSENT_GRANT, CONSENT_REVOKE |

`needsAttention`: a patient is listed with 2+ misses in the last 7 days, under 70% on time in the last 7 days, or one
weekday × dose time missed 3+ times in the last 28 days. `topPattern = { weekday (0 = Sun), timeOfDay, missed, total }`
is the most-missed slot with 2+ misses; its plain-language reason ("Missed 3 of the last 4 Sunday 8:00 PM doses") comes
first in `reasons`. Counts only; no clinical conclusions.

## Demo (mutations require `DEMO_MODE=true`)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/demo/clock` | — | `{ now, realNow, offsetMs, demoMode, timezone }` |
| `POST /api/demo/clock` | `{ action: "advance", minutes }` · `{ action: "next-dose", deviceId? }` · `{ action: "past-window", deviceId? }` | clock + `message` |
| `POST /api/demo/reset` | — | `{ ok, now, counts }` — clock → 7:45 PM Manila today |
| `GET /api/demo/devices` | — | `{ devices: [{ id, deviceKey, patientNickname, patientName }] }` (simulator pairing) |
| `GET /api/demo/overview` | `?deviceId=BEAR-0001` | Launcher data: `{ now, patient { id, fullName, nickname }, device { id, batteryPct, lowBattery, online, lastSeenAt }, nextDose { id, scheduledFor, label, pillNote, status } \| null, openAlerts, latestText { body, toName, recipients[], createdAt } \| null, reminder { title, recordedByName, isSample } \| null, people { family, clinician, admin } }`. 403 unless `DEMO_MODE=true`; 404 for an unknown bear. Never returns device keys or audio URLs |
| `GET /api/health` | — | `{ ok: true }` |
