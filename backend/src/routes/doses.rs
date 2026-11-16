//! Daily status, dose history and family corrections (tasks M6, M10).

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{FamilyUser, require_family_patient},
    dose_rules::DoseStatus,
    dose_select,
    dto::{DoseHistoryDto, TodayDto},
    error::{ApiError, ApiResult},
    extract::{ApiJson, ApiQuery},
    models::DoseEventFull,
    services::{clock, convert, corrections, dose_engine},
    time, validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/today", get(today))
        .route("/patients/{patient_id}/doses", get(history))
        .route("/doses/{dose_id}/correct", post(correct))
}

async fn today(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<TodayDto>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    let day = time::date_of(now);
    let rows = sqlx::query_as::<_, DoseEventFull>(concat!(
        dose_select!(),
        " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 ORDER BY e.scheduled_for"
    ))
    .bind(&patient_id)
    .bind(time::start_of_day(day))
    .bind(time::start_of_day(time::add_days(day, 1)))
    .fetch_all(&st.pool)
    .await?;
    let next = sqlx::query_as::<_, DoseEventFull>(concat!(
        dose_select!(),
        " WHERE e.patient_id = $1 AND e.scheduled_for > $2 AND e.status IN ('UPCOMING', 'REMINDED')
          ORDER BY e.scheduled_for LIMIT 1"
    ))
    .bind(&patient_id)
    .bind(now)
    .fetch_optional(&st.pool)
    .await?;
    let open_alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM alerts WHERE patient_id = $1 AND acknowledged_at IS NULL AND resolved_at IS NULL",
    )
    .bind(&patient_id)
    .fetch_one(&st.pool)
    .await?;
    Ok(Json(TodayDto {
        now: time::iso(now),
        date_key: time::key(day),
        doses: convert::dose_dtos(&st.pool, rows).await?,
        next_dose: match next {
            Some(n) => convert::dose_dtos(&st.pool, vec![n]).await?.pop(),
            None => None,
        },
        open_alerts,
        away_now: dose_engine::is_away_now(&st.pool, &patient_id, now).await?,
    }))
}

#[derive(Deserialize)]
struct HistoryQuery {
    from: Option<String>,
    to: Option<String>,
    status: Option<String>,
}

/// Parses "MISSED,LATE" into statuses.
pub(crate) fn parse_statuses(s: Option<&str>) -> ApiResult<Option<Vec<DoseStatus>>> {
    let Some(s) = s.filter(|s| !s.trim().is_empty()) else { return Ok(None) };
    s.split(',')
        .map(|p| DoseStatus::parse(p.trim()).ok_or_else(|| ApiError::validation("status", format!("Unknown status {p}"))))
        .collect::<ApiResult<Vec<_>>>()
        .map(Some)
}

async fn history(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiQuery(q): ApiQuery<HistoryQuery>,
) -> ApiResult<Json<DoseHistoryDto>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    let to = match &q.to {
        Some(t) => validate::date_key(t, "to")?,
        None => time::date_of(now),
    };
    let from = match &q.from {
        Some(f) => validate::date_key(f, "from")?,
        None => time::add_days(to, -29),
    };
    if from > to {
        return Err(ApiError::bad_request("`from` must be before `to`."));
    }
    let statuses: Vec<String> = parse_statuses(q.status.as_deref())?
        .unwrap_or_else(|| {
            vec![
                DoseStatus::Upcoming,
                DoseStatus::Reminded,
                DoseStatus::Taken,
                DoseStatus::Late,
                DoseStatus::Missed,
                DoseStatus::Away,
            ]
        })
        .iter()
        .map(|s| s.as_str().to_string())
        .collect();
    let rows = sqlx::query_as::<_, DoseEventFull>(concat!(
        dose_select!(),
        " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 AND e.status = ANY($4)
          ORDER BY e.scheduled_for DESC"
    ))
    .bind(&patient_id)
    .bind(time::start_of_day(from))
    .bind(time::start_of_day(time::add_days(to, 1)))
    .bind(&statuses)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(DoseHistoryDto {
        from: time::key(from),
        to: time::key(to),
        now: time::iso(now),
        doses: convert::dose_dtos(&st.pool, rows).await?,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CorrectBody {
    to_status: String,
    taken_at: Option<DateTime<Utc>>,
    reason: String,
}

/// Family fixes a wrong log — reason required; original kept; audited.
async fn correct(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(dose_id): Path<String>,
    ApiJson(b): ApiJson<CorrectBody>,
) -> ApiResult<Json<Value>> {
    let to = DoseStatus::parse(&b.to_status)
        .filter(|s| matches!(s, DoseStatus::Taken | DoseStatus::Late | DoseStatus::Missed))
        .ok_or_else(|| ApiError::validation("toStatus", "Choose taken, late or missed."))?;
    let reason = validate::text(&b.reason, "reason", 5, 300, "Please explain the correction (at least 5 characters)")?;
    let now = clock::now(&st.pool).await?;
    corrections::correct_dose(&st.pool, &user, &dose_id, to, b.taken_at, &reason, now).await?;
    let row = sqlx::query_as::<_, DoseEventFull>(concat!(dose_select!(), " WHERE e.id = $1"))
        .bind(&dose_id)
        .fetch_one(&st.pool)
        .await?;
    let dose = convert::dose_dtos(&st.pool, vec![row]).await?.pop();
    Ok(Json(json!({ "dose": dose })))
}
