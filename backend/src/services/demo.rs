//! Demo time-skip controls (tasks B12, S8). Time only moves forward.

use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    error::{ApiError, ApiResult},
    models::{DoseEventFull, Patient},
    dose_select,
    services::{clock, dose_engine},
    time::{format_date_time, format_time},
};

#[derive(Deserialize, Debug)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum ClockAction {
    /// Move forward N minutes.
    Advance { minutes: i64 },
    /// Jump to the next dose time (reminder moment) of the bear's patient.
    #[serde(rename_all = "camelCase")]
    NextDose { device_id: Option<String> },
    /// Jump 1 minute past the late period of the current/next open dose → MISSED.
    #[serde(rename_all = "camelCase")]
    PastWindow { device_id: Option<String> },
}

async fn patient_for_device(pool: &PgPool, device_id: Option<&str>) -> ApiResult<Patient> {
    let id = device_id.unwrap_or("BEAR-0001");
    sqlx::query_as::<_, Patient>(
        "SELECT p.* FROM patients p JOIN bear_devices d ON d.patient_id = p.id WHERE d.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::bad_request(format!("Unknown bear {id}.")))
}

pub async fn apply(pool: &PgPool, action: ClockAction) -> ApiResult<(DateTime<Utc>, String)> {
    match action {
        ClockAction::Advance { minutes } => {
            if !(1..=7 * 24 * 60).contains(&minutes) {
                return Err(ApiError::validation("minutes", "Move forward between 1 minute and 7 days."));
            }
            let now = clock::advance(pool, minutes).await?;
            dose_engine::evaluate_all(pool, now).await?;
            let amount = if minutes >= 60 && minutes % 60 == 0 { format!("{} h", minutes / 60) } else { format!("{minutes} min") };
            Ok((now, format!("Moved forward {amount} → {}", format_date_time(now))))
        }
        ClockAction::NextDose { device_id } => {
            let patient = patient_for_device(pool, device_id.as_deref()).await?;
            let current = clock::now(pool).await?;
            dose_engine::evaluate_patient(pool, &patient.id, current).await?;
            let next = sqlx::query_as::<_, DoseEventFull>(concat!(
                dose_select!(),
                " WHERE e.patient_id = $1 AND e.status = 'UPCOMING' AND e.scheduled_for > $2
                  ORDER BY e.scheduled_for LIMIT 1"
            ))
            .bind(&patient.id)
            .bind(current)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::bad_request(format!("{} has no upcoming dose to jump to.", patient.nickname)))?;
            let now = clock::set_now(pool, next.event.scheduled_for, false).await?;
            dose_engine::evaluate_all(pool, now).await?;
            Ok((
                now,
                format!("Jumped to {}'s {} dose ({}).", patient.nickname, format_time(next.event.scheduled_for), next.label),
            ))
        }
        ClockAction::PastWindow { device_id } => {
            let patient = patient_for_device(pool, device_id.as_deref()).await?;
            let current = clock::now(pool).await?;
            dose_engine::evaluate_patient(pool, &patient.id, current).await?;
            let candidates = sqlx::query_as::<_, DoseEventFull>(concat!(
                dose_select!(),
                " WHERE e.patient_id = $1 AND e.status IN ('UPCOMING', 'REMINDED') AND e.scheduled_for > $2
                  ORDER BY e.scheduled_for"
            ))
            .bind(&patient.id)
            .bind(current - Duration::hours(6))
            .fetch_all(pool)
            .await?;
            let target = candidates
                .into_iter()
                .find(|c| c.event.windows().late_end >= current)
                .ok_or_else(|| ApiError::bad_request(format!("{} has no open dose to skip past.", patient.nickname)))?;
            let w = target.event.windows();
            let now = clock::set_now(pool, w.late_end + Duration::minutes(1), false).await?;
            dose_engine::evaluate_all(pool, now).await?;
            Ok((
                now,
                format!(
                    "Jumped past the {} dose window (closed {}). Unlogged doses are now missed.",
                    format_time(w.scheduled_for),
                    format_time(w.late_end)
                ),
            ))
        }
    }
}
