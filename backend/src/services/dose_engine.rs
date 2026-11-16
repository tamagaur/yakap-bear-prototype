//! Dose-event state logic (task B5). There is no background worker:
//! evaluation runs whenever the demo clock moves or a view/API that needs
//! fresh dose state loads. Every step is idempotent.

use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Postgres, QueryBuilder};

use crate::{
    dose_rules::{DoseStatus, TimeRange, compute_windows, is_within_away, should_mark_missed, slots_for_range},
    dose_select,
    models::{DoseEvent, DoseEventFull, DoseSchedule},
    new_id,
    services::alerts,
    time,
};

const LOOKBACK_DAYS: i64 = 7;

/// Creates missing dose events — one per schedule per day — from 7 days ago
/// through tomorrow. The UNIQUE(schedule_id, scheduled_for) constraint makes
/// duplicates impossible.
pub async fn materialize(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<u64> {
    let schedules = sqlx::query_as::<_, DoseSchedule>(
        "SELECT * FROM dose_schedules WHERE patient_id = $1 AND active AND deleted_at IS NULL",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    let today = time::date_of(now);
    let lookback = time::add_days(today, -LOOKBACK_DAYS);
    let to = time::add_days(today, 1);
    let mut rows: Vec<(String, DateTime<Utc>, i32, i32)> = Vec::new();
    for s in &schedules {
        let from = time::date_of(s.effective_from).max(lookback);
        for slot in slots_for_range(&s.time_of_day, s.window_minutes, s.late_minutes, s.effective_from, from, to) {
            rows.push((s.id.clone(), slot, s.window_minutes, s.late_minutes));
        }
    }
    if rows.is_empty() {
        return Ok(0);
    }
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new(
        "INSERT INTO dose_events (id, patient_id, schedule_id, scheduled_for, window_minutes, late_minutes) ",
    );
    qb.push_values(rows, |mut b, (schedule_id, slot, w, l)| {
        b.push_bind(new_id("ev"))
            .push_bind(patient_id.to_string())
            .push_bind(schedule_id)
            .push_bind(slot)
            .push_bind(w)
            .push_bind(l);
    });
    qb.push(" ON CONFLICT (schedule_id, scheduled_for) DO NOTHING");
    Ok(qb.build().execute(pool).await?.rows_affected())
}

async fn active_away_ranges(pool: &PgPool, patient_id: &str) -> sqlx::Result<Vec<TimeRange>> {
    let rows: Vec<(DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
        "SELECT starts_at, ends_at FROM away_periods WHERE patient_id = $1 AND cancelled_at IS NULL",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|(starts_at, ends_at)| TimeRange { starts_at, ends_at }).collect())
}

/// Open doses inside active away periods become AWAY (excused, no alerts).
async fn apply_away(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<()> {
    let periods = active_away_ranges(pool, patient_id).await?;
    let horizon_start = now - Duration::days(LOOKBACK_DAYS);
    let horizon_end = now + Duration::days(2);
    for p in periods.iter().filter(|p| p.ends_at > horizon_start && p.starts_at < horizon_end) {
        sqlx::query(
            "UPDATE dose_events SET status = 'AWAY', updated_at = now()
             WHERE patient_id = $1 AND status IN ('UPCOMING', 'REMINDED')
               AND scheduled_for >= $2 AND scheduled_for < $3",
        )
        .bind(patient_id)
        .bind(p.starts_at)
        .bind(p.ends_at)
        .execute(pool)
        .await?;
    }
    Ok(())
}

/// Open doses whose late period has passed become MISSED → alert + simulated SMS (once).
async fn mark_missed(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<u64> {
    let candidates = sqlx::query_as::<_, DoseEventFull>(concat!(
        dose_select!(),
        " WHERE e.patient_id = $1 AND e.status IN ('UPCOMING', 'REMINDED') AND e.scheduled_for < $2
          ORDER BY e.scheduled_for"
    ))
    .bind(patient_id)
    .bind(now)
    .fetch_all(pool)
    .await?;
    if candidates.is_empty() {
        return Ok(0);
    }
    let nickname: String = sqlx::query_scalar("SELECT nickname FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_one(pool)
        .await?;
    let mut missed = 0;
    for c in candidates {
        if !should_mark_missed(c.event.status(), &c.event.windows(), now) {
            continue;
        }
        let mut tx = pool.begin().await?;
        let changed = sqlx::query(
            "UPDATE dose_events SET status = 'MISSED', updated_at = now()
             WHERE id = $1 AND status IN ('UPCOMING', 'REMINDED')",
        )
        .bind(&c.event.id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if changed == 1 {
            alerts::create_missed_dose_alert(&mut tx, &c.event, &c.label, &nickname).await?;
            missed += 1;
        }
        tx.commit().await?;
    }
    Ok(missed)
}

pub async fn evaluate_patient(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<u64> {
    materialize(pool, patient_id, now).await?;
    apply_away(pool, patient_id, now).await?;
    mark_missed(pool, patient_id, now).await
}

pub async fn evaluate_all(pool: &PgPool, now: DateTime<Utc>) -> sqlx::Result<u64> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM patients").fetch_all(pool).await?;
    let mut missed = 0;
    for id in ids {
        missed += evaluate_patient(pool, &id, now).await?;
    }
    Ok(missed)
}

/// After an away period is cancelled, doses that can still be logged go back
/// to UPCOMING (unless another active period covers them). Past AWAY doses
/// stay excused.
pub async fn revert_away_doses(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<()> {
    let events = sqlx::query_as::<_, DoseEvent>(
        "SELECT * FROM dose_events WHERE patient_id = $1 AND status = 'AWAY' AND scheduled_for > $2",
    )
    .bind(patient_id)
    .bind(now - Duration::days(1))
    .fetch_all(pool)
    .await?;
    let periods = active_away_ranges(pool, patient_id).await?;
    for e in events {
        if e.windows().late_end <= now || is_within_away(e.scheduled_for, &periods) {
            continue;
        }
        sqlx::query("UPDATE dose_events SET status = 'UPCOMING', updated_at = now() WHERE id = $1")
            .bind(&e.id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

/// When a schedule changes or is removed, future doses whose window has not
/// opened are deleted (regenerated from the new settings). History is kept.
pub async fn prune_future_doses(pool: &PgPool, schedule_id: &str, now: DateTime<Utc>) -> sqlx::Result<u64> {
    let events = sqlx::query_as::<_, DoseEvent>(
        "SELECT * FROM dose_events WHERE schedule_id = $1
           AND status IN ('UPCOMING', 'REMINDED', 'AWAY') AND scheduled_for > $2",
    )
    .bind(schedule_id)
    .bind(now)
    .fetch_all(pool)
    .await?;
    let ids: Vec<String> = events
        .into_iter()
        .filter(|e| compute_windows(e.scheduled_for, e.window_minutes, e.late_minutes).window_start > now)
        .map(|e| e.id)
        .collect();
    if ids.is_empty() {
        return Ok(0);
    }
    Ok(sqlx::query("DELETE FROM dose_events WHERE id = ANY($1)")
        .bind(&ids)
        .execute(pool)
        .await?
        .rows_affected())
}

/// Removes still-open, not-yet-missed doses of a deleted schedule.
pub async fn remove_open_doses(pool: &PgPool, schedule_id: &str, now: DateTime<Utc>) -> sqlx::Result<()> {
    let events = sqlx::query_as::<_, DoseEvent>(
        "SELECT * FROM dose_events WHERE schedule_id = $1 AND status IN ('UPCOMING', 'REMINDED')",
    )
    .bind(schedule_id)
    .fetch_all(pool)
    .await?;
    let ids: Vec<String> = events
        .into_iter()
        .filter(|e| e.status() != DoseStatus::Missed && e.windows().late_end > now)
        .map(|e| e.id)
        .collect();
    if !ids.is_empty() {
        sqlx::query("DELETE FROM dose_events WHERE id = ANY($1)").bind(&ids).execute(pool).await?;
    }
    Ok(())
}

pub async fn is_away_now(pool: &PgPool, patient_id: &str, now: DateTime<Utc>) -> sqlx::Result<bool> {
    Ok(is_within_away(now, &active_away_ranges(pool, patient_id).await?))
}
