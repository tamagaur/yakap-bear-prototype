//! Demo reset (tasks B13, S9, D11). Wipes every application table and
//! rebuilds the same fictional dataset, with the clock at 7:45 PM Manila
//! "today". Running it repeatedly never duplicates events, alerts or SMS.

use std::collections::{BTreeMap, HashMap};

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use serde_json::json;
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::{
    config::Config,
    dose_rules::{DEFAULT_LATE_MINUTES, DEFAULT_WINDOW_MINUTES, TimeRange},
    error::ApiResult,
    new_id,
    seed::{
        DEMO_PASSWORD, audio,
        demo_data::{self, AWAY, CLINIC_NAME, CONSENTS, CORRECTION, PATIENTS, USERS, VIEWS},
        history::{self, CorrectionSpec, HistoryInput, HistoryRows, Outcome},
    },
    services::{clock, consent::CONSENT_VERSION, dose_engine},
    time,
};

// 1×1 transparent PNG — placeholder signature for seeded (historical) consents.
const SEED_SIGNATURE: &str =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResetSummary {
    pub ok: bool,
    pub now: String,
    pub counts: BTreeMap<&'static str, i64>,
}

const CHUNK: usize = 500;

pub async fn reset_demo(pool: &PgPool, cfg: &Config, sim_now: Option<DateTime<Utc>>) -> ApiResult<ResetSummary> {
    let now = sim_now.unwrap_or_else(|| clock::reset_target(Utc::now()));
    let today = time::date_of(now);
    let days_ago = |n: i64, hhmm: &str| time::from_manila(time::add_days(today, -n), hhmm);

    sqlx::query(
        "TRUNCATE TABLE audit_log, sms_messages, alerts, dose_corrections, dose_attempts, dose_events,
                        dose_schedules, voice_messages, consents, away_periods, family_contacts, bear_devices,
                        patient_members, patients, users, sim_clock RESTART IDENTITY CASCADE",
    )
    .execute(pool)
    .await?;
    clock::set_now(pool, now, true).await?;

    let password_hash = crate::auth::hash_password(DEMO_PASSWORD.to_string()).await?;
    let mut qb: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO users (id, email, password_hash, name, role, clinic_name, title, created_at) ");
    qb.push_values(USERS, |mut b, u| {
        b.push_bind(u.id)
            .push_bind(u.email)
            .push_bind(&password_hash)
            .push_bind(u.name)
            .push_bind(u.role)
            .push_bind(u.clinic_name)
            .push_bind(u.title)
            .push_bind(days_ago(80, "09:00"));
    });
    qb.build().execute(pool).await?;

    let chime = audio::chime_wav();
    let mut all = HistoryRows::default();

    for (index, p) in PATIENTS.iter().enumerate() {
        sqlx::query(
            "INSERT INTO patients (id, full_name, nickname, birth_year, plan_started_at, created_at) VALUES ($1, $2, $3, $4, $5, $5)",
        )
        .bind(p.id)
        .bind(p.full_name)
        .bind(p.nickname)
        .bind(p.birth_year)
        .bind(days_ago(p.created_days_ago, "09:00"))
        .execute(pool)
        .await?;
        sqlx::query("INSERT INTO patient_members (user_id, patient_id, relationship) VALUES ($1, $2, $3)")
            .bind(p.member_user_id)
            .bind(p.id)
            .bind(p.member_relationship)
            .execute(pool)
            .await?;
        for (i, c) in p.contacts.iter().enumerate() {
            sqlx::query(
                "INSERT INTO family_contacts (id, patient_id, name, relationship, phone, receives_sms, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
            )
            .bind(format!("fc_{}_{i}", p.key))
            .bind(p.id)
            .bind(c.name)
            .bind(c.relationship)
            .bind(c.phone)
            .bind(c.receives_sms)
            .bind(days_ago(p.created_days_ago, "09:00") + Duration::seconds(i as i64))
            .execute(pool)
            .await?;
        }
        sqlx::query("INSERT INTO bear_devices (id, patient_id, device_key, battery_pct) VALUES ($1, $2, $3, $4)")
            .bind(p.device_id)
            .bind(p.id)
            .bind(&cfg.bear_device_key)
            .bind(p.battery_pct)
            .execute(pool)
            .await?;

        let sample_voice_id = format!("voice_sample_{}", p.key);
        if p.sample_voice {
            sqlx::query(
                "INSERT INTO voice_messages (id, patient_id, title, mime_type, duration_sec, size_bytes, data, is_sample)
                 VALUES ($1, $2, 'Sample chime (record your own voice)', 'audio/wav', $3, $4, $5, TRUE)",
            )
            .bind(&sample_voice_id)
            .bind(p.id)
            .bind(audio::CHIME_DURATION_SEC)
            .bind(chime.len() as i32)
            .bind(&chime)
            .execute(pool)
            .await?;
        }
        for s in p.schedules {
            let effective = if s.since_days >= 0 {
                days_ago(s.since_days, "00:00")
            } else {
                time::from_manila(time::add_days(today, 1), "00:00")
            };
            sqlx::query(
                "INSERT INTO dose_schedules (id, patient_id, label, time_of_day, window_minutes, late_minutes, pill_note, voice_message_id, effective_from)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            )
            .bind(s.id)
            .bind(p.id)
            .bind(s.label)
            .bind(s.time_of_day)
            .bind(DEFAULT_WINDOW_MINUTES)
            .bind(DEFAULT_LATE_MINUTES)
            .bind(s.pill_note)
            .bind((s.sample_voice && p.sample_voice).then(|| sample_voice_id.clone()))
            .bind(effective)
            .execute(pool)
            .await?;
        }

        let away: Vec<TimeRange> = AWAY
            .iter()
            .filter(|a| a.patient_id == p.id)
            .map(|a| TimeRange {
                starts_at: time::start_of_day(time::add_days(today, -a.from_days_ago)),
                ends_at: time::start_of_day(time::add_days(today, a.to_days_ahead + 1)),
            })
            .collect();
        let mut forced = HashMap::new();
        let mut correction = None;
        if p.key == CORRECTION.patient_key {
            forced.insert((today, "08:00"), Outcome::Taken);
            forced.insert((time::add_days(today, -1), "20:00"), Outcome::Missed);
            let corr_date = time::add_days(today, -CORRECTION.days_ago);
            forced.insert((corr_date, CORRECTION.time_of_day), Outcome::Missed);
            correction = Some(CorrectionSpec {
                date: corr_date,
                time_of_day: CORRECTION.time_of_day,
                reason: CORRECTION.reason,
                taken_at_time: CORRECTION.taken_at_time,
                corrected_by_id: CORRECTION.corrected_by_id,
            });
        }
        let rows = history::generate(&HistoryInput {
            patient: p,
            today,
            now,
            seed: 1000 + index as u32 * 97,
            away: &away,
            window_minutes: DEFAULT_WINDOW_MINUTES,
            late_minutes: DEFAULT_LATE_MINUTES,
            forced,
            correction,
        });
        all.events.extend(rows.events);
        all.alerts.extend(rows.alerts);
        all.sms.extend(rows.sms);
        all.attempts.extend(rows.attempts);
        all.corrections.extend(rows.corrections);
    }

    for chunk in all.events.chunks(CHUNK) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO dose_events (id, patient_id, schedule_id, scheduled_for, window_minutes, late_minutes, status,
             taken_at, hold_ms, logged_by, reminder_count, reminded_at, corrected, original_status) ",
        );
        qb.push_values(chunk, |mut b, e| {
            b.push_bind(&e.id)
                .push_bind(&e.patient_id)
                .push_bind(&e.schedule_id)
                .push_bind(e.scheduled_for)
                .push_bind(e.window_minutes)
                .push_bind(e.late_minutes)
                .push_bind(e.status)
                .push_bind(e.taken_at)
                .push_bind(e.hold_ms)
                .push_bind(e.logged_by)
                .push_bind(e.reminder_count)
                .push_bind(e.reminded_at)
                .push_bind(e.corrected)
                .push_bind(e.original_status);
        });
        qb.build().execute(pool).await?;
    }
    for chunk in all.alerts.chunks(CHUNK) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO alerts (id, patient_id, type, dose_event_id, title, message, created_at, acknowledged_at,
             acknowledged_by_id, resolved_at, resolution) ",
        );
        qb.push_values(chunk, |mut b, a| {
            b.push_bind(&a.id)
                .push_bind(&a.patient_id)
                .push_bind("MISSED_DOSE")
                .push_bind(&a.dose_event_id)
                .push_bind(&a.title)
                .push_bind(&a.message)
                .push_bind(a.created_at)
                .push_bind(a.acknowledged_at)
                .push_bind(&a.acknowledged_by_id)
                .push_bind(a.resolved_at)
                .push_bind(&a.resolution);
        });
        qb.build().execute(pool).await?;
    }
    for chunk in all.sms.chunks(CHUNK) {
        let mut qb: QueryBuilder<Postgres> =
            QueryBuilder::new("INSERT INTO sms_messages (id, patient_id, alert_id, to_name, to_phone, body, sent_at) ");
        qb.push_values(chunk, |mut b, s| {
            b.push_bind(new_id("sms"))
                .push_bind(&s.patient_id)
                .push_bind(&s.alert_id)
                .push_bind(&s.to_name)
                .push_bind(&s.to_phone)
                .push_bind(&s.body)
                .push_bind(s.sent_at);
        });
        qb.build().execute(pool).await?;
    }
    for chunk in all.attempts.chunks(CHUNK) {
        let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "INSERT INTO dose_attempts (id, patient_id, device_id, dose_event_id, held_at, hold_ms, reason) ",
        );
        qb.push_values(chunk, |mut b, a| {
            b.push_bind(new_id("att"))
                .push_bind(&a.patient_id)
                .push_bind(&a.device_id)
                .push_bind(&a.dose_event_id)
                .push_bind(a.held_at)
                .push_bind(a.hold_ms)
                .push_bind(a.reason);
        });
        qb.build().execute(pool).await?;
    }
    for c in &all.corrections {
        sqlx::query(
            "INSERT INTO dose_corrections (id, dose_event_id, from_status, to_status, from_taken_at, to_taken_at, reason, corrected_by_id, corrected_at)
             VALUES ($1, $2, 'MISSED', 'TAKEN', NULL, $3, $4, $5, $6)",
        )
        .bind(new_id("cor"))
        .bind(&c.dose_event_id)
        .bind(c.to_taken_at)
        .bind(&c.reason)
        .bind(&c.corrected_by_id)
        .bind(c.corrected_at)
        .execute(pool)
        .await?;
    }

    for a in AWAY {
        let start = time::add_days(today, -a.from_days_ago);
        let end = time::add_days(today, a.to_days_ahead);
        sqlx::query(
            "INSERT INTO away_periods (id, patient_id, start_date, end_date, starts_at, ends_at, reason, note, created_by_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(a.id)
        .bind(a.patient_id)
        .bind(time::key(start))
        .bind(time::key(end))
        .bind(time::start_of_day(start))
        .bind(time::start_of_day(time::add_days(end, 1)))
        .bind(a.reason)
        .bind(a.note)
        .bind(a.created_by_id)
        .bind(days_ago(a.from_days_ago + 1, "10:00"))
        .execute(pool)
        .await?;
    }

    // Consents and their audit trail.
    let user = |id: &str| USERS.iter().find(|u| u.id == id).expect("seed user");
    let mut audit: Vec<(Option<&'static str>, String, &'static str, &'static str, Option<&'static str>, Option<&'static str>, serde_json::Value, DateTime<Utc>)> =
        Vec::new();
    for c in CONSENTS {
        let granted_at = if c.days_ago == 0 { now - Duration::hours(3) } else { days_ago(c.days_ago, "15:20") };
        let revoked_at = c.revoked_days_ago.map(|d| days_ago(d, "18:05"));
        sqlx::query(
            "INSERT INTO consents (id, patient_id, clinician_id, granted_by_id, signed_name, signature_data_url, consent_version, granted_at, revoked_at, revoked_by_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(c.id)
        .bind(c.patient_id)
        .bind(c.clinician_id)
        .bind(c.granted_by_id)
        .bind(c.signed_name)
        .bind(SEED_SIGNATURE)
        .bind(CONSENT_VERSION)
        .bind(granted_at)
        .bind(revoked_at)
        .bind(revoked_at.map(|_| c.granted_by_id))
        .execute(pool)
        .await?;
        let family = user(c.granted_by_id);
        let clinician = user(c.clinician_id);
        audit.push((
            Some(family.id),
            family.name.into(),
            family.role,
            "CONSENT_GRANT",
            Some(c.patient_id),
            clinician.clinic_name,
            json!({ "clinician": clinician.name, "signedName": c.signed_name, "version": CONSENT_VERSION }),
            granted_at,
        ));
        if let Some(r) = revoked_at {
            audit.push((
                Some(family.id),
                family.name.into(),
                family.role,
                "CONSENT_REVOKE",
                Some(c.patient_id),
                clinician.clinic_name,
                json!({ "clinician": clinician.name }),
                r,
            ));
        }
    }
    for v in VIEWS {
        let actor = user(v.actor);
        let details = if v.action == "VIEW_PATIENT" {
            json!({ "section": "overview" })
        } else {
            json!({ "format": if v.action == "EXPORT_CSV" { "csv" } else { "pdf" }, "rows": 60 })
        };
        audit.push((
            Some(actor.id),
            actor.name.into(),
            actor.role,
            v.action,
            Some(v.patient_id),
            Some(CLINIC_NAME),
            details,
            days_ago(v.days_ago, "14:30"),
        ));
    }
    for c in &all.corrections {
        let ev = all.events.iter().find(|e| e.id == c.dose_event_id).expect("corrected event");
        let actor = user(&c.corrected_by_id);
        let patient_id = demo_data::PATIENTS.iter().find(|p| p.id == ev.patient_id).map(|p| p.id);
        audit.push((
            Some(actor.id),
            actor.name.into(),
            actor.role,
            "CORRECT_LOG",
            patient_id,
            None,
            json!({
                "doseId": ev.id,
                "dose": format!("Evening {}", time::format_time(ev.scheduled_for)),
                "scheduledFor": time::iso(ev.scheduled_for),
                "from": "MISSED",
                "to": "TAKEN",
                "reason": c.reason,
            }),
            c.corrected_at,
        ));
    }
    let audit_count = audit.len() as i64;
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
        "INSERT INTO audit_log (id, actor_id, actor_name, actor_role, action, patient_id, clinic_name, details, sim_time, created_at) ",
    );
    // Seeded rows are historical: their recorded-at time is their (sim) time.
    qb.push_values(audit, |mut b, (actor_id, actor_name, role, action, patient_id, clinic, details, sim)| {
        b.push_bind(new_id("aud"))
            .push_bind(actor_id)
            .push_bind(actor_name)
            .push_bind(role)
            .push_bind(action)
            .push_bind(patient_id)
            .push_bind(clinic)
            .push_bind(details)
            .push_bind(sim)
            .push_bind(sim);
    });
    qb.build().execute(pool).await?;

    // Materialize today's/tomorrow's open doses and apply away mode.
    dose_engine::evaluate_all(pool, now).await?;

    let count = |sql: &'static str| async move { sqlx::query_scalar::<_, i64>(sql).fetch_one(pool).await };
    let mut counts = BTreeMap::new();
    counts.insert("users", USERS.len() as i64);
    counts.insert("patients", PATIENTS.len() as i64);
    counts.insert("doseEvents", count("SELECT count(*) FROM dose_events").await?);
    counts.insert("alerts", count("SELECT count(*) FROM alerts").await?);
    counts.insert("sms", count("SELECT count(*) FROM sms_messages").await?);
    counts.insert("attempts", all.attempts.len() as i64);
    counts.insert("auditEntries", audit_count);
    Ok(ResetSummary { ok: true, now: time::iso(now), counts })
}
