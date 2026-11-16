//! Away mode (task M11): no reminders or missed-dose alerts for whole Manila
//! days; those doses are excluded from adherence. Resumes automatically.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState, away_select,
    auth::{FamilyUser, require_family_patient},
    error::{ApiError, ApiResult},
    extract::ApiJson,
    models::AwayPeriod,
    new_id,
    routes::ok,
    services::{clock, convert, dose_engine},
    time, validate,
};

pub const AWAY_REASONS: &[&str] = &["Travel", "Hospital stay", "Staying with family", "Other"];

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/away", get(list).post(create))
        .route("/away/{away_id}", delete(cancel))
}

async fn list(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    let rows = sqlx::query_as::<_, AwayPeriod>(concat!(away_select!(), " WHERE a.patient_id = $1 ORDER BY a.starts_at DESC"))
        .bind(&patient_id)
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({ "periods": rows.iter().map(|p| convert::away_dto(p, now)).collect::<Vec<_>>() })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateBody {
    start_date: String,
    end_date: String,
    reason: String,
    note: Option<String>,
}

async fn create(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<CreateBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_family_patient(&st, &user, &patient_id).await?;
    let start = validate::date_key(&b.start_date, "startDate")?;
    let end = validate::date_key(&b.end_date, "endDate")?;
    if end < start {
        return Err(ApiError::validation("endDate", "End date must be on or after the start date"));
    }
    if !AWAY_REASONS.contains(&b.reason.as_str()) {
        return Err(ApiError::validation("reason", "Choose a reason from the list"));
    }
    let note = validate::opt_text(b.note.as_deref(), "note", 200)?;
    let now = clock::now(&st.pool).await?;
    let today = time::date_of(now);
    if end < today {
        return Err(ApiError::validation("endDate", "Away mode can't be set entirely in the past."));
    }
    if start > time::add_days(today, 365) {
        return Err(ApiError::validation("startDate", "Pick dates within the next year."));
    }
    let starts_at = time::start_of_day(start);
    let ends_at = time::start_of_day(time::add_days(end, 1));
    let overlap: Option<(String, String)> = sqlx::query_as(
        "SELECT start_date, end_date FROM away_periods
         WHERE patient_id = $1 AND cancelled_at IS NULL AND starts_at < $3 AND ends_at > $2 LIMIT 1",
    )
    .bind(&patient_id)
    .bind(starts_at)
    .bind(ends_at)
    .fetch_optional(&st.pool)
    .await?;
    if let Some((s, e)) = overlap {
        return Err(ApiError::conflict(format!("These dates overlap an existing away period ({s} → {e}).")));
    }
    let id = new_id("away");
    sqlx::query(
        "INSERT INTO away_periods (id, patient_id, start_date, end_date, starts_at, ends_at, reason, note, created_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(&id)
    .bind(&patient_id)
    .bind(time::key(start))
    .bind(time::key(end))
    .bind(starts_at)
    .bind(ends_at)
    .bind(&b.reason)
    .bind(note)
    .bind(&user.id)
    .execute(&st.pool)
    .await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    let p = sqlx::query_as::<_, AwayPeriod>(concat!(away_select!(), " WHERE a.id = $1"))
        .bind(&id)
        .fetch_one(&st.pool)
        .await?;
    Ok((StatusCode::CREATED, Json(json!({ "period": convert::away_dto(&p, now) }))))
}

/// Cancel away mode; reminders resume immediately.
async fn cancel(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(away_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let row: Option<(String, Option<chrono::DateTime<chrono::Utc>>)> =
        sqlx::query_as("SELECT patient_id, cancelled_at FROM away_periods WHERE id = $1")
            .bind(&away_id)
            .fetch_optional(&st.pool)
            .await?;
    let (patient_id, cancelled) = row.ok_or_else(|| ApiError::not_found("Away period not found."))?;
    require_family_patient(&st, &user, &patient_id).await?;
    if cancelled.is_some() {
        return Err(ApiError::conflict("This away period was already cancelled."));
    }
    let now = clock::now(&st.pool).await?;
    sqlx::query("UPDATE away_periods SET cancelled_at = $2 WHERE id = $1")
        .bind(&away_id)
        .bind(now)
        .execute(&st.pool)
        .await?;
    dose_engine::revert_away_doses(&st.pool, &patient_id, now).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    Ok(ok())
}
