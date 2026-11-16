# Data model (task B2)

Source of truth: `backend/migrations/0001_init.sql` (PostgreSQL). All timestamps are `TIMESTAMPTZ`;
enumerations are `TEXT` with `CHECK` constraints.

"Sim" columns use the simulated demo clock; `created_at`, `last_seen_at`, `last_reminder_at` use real time.

## Entities

| Table | Purpose | Key columns / constraints |
|---|---|---|
| `users` | family caregivers, clinicians, clinic admins | `email` unique · `role` ∈ FAMILY, CLINICIAN, CLINIC_ADMIN · `password_hash` (bcrypt) · `clinic_name`, `title` |
| `patients` | adult using the bear | `nickname` (what the bear says) · `plan_started_at` (6 months included) |
| `patient_members` | which family accounts manage which patient | PK (`user_id`, `patient_id`) · `relationship` |
| `family_contacts` | simulated-SMS recipients | `phone` · `receives_sms` |
| `bear_devices` | one simulated bear per patient | PK `id` (BEAR-0001) · `patient_id` unique · `device_key` · `battery_pct` 0–100 · `low_battery_alerted` |
| `voice_messages` | family-recorded reminders (never the patient) | `data` BYTEA · `mime_type` · `duration_sec` · `is_sample` |
| `dose_schedules` | daily dose times | `time_of_day` HH:mm · `window_minutes` 5–120 · `late_minutes` 0–240 · `pill_note` · `voice_message_id` → voice (SET NULL) · soft delete `deleted_at` |
| `dose_events` | ONE row per schedule per dose time | **UNIQUE(`schedule_id`, `scheduled_for`)** · `status` · `taken_at` · `hold_ms` · `logged_by` ∈ BEAR, OFFLINE_SYNC, FAMILY · `client_event_id` unique · `reminder_count` · `corrected` · `original_status` · window snapshot |
| `dose_attempts` | rejected paw holds | `reason` ∈ TOO_SHORT, OUTSIDE_WINDOW, ALREADY_LOGGED, AWAY · `held_at` · `hold_ms` · `client_event_id` unique · `via_sync` |
| `dose_corrections` | family correction history | `from_status` → `to_status` · `from_taken_at`/`to_taken_at` · `reason` (required) · `corrected_by_id` |
| `alerts` | missed-dose and low-battery alerts | `type` ∈ MISSED_DOSE, LOW_BATTERY · `dose_event_id` **unique** · `acknowledged_at` · `resolved_at` + `resolution` |
| `sms_messages` | simulated SMS (never sent) | `to_name`, `to_phone`, `body`, `sent_at` · `alert_id` |
| `consents` | written consent: one clinician ↔ one patient | `signed_name` · `signature_data_url` (PNG) · `consent_version` · `granted_at` · `revoked_at`, `revoked_by_id` |
| `away_periods` | away mode (whole Manila days) | `start_date`/`end_date` (keys) · `starts_at`/`ends_at` [start, end) · `reason` · `cancelled_at` |
| `audit_log` | privacy log — **append-only** (trigger blocks UPDATE/DELETE) | `action` ∈ VIEW_PATIENT, EXPORT_CSV, EXPORT_PDF, CORRECT_LOG, CONSENT_GRANT, CONSENT_REVOKE · `actor_*` · `patient_id` · `clinic_name` · `details` JSONB · `sim_time` |
| `sim_clock` | single row: demo clock offset | `id = 1` · `offset_ms` |

## Relationships

```
users ─┬─< patient_members >─ patients ─┬─ bear_devices (1:1)
       │                                ├─< family_contacts
       │                                ├─< voice_messages ──< dose_schedules (voice)
       │                                ├─< dose_schedules ──< dose_events ──< dose_corrections
       │                                │                       │   └── alerts (0..1 per event) ──< sms_messages
       │                                ├─< dose_attempts (optional dose_event)
       ├─< consents (clinician / granted_by / revoked_by) >─ patients
       ├─< away_periods (created_by) >─ patients
       └─< audit_log (actor) >─ patients
```

## Ownership & access rules

- **Family** user: only patients linked through `patient_members` (others → 404).
- **Clinician:** only patients with an active consent row for them (`revoked_at IS NULL`) → otherwise 403 on every
  clinic endpoint, including direct URLs.
- **Clinic admin:** no patient records; audit entries for their clinic (`clinic_name`) plus family corrections on
  patients who consented to that clinic.
- **Bear:** authenticated by `x-bear-key`; can read state for its own patient and play only that patient's voice
  messages.
- Voice audio is never shared with clinicians.

## Demo data (task D11)

`backend/src/seed/` builds a deterministic dataset relative to "today": 9 users, 5 fictional patients, 6 weeks of
history with patterns (Lola Rosa misses Sunday evenings and is late on Monday mornings; Miguel is late on weekday
mornings and misses Friday nights; Jun misses Saturdays), Teresa in an active away period (hospital stay), Jun's
consent to Dr. Reyes revoked, Carmela with no data yet, a corrected dose with audit trail, and a missed-dose alert
+ SMS for every missed dose.
