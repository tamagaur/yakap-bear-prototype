-- Yakap Bear prototype — database schema (task B2). Documentation: docs/DATA_MODEL.md
--
-- Conventions
--   * All timestamps are TIMESTAMPTZ (UTC on the wire; Asia/Manila in the UI).
--   * "Sim" timestamps (dose times, alerts, SMS, audit sim_time) come from the
--     simulated demo clock (sim_clock); created_at / last_seen_at are real time.
--   * Enumerations are TEXT columns guarded by CHECK constraints.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('FAMILY', 'CLINICIAN', 'CLINIC_ADMIN')),
  clinic_name   TEXT,
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  nickname        TEXT NOT NULL,          -- what the bear calls the patient
  birth_year      INT,
  notes           TEXT,
  plan_started_at TIMESTAMPTZ NOT NULL,   -- start of "6 months of alerts & app included"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_members (
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  relationship TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, patient_id)
);

CREATE TABLE family_contacts (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone        TEXT NOT NULL,
  receives_sms BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX family_contacts_patient_idx ON family_contacts (patient_id);

CREATE TABLE bear_devices (
  id                  TEXT PRIMARY KEY,                 -- e.g. BEAR-0001
  patient_id          TEXT NOT NULL UNIQUE REFERENCES patients (id) ON DELETE CASCADE,
  device_key          TEXT NOT NULL,                    -- sent in the x-bear-key header
  battery_pct         INT NOT NULL DEFAULT 100 CHECK (battery_pct BETWEEN 0 AND 100),
  last_seen_at        TIMESTAMPTZ,
  low_battery_alerted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Family-recorded reminder audio. The bear has no microphone: the patient's
-- voice is never recorded or stored.
CREATE TABLE voice_messages (
  id             TEXT PRIMARY KEY,
  patient_id     TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  duration_sec   DOUBLE PRECISION,
  size_bytes     INT NOT NULL,
  data           BYTEA NOT NULL,
  recorded_by_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  is_sample      BOOLEAN NOT NULL DEFAULT FALSE,     -- seeded chime, not a human recording
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX voice_messages_patient_idx ON voice_messages (patient_id);

CREATE TABLE dose_schedules (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  time_of_day      TEXT NOT NULL CHECK (time_of_day ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  window_minutes   INT NOT NULL DEFAULT 30 CHECK (window_minutes BETWEEN 5 AND 120),
  late_minutes     INT NOT NULL DEFAULT 60 CHECK (late_minutes BETWEEN 0 AND 240),
  pill_note        TEXT,                              -- "3 pills" is still ONE check-in
  voice_message_id TEXT REFERENCES voice_messages (id) ON DELETE SET NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from   TIMESTAMPTZ NOT NULL,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dose_schedules_patient_idx ON dose_schedules (patient_id);

-- Exactly ONE row per schedule per dose time (never one per pill).
CREATE TABLE dose_events (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  schedule_id      TEXT NOT NULL REFERENCES dose_schedules (id) ON DELETE CASCADE,
  scheduled_for    TIMESTAMPTZ NOT NULL,
  window_minutes   INT NOT NULL,                      -- snapshot of the schedule
  late_minutes     INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'UPCOMING'
                   CHECK (status IN ('UPCOMING', 'REMINDED', 'TAKEN', 'LATE', 'MISSED', 'AWAY')),
  taken_at         TIMESTAMPTZ,
  hold_ms          INT,
  logged_by        TEXT CHECK (logged_by IN ('BEAR', 'OFFLINE_SYNC', 'FAMILY')),
  client_event_id  TEXT UNIQUE,                       -- idempotency key of the accepted hold
  reminder_count   INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,                       -- real time (20 s repeat rule)
  reminded_at      TIMESTAMPTZ,                       -- sim time of the first reminder
  corrected        BOOLEAN NOT NULL DEFAULT FALSE,
  original_status  TEXT CHECK (original_status IN ('UPCOMING', 'REMINDED', 'TAKEN', 'LATE', 'MISSED', 'AWAY')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dose_events_one_per_dose_time UNIQUE (schedule_id, scheduled_for)
);
CREATE INDEX dose_events_patient_time_idx ON dose_events (patient_id, scheduled_for);
CREATE INDEX dose_events_status_idx ON dose_events (status);

-- Rejected paw holds (accidental squeezes etc.), kept apart from dose events.
CREATE TABLE dose_attempts (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  device_id       TEXT,
  dose_event_id   TEXT REFERENCES dose_events (id) ON DELETE SET NULL,
  held_at         TIMESTAMPTZ NOT NULL,
  hold_ms         INT NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN ('TOO_SHORT', 'OUTSIDE_WINDOW', 'ALREADY_LOGGED', 'AWAY')),
  client_event_id TEXT UNIQUE,
  via_sync        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dose_attempts_patient_idx ON dose_attempts (patient_id, held_at);

CREATE TABLE dose_corrections (
  id              TEXT PRIMARY KEY,
  dose_event_id   TEXT NOT NULL REFERENCES dose_events (id) ON DELETE CASCADE,
  from_status     TEXT NOT NULL,
  to_status       TEXT NOT NULL,
  from_taken_at   TIMESTAMPTZ,
  to_taken_at     TIMESTAMPTZ,
  reason          TEXT NOT NULL,
  corrected_by_id TEXT NOT NULL REFERENCES users (id),
  corrected_at    TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dose_corrections_event_idx ON dose_corrections (dose_event_id);

CREATE TABLE alerts (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('MISSED_DOSE', 'LOW_BATTERY')),
  dose_event_id      TEXT UNIQUE REFERENCES dose_events (id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  message            TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL,            -- sim time
  acknowledged_at    TIMESTAMPTZ,
  acknowledged_by_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolved_at        TIMESTAMPTZ,
  resolution         TEXT
);
CREATE INDEX alerts_patient_idx ON alerts (patient_id, created_at);

-- Simulated SMS: stored and shown in the family app, never actually sent.
CREATE TABLE sms_messages (
  id         TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  alert_id   TEXT REFERENCES alerts (id) ON DELETE SET NULL,
  to_name    TEXT NOT NULL,
  to_phone   TEXT NOT NULL,
  body       TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL,                    -- sim time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sms_messages_patient_idx ON sms_messages (patient_id, sent_at);

CREATE TABLE consents (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  clinician_id       TEXT NOT NULL REFERENCES users (id),
  granted_by_id      TEXT NOT NULL REFERENCES users (id),
  signed_name        TEXT NOT NULL,
  signature_data_url TEXT NOT NULL,                   -- PNG from the signature pad
  consent_version    TEXT NOT NULL,
  granted_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  revoked_by_id      TEXT REFERENCES users (id)
);
CREATE INDEX consents_patient_clinician_idx ON consents (patient_id, clinician_id);

CREATE TABLE away_periods (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  start_date    TEXT NOT NULL,                        -- Manila date keys, inclusive
  end_date      TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,                 -- [starts_at, ends_at)
  ends_at       TIMESTAMPTZ NOT NULL,
  reason        TEXT NOT NULL,
  note          TEXT,
  created_by_id TEXT NOT NULL REFERENCES users (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at  TIMESTAMPTZ
);
CREATE INDEX away_periods_patient_idx ON away_periods (patient_id, starts_at);

-- Privacy log (task B11): clinician views/exports, corrections, consent changes.
CREATE TABLE audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_name  TEXT NOT NULL,
  actor_role  TEXT CHECK (actor_role IN ('FAMILY', 'CLINICIAN', 'CLINIC_ADMIN')),
  action      TEXT NOT NULL CHECK (action IN ('VIEW_PATIENT', 'EXPORT_CSV', 'EXPORT_PDF', 'CORRECT_LOG', 'CONSENT_GRANT', 'CONSENT_REVOKE')),
  patient_id  TEXT REFERENCES patients (id) ON DELETE SET NULL,
  clinic_name TEXT,
  details     JSONB,
  sim_time    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_patient_idx ON audit_log (patient_id, sim_time);
CREATE INDEX audit_log_clinic_idx ON audit_log (clinic_name, sim_time);

-- Audit entries are append-only: they can't be edited or deleted row by row.
-- (The demo reset wipes the whole demo dataset with TRUNCATE.)
CREATE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- Single row: offset of the simulated demo clock from real time (task B12).
CREATE TABLE sim_clock (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  offset_ms  BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
