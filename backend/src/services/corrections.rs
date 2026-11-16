//! Family correction of a wrong log (task M10, audited per B11). The dose
//! event keeps its ORIGINAL status in `original_status`, every change is
//! stored in dose_corrections, and an audit entry is written.

use chrono::{DateTime, Duration, Utc};
use serde_json::json;
use sqlx::PgPool;

use crate::{
    dose_rules::DoseStatus,
    dose_select,
    error::{ApiError, ApiResult},
    models::{DoseEventFull, User},
    new_id,
    services::{
        alerts,
        audit::{self, AuditEntry},
    },
    time::{format_time, iso},
};

pub async fn correct_dose(
    pool: &PgPool,
    user: &User,
    dose_id: &str,
    to_status: DoseStatus,
    taken_at: Option<DateTime<Utc>>,
    reason: &str,
    now: DateTime<Utc>,
) -> ApiResult<()> {
    let row = sqlx::query_as::<_, DoseEventFull>(concat!(dose_select!(), " WHERE e.id = $1"))
        .bind(dose_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Dose not found."))?;
    let ev = &row.event;
    let member: i64 = sqlx::query_scalar("SELECT count(*) FROM patient_members WHERE user_id = $1 AND patient_id = $2")
        .bind(&user.id)
        .bind(&ev.patient_id)
        .fetch_one(pool)
        .await?;
    if member == 0 {
        return Err(ApiError::not_found("Dose not found."));
    }
    let current = ev.status();
    if !matches!(current, DoseStatus::Taken | DoseStatus::Late | DoseStatus::Missed) {
        return Err(ApiError::bad_request("Only doses that were logged as taken, late or missed can be corrected."));
    }
    if !matches!(to_status, DoseStatus::Taken | DoseStatus::Late | DoseStatus::Missed) {
        return Err(ApiError::validation("toStatus", "Choose taken, late or missed."));
    }
    let w = ev.windows();
    let new_taken_at = match to_status {
        DoseStatus::Taken => {
            let t = taken_at.unwrap_or(ev.scheduled_for);
            if t < w.window_start || t > w.on_time_end {
                return Err(ApiError::validation(
                    "takenAt",
                    format!(
                        "\"Taken on time\" must be between {} and {}.",
                        format_time(w.window_start),
                        format_time(w.on_time_end)
                    ),
                ));
            }
            Some(t)
        }
        DoseStatus::Late => {
            let t = taken_at.unwrap_or_else(|| (w.on_time_end + Duration::minutes(15)).min(now));
            if t <= w.on_time_end {
                return Err(ApiError::validation(
                    "takenAt",
                    format!("\"Taken late\" must be after {}.", format_time(w.on_time_end)),
                ));
            }
            Some(t)
        }
        _ => None,
    };
    if new_taken_at.is_some_and(|t| t > now) {
        return Err(ApiError::validation("takenAt", "The time taken can't be in the future."));
    }
    if to_status == current && new_taken_at == ev.taken_at {
        return Err(ApiError::bad_request("Nothing to change — pick a different status or time."));
    }

    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO dose_corrections (id, dose_event_id, from_status, to_status, from_taken_at, to_taken_at, reason, corrected_by_id, corrected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(new_id("cor"))
    .bind(&ev.id)
    .bind(current.as_str())
    .bind(to_status.as_str())
    .bind(ev.taken_at)
    .bind(new_taken_at)
    .bind(reason)
    .bind(&user.id)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    let missed = to_status == DoseStatus::Missed;
    sqlx::query(
        "UPDATE dose_events SET status = $2, taken_at = $3, logged_by = $4,
                hold_ms = CASE WHEN $5 THEN NULL ELSE hold_ms END,
                corrected = TRUE, original_status = COALESCE(original_status, $6), updated_at = now()
         WHERE id = $1",
    )
    .bind(&ev.id)
    .bind(to_status.as_str())
    .bind(new_taken_at)
    .bind(if missed { None } else { Some("FAMILY") })
    .bind(missed)
    .bind(current.as_str())
    .execute(&mut *tx)
    .await?;
    if !missed {
        alerts::resolve_dose_alert(&mut tx, &ev.id, &format!("Corrected by {}: {reason}", user.name), now).await?;
    }
    audit::record(
        &mut tx,
        AuditEntry {
            actor: Some(user),
            action: "CORRECT_LOG",
            patient_id: Some(&ev.patient_id),
            clinic_name: None,
            details: json!({
                "doseId": ev.id,
                "dose": format!("{} {}", row.label, format_time(ev.scheduled_for)),
                "scheduledFor": iso(ev.scheduled_for),
                "from": current.as_str(),
                "to": to_status.as_str(),
                "reason": reason,
            }),
            sim_time: now,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(())
}
