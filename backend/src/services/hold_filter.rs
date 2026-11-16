//! Accidental-squeeze filter — server rule (task B6). The pure decision is
//! `dose_rules::classify_hold`; this module applies it: accepted holds update
//! the ONE dose event for that dose time, everything else is stored as a
//! dose attempt. Idempotent per `client_event_id`.

use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;

use crate::{
    dose_rules::{AttemptReason, DoseStatus, HoldCandidate, HoldDecision, classify_hold},
    dto::HoldResultDto,
    error::{ApiResult, is_unique_violation},
    models::DoseEvent,
    new_id,
    services::alerts,
    time::{format_time, iso},
};

pub struct HoldInput<'a> {
    pub patient_id: &'a str,
    pub device_id: &'a str,
    pub client_event_id: &'a str,
    pub hold_ms: i64,
    pub held_at: DateTime<Utc>,
    pub via_sync: bool,
    pub now: DateTime<Utc>,
}

async fn previous_result(pool: &PgPool, input: &HoldInput<'_>) -> sqlx::Result<Option<HoldResultDto>> {
    if let Some(ev) = sqlx::query_as::<_, DoseEvent>("SELECT * FROM dose_events WHERE client_event_id = $1")
        .bind(input.client_event_id)
        .fetch_optional(pool)
        .await?
    {
        return Ok(Some(HoldResultDto {
            client_event_id: input.client_event_id.into(),
            accepted: true,
            duplicate: true,
            status: Some(ev.status.clone()),
            reason: None,
            dose_id: Some(ev.id.clone()),
            scheduled_for: Some(iso(ev.scheduled_for)),
            held_at: iso(ev.taken_at.unwrap_or(input.held_at)),
            hold_ms: input.hold_ms,
            resolved_missed: false,
        }));
    }
    let attempt: Option<(String, Option<String>, DateTime<Utc>)> =
        sqlx::query_as("SELECT reason, dose_event_id, held_at FROM dose_attempts WHERE client_event_id = $1")
            .bind(input.client_event_id)
            .fetch_optional(pool)
            .await?;
    Ok(attempt.map(|(reason, dose_id, held_at)| HoldResultDto {
        client_event_id: input.client_event_id.into(),
        accepted: false,
        duplicate: true,
        status: None,
        reason: Some(reason),
        dose_id,
        scheduled_for: None,
        held_at: iso(held_at),
        hold_ms: input.hold_ms,
        resolved_missed: false,
    }))
}

pub async fn process_hold(pool: &PgPool, input: HoldInput<'_>) -> ApiResult<HoldResultDto> {
    // One retry covers a concurrent request with the same client_event_id.
    for attempt in 0..2 {
        match process_once(pool, &input).await {
            Err(e) if attempt == 0 && is_unique_violation(&e) => continue,
            other => return Ok(other?),
        }
    }
    Ok(previous_result(pool, &input).await?.expect("duplicate result exists"))
}

async fn process_once(pool: &PgPool, input: &HoldInput<'_>) -> sqlx::Result<HoldResultDto> {
    if let Some(prev) = previous_result(pool, input).await? {
        return Ok(prev);
    }
    let held_at = input.held_at;
    let events = sqlx::query_as::<_, DoseEvent>(
        "SELECT * FROM dose_events WHERE patient_id = $1 AND scheduled_for BETWEEN $2 AND $3",
    )
    .bind(input.patient_id)
    .bind(held_at - Duration::hours(6))
    .bind(held_at + Duration::hours(6))
    .fetch_all(pool)
    .await?;
    let away: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM away_periods
         WHERE patient_id = $1 AND cancelled_at IS NULL AND starts_at <= $2 AND ends_at > $2",
    )
    .bind(input.patient_id)
    .bind(held_at)
    .fetch_one(pool)
    .await?;
    let candidates: Vec<HoldCandidate> = events
        .iter()
        .map(|e| HoldCandidate { id: e.id.clone(), status: e.status(), windows: e.windows() })
        .collect();
    let decision = classify_hold(input.hold_ms, held_at, away > 0, &candidates);
    let hold_ms_db = input.hold_ms.clamp(0, i32::MAX as i64) as i32;

    let (reason, dose_id) = match decision {
        HoldDecision::Accepted { dose_id, status, resolves_missed } => {
            let mut tx = pool.begin().await?;
            let changed = sqlx::query(
                "UPDATE dose_events SET status = $2, taken_at = $3, hold_ms = $4, logged_by = $5,
                        client_event_id = $6, updated_at = now()
                 WHERE id = $1 AND status IN ('UPCOMING', 'REMINDED', 'MISSED')",
            )
            .bind(&dose_id)
            .bind(status.as_str())
            .bind(held_at)
            .bind(hold_ms_db)
            .bind(if input.via_sync { "OFFLINE_SYNC" } else { "BEAR" })
            .bind(input.client_event_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
            if changed == 1 {
                if resolves_missed {
                    let how = if status == DoseStatus::Taken { "taken on time" } else { "taken late" };
                    let msg = format!(
                        "Resolved — the bear synced a paw hold made at {} after reconnecting ({how}).",
                        format_time(held_at)
                    );
                    alerts::resolve_dose_alert(&mut tx, &dose_id, &msg, input.now).await?;
                }
                tx.commit().await?;
                let ev = events.iter().find(|e| e.id == dose_id);
                return Ok(HoldResultDto {
                    client_event_id: input.client_event_id.into(),
                    accepted: true,
                    duplicate: false,
                    status: Some(status.as_str().into()),
                    reason: None,
                    dose_id: Some(dose_id.clone()),
                    scheduled_for: ev.map(|e| iso(e.scheduled_for)),
                    held_at: iso(held_at),
                    hold_ms: input.hold_ms,
                    resolved_missed: resolves_missed,
                });
            }
            tx.rollback().await?;
            // Lost a race with another hold for the same dose.
            (AttemptReason::AlreadyLogged, Some(dose_id))
        }
        HoldDecision::Rejected { reason, dose_id } => (reason, dose_id),
    };

    sqlx::query(
        "INSERT INTO dose_attempts (id, patient_id, device_id, dose_event_id, held_at, hold_ms, reason, client_event_id, via_sync)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(new_id("att"))
    .bind(input.patient_id)
    .bind(input.device_id)
    .bind(&dose_id)
    .bind(held_at)
    .bind(hold_ms_db)
    .bind(reason.as_str())
    .bind(input.client_event_id)
    .bind(input.via_sync)
    .execute(pool)
    .await?;
    let ev = dose_id.as_ref().and_then(|id| events.iter().find(|e| &e.id == id));
    Ok(HoldResultDto {
        client_event_id: input.client_event_id.into(),
        accepted: false,
        duplicate: false,
        status: ev.map(|e| e.status.clone()),
        reason: Some(reason.as_str().into()),
        dose_id,
        scheduled_for: ev.map(|e| iso(e.scheduled_for)),
        held_at: iso(held_at),
        hold_ms: input.hold_ms,
        resolved_missed: false,
    })
}
