//! Bear device API (tasks S1–S8, B6, B10). Authenticated with x-bear-key.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::require_bear_device,
    dose_rules::LOW_BATTERY_PCT,
    dto::{BearStateDto, HeartbeatResultDto, HoldResultDto, ReminderResultDto},
    error::{ApiError, ApiResult},
    extract::ApiJson,
    services::{
        alerts, bear, clock, dose_engine,
        hold_filter::{self, HoldInput},
        sync::{self, SyncEvent},
    },
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/bear/{device_id}/state", get(state))
        .route("/bear/{device_id}/hold", post(hold))
        .route("/bear/{device_id}/reminder", post(reminder))
        .route("/bear/{device_id}/heartbeat", post(heartbeat))
        .route("/bear/{device_id}/sync", post(sync_events))
}

async fn state(State(st): State<AppState>, headers: HeaderMap, Path(device_id): Path<String>) -> ApiResult<Json<BearStateDto>> {
    let (device, patient) = require_bear_device(&st, &headers, &device_id).await?;
    let now = clock::now(&st.pool).await?;
    Ok(Json(bear::get_state(&st.pool, &device, &patient, now).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HoldBody {
    client_event_id: String,
    hold_ms: i64,
}

fn check_event_id(id: &str) -> ApiResult<()> {
    if !(8..=64).contains(&id.len()) {
        return Err(ApiError::validation("clientEventId", "clientEventId must be 8–64 characters"));
    }
    Ok(())
}

fn check_hold_ms(ms: i64) -> ApiResult<()> {
    if !(0..=120_000).contains(&ms) {
        return Err(ApiError::validation("holdMs", "holdMs must be between 0 and 120000"));
    }
    Ok(())
}

/// A live paw hold: the server clock decides when it happened; the
/// accidental-squeeze filter decides whether it counts.
async fn hold(
    State(st): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
    ApiJson(b): ApiJson<HoldBody>,
) -> ApiResult<Json<HoldResultDto>> {
    check_event_id(&b.client_event_id)?;
    check_hold_ms(b.hold_ms)?;
    let (device, patient) = require_bear_device(&st, &headers, &device_id).await?;
    let now = clock::now(&st.pool).await?;
    dose_engine::evaluate_patient(&st.pool, &patient.id, now).await?;
    let result = hold_filter::process_hold(
        &st.pool,
        HoldInput {
            patient_id: &patient.id,
            device_id: &device.id,
            client_event_id: &b.client_event_id,
            hold_ms: b.hold_ms,
            held_at: now,
            via_sync: false,
            now,
        },
    )
    .await?;
    sqlx::query("UPDATE bear_devices SET last_seen_at = now() WHERE id = $1")
        .bind(&device.id)
        .execute(&st.pool)
        .await?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReminderBody {
    dose_id: String,
}

/// The bear asks to play the reminder; `play` is true only when allowed.
async fn reminder(
    State(st): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
    ApiJson(b): ApiJson<ReminderBody>,
) -> ApiResult<Json<ReminderResultDto>> {
    let (device, _) = require_bear_device(&st, &headers, &device_id).await?;
    let now = clock::now(&st.pool).await?;
    Ok(Json(bear::claim_reminder(&st.pool, &device, &b.dose_id, now).await?))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeartbeatBody {
    battery_pct: i32,
}

/// Simulated battery level; ≤ 20 % alerts the family once.
async fn heartbeat(
    State(st): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
    ApiJson(b): ApiJson<HeartbeatBody>,
) -> ApiResult<Json<HeartbeatResultDto>> {
    if !(0..=100).contains(&b.battery_pct) {
        return Err(ApiError::validation("batteryPct", "batteryPct must be 0–100"));
    }
    let (device, patient) = require_bear_device(&st, &headers, &device_id).await?;
    let now = clock::now(&st.pool).await?;
    let created = alerts::apply_battery_level(&st.pool, &device, &patient.nickname, b.battery_pct, now).await?;
    Ok(Json(HeartbeatResultDto {
        ok: true,
        battery_pct: b.battery_pct,
        low_battery: b.battery_pct <= LOW_BATTERY_PCT,
        alert_created: created,
    }))
}

#[derive(Deserialize)]
struct SyncBody {
    events: Vec<SyncEvent>,
}

/// Upload holds queued while offline (idempotent per clientEventId).
async fn sync_events(
    State(st): State<AppState>,
    headers: HeaderMap,
    Path(device_id): Path<String>,
    ApiJson(b): ApiJson<SyncBody>,
) -> ApiResult<Json<Value>> {
    if b.events.is_empty() || b.events.len() > 100 {
        return Err(ApiError::validation("events", "Send between 1 and 100 events"));
    }
    for e in &b.events {
        check_event_id(&e.client_event_id)?;
        check_hold_ms(e.hold_ms)?;
    }
    let (device, patient) = require_bear_device(&st, &headers, &device_id).await?;
    let now = clock::now(&st.pool).await?;
    let results = sync::sync_device_events(&st.pool, &device.id, &patient.id, b.events, now).await?;
    sqlx::query("UPDATE bear_devices SET last_seen_at = now() WHERE id = $1")
        .bind(&device.id)
        .execute(&st.pool)
        .await?;
    Ok(Json(json!({ "results": results })))
}
