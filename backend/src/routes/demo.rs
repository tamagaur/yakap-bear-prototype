//! Demo tools (tasks B12, B13, S8, S9): shared clock, time skips, reset and
//! simulator pairing. Mutating endpoints require DEMO_MODE=true.

use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    dto::{
        ClockDto, DemoDeviceDto, DemoNextDoseDto, DemoOverviewDto, DemoPatientDto, DemoPeopleDto, DemoPersonDto,
        DemoReminderDto, DemoTextDto,
    },
    error::{ApiError, ApiResult},
    extract::{ApiJson, ApiQuery},
    models::{BearDevice, Patient},
    seed::{self, reset::ResetSummary},
    services::{
        bear, clock, convert,
        demo::{self, ClockAction},
        dose_engine,
    },
    time::iso,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/demo/clock", get(get_clock).post(post_clock))
        .route("/demo/reset", post(reset))
        .route("/demo/devices", get(devices))
        .route("/demo/overview", get(overview))
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OverviewQuery {
    device_id: Option<String>,
}

/// What the launcher shows at a glance: the demo bear, its next dose, open alerts,
/// the latest simulated text and who's who. Demo mode only; no keys, no audio.
async fn overview(State(st): State<AppState>, ApiQuery(q): ApiQuery<OverviewQuery>) -> ApiResult<Json<DemoOverviewDto>> {
    require_demo(&st)?;
    let device_id = q.device_id.unwrap_or_else(|| "BEAR-0001".to_string());
    let device = sqlx::query_as::<_, BearDevice>("SELECT * FROM bear_devices WHERE id = $1")
        .bind(&device_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("That bear isn't part of the demo."))?;
    let patient = sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(&device.patient_id)
        .fetch_one(&st.pool)
        .await?;
    let now = clock::now(&st.pool).await?;
    // Same lazy evaluation as the bear, so missed-dose alerts and texts are current.
    dose_engine::evaluate_patient(&st.pool, &patient.id, now).await?;

    // The dose that can still be logged, else the next one.
    let next: Option<(String, DateTime<Utc>, String, Option<String>, String, Option<String>, Option<bool>, Option<String>)> =
        sqlx::query_as(
            "SELECT e.id, e.scheduled_for, s.label, s.pill_note, e.status, v.title, v.is_sample, u.name
             FROM dose_events e
             JOIN dose_schedules s ON s.id = e.schedule_id
             LEFT JOIN voice_messages v ON v.id = s.voice_message_id
             LEFT JOIN users u ON u.id = v.recorded_by_id
             WHERE e.patient_id = $1 AND e.status IN ('UPCOMING', 'REMINDED')
               AND e.scheduled_for + make_interval(mins => e.window_minutes + e.late_minutes) >= $2
             ORDER BY e.scheduled_for LIMIT 1",
        )
        .bind(&patient.id)
        .bind(now)
        .fetch_optional(&st.pool)
        .await?;
    let assigned = next.as_ref().and_then(|n| {
        n.5.clone().map(|title| DemoReminderDto { title, recorded_by_name: n.7.clone(), is_sample: n.6.unwrap_or(false) })
    });
    let reminder = match assigned {
        Some(r) => Some(r),
        None => bear::fallback_voice(&st.pool, &patient.id)
            .await?
            .map(|v| DemoReminderDto { title: v.title, recorded_by_name: v.recorded_by_name, is_sample: v.is_sample }),
    };

    let open_alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM alerts WHERE patient_id = $1 AND acknowledged_at IS NULL AND resolved_at IS NULL",
    )
    .bind(&patient.id)
    .fetch_one(&st.pool)
    .await?;
    let latest_text: Option<(String, String, DateTime<Utc>, Vec<String>)> = sqlx::query_as(
        "SELECT s.body, s.to_name, s.sent_at,
                ARRAY(SELECT s2.to_name FROM sms_messages s2
                      WHERE s2.patient_id = s.patient_id AND s2.sent_at = s.sent_at
                        AND s2.alert_id IS NOT DISTINCT FROM s.alert_id
                      ORDER BY s2.to_name) AS recipients
         FROM sms_messages s WHERE s.patient_id = $1 ORDER BY s.sent_at DESC, s.created_at DESC LIMIT 1",
    )
    .bind(&patient.id)
    .fetch_optional(&st.pool)
    .await?;

    let family: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT u.name, m.relationship FROM patient_members m JOIN users u ON u.id = m.user_id
         WHERE m.patient_id = $1 ORDER BY m.created_at, u.name LIMIT 1",
    )
    .bind(&patient.id)
    .fetch_optional(&st.pool)
    .await?;
    let clinician: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT u.name, u.title, u.clinic_name FROM consents c JOIN users u ON u.id = c.clinician_id
         WHERE c.patient_id = $1 AND c.revoked_at IS NULL ORDER BY c.granted_at LIMIT 1",
    )
    .bind(&patient.id)
    .fetch_optional(&st.pool)
    .await?;
    let admin: Option<(String, Option<String>)> = match clinician.as_ref().and_then(|c| c.2.clone()) {
        Some(clinic) => {
            sqlx::query_as(
                "SELECT name, clinic_name FROM users WHERE role = 'CLINIC_ADMIN' AND clinic_name = $1
                 ORDER BY created_at, name LIMIT 1",
            )
            .bind(clinic)
            .fetch_optional(&st.pool)
            .await?
        }
        None => None,
    };

    Ok(Json(DemoOverviewDto {
        now: iso(now),
        patient: DemoPatientDto { id: patient.id.clone(), full_name: patient.full_name.clone(), nickname: patient.nickname.clone() },
        device: convert::device_dto(&device),
        next_dose: next.map(|n| DemoNextDoseDto { id: n.0, scheduled_for: iso(n.1), label: n.2, pill_note: n.3, status: n.4 }),
        open_alerts,
        latest_text: latest_text
            .map(|(body, to_name, at, recipients)| DemoTextDto { body, to_name, recipients, created_at: iso(at) }),
        reminder,
        people: DemoPeopleDto {
            family: family.map(|(name, relationship)| DemoPersonDto { name, relationship, title: None, clinic_name: None }),
            clinician: clinician
                .map(|(name, title, clinic_name)| DemoPersonDto { name, relationship: None, title, clinic_name }),
            admin: admin.map(|(name, clinic_name)| DemoPersonDto { name, relationship: None, title: None, clinic_name }),
        },
    }))
}
