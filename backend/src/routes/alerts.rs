//! Missed-dose / low-battery alerts and the simulated SMS inbox (M7, M8).

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde_json::{Value, json};

use crate::{
    AppState, alert_select,
    auth::{FamilyUser, require_family_patient},
    error::{ApiError, ApiResult},
    models::{Alert, SmsMessage},
    services::{clock, convert, dose_engine},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/alerts", get(list))
        .route("/alerts/{alert_id}/ack", post(ack))
        .route("/patients/{patient_id}/sms", get(sms))
}

async fn list(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, clock::now(&st.pool).await?).await?;
    let alerts = sqlx::query_as::<_, Alert>(concat!(
        alert_select!(),
        " WHERE a.patient_id = $1 ORDER BY a.created_at DESC LIMIT 100"
    ))
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    let unacknowledged: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM alerts WHERE patient_id = $1 AND acknowledged_at IS NULL AND resolved_at IS NULL",
    )
    .bind(&patient_id)
    .fetch_one(&st.pool)
    .await?;
    Ok(Json(json!({
        "alerts": alerts.iter().map(convert::alert_dto).collect::<Vec<_>>(),
        "unacknowledged": unacknowledged,
    })))
}

/// Idempotent acknowledge.
async fn ack(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(alert_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let patient_id: String = sqlx::query_scalar("SELECT patient_id FROM alerts WHERE id = $1")
        .bind(&alert_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Alert not found."))?;
    require_family_patient(&st, &user, &patient_id).await?;
    sqlx::query(
        "UPDATE alerts SET acknowledged_at = $2, acknowledged_by_id = $3 WHERE id = $1 AND acknowledged_at IS NULL",
    )
    .bind(&alert_id)
    .bind(clock::now(&st.pool).await?)
    .bind(&user.id)
    .execute(&st.pool)
    .await?;
    let alert = sqlx::query_as::<_, Alert>(concat!(alert_select!(), " WHERE a.id = $1"))
        .bind(&alert_id)
        .fetch_one(&st.pool)
        .await?;
    Ok(Json(json!({ "alert": convert::alert_dto(&alert) })))
}

/// Simulated SMS inbox, oldest → newest. Nothing is really sent.
async fn sms(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, clock::now(&st.pool).await?).await?;
    let mut rows = sqlx::query_as::<_, SmsMessage>(
        "SELECT id, patient_id, alert_id, to_name, to_phone, body, sent_at FROM sms_messages
         WHERE patient_id = $1 ORDER BY sent_at DESC, created_at DESC LIMIT 200",
    )
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    rows.reverse();
    Ok(Json(json!({ "messages": rows.iter().map(convert::sms_dto).collect::<Vec<_>>() })))
}
