//! Demo tools (tasks B12, B13, S8, S9): shared clock, time skips, reset and
//! simulator pairing. Mutating endpoints require DEMO_MODE=true.

use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use chrono::Utc;
use serde_json::{Value, json};

use crate::{
    AppState,
    dto::{ClockDto, DemoDeviceDto},
    error::{ApiError, ApiResult},
    extract::ApiJson,
    seed::{self, reset::ResetSummary},
    services::{
        clock,
        demo::{self, ClockAction},
    },
    time::iso,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/demo/clock", get(get_clock).post(post_clock))
        .route("/demo/reset", post(reset))
        .route("/demo/devices", get(devices))
}

fn require_demo(st: &AppState) -> ApiResult<()> {
    if !st.cfg.demo_mode {
        return Err(ApiError::forbidden("Demo controls are disabled (DEMO_MODE is not true)."));
    }
    Ok(())
}

async fn clock_dto(st: &AppState, message: Option<String>) -> ApiResult<ClockDto> {
    let offset = clock::offset_ms(&st.pool).await?;
    let real = Utc::now();
    Ok(ClockDto {
        now: iso(real + chrono::Duration::milliseconds(offset)),
        real_now: iso(real),
        offset_ms: offset,
        demo_mode: st.cfg.demo_mode,
        timezone: "Asia/Manila",
        message,
    })
}

/// The shared simulated time every view displays.
async fn get_clock(State(st): State<AppState>) -> ApiResult<Json<ClockDto>> {
    Ok(Json(clock_dto(&st, None).await?))
}

async fn post_clock(State(st): State<AppState>, ApiJson(action): ApiJson<ClockAction>) -> ApiResult<Json<ClockDto>> {
    require_demo(&st)?;
    let (_, message) = demo::apply(&st.pool, action).await?;
    Ok(Json(clock_dto(&st, Some(message)).await?))
}

/// Rebuild the fictional dataset; clock → 7:45 PM Manila today.
async fn reset(State(st): State<AppState>) -> ApiResult<Json<ResetSummary>> {
    require_demo(&st)?;
    Ok(Json(seed::reset_demo(&st.pool, &st.cfg, None).await?))
}

/// Demo-mode pairing for the simulator. A real bear would have its key set at
/// manufacturing; this endpoint is disabled when DEMO_MODE is off.
async fn devices(State(st): State<AppState>) -> ApiResult<Json<Value>> {
    require_demo(&st)?;
    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT d.id, d.device_key, p.nickname, p.full_name FROM bear_devices d
         JOIN patients p ON p.id = d.patient_id ORDER BY d.id",
    )
    .fetch_all(&st.pool)
    .await?;
    let devices: Vec<DemoDeviceDto> = rows
        .into_iter()
        .map(|(id, device_key, patient_nickname, patient_name)| DemoDeviceDto { id, device_key, patient_nickname, patient_name })
        .collect();
    Ok(Json(json!({ "devices": devices })))
}
