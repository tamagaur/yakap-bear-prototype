//! /api/patients/:id/schedules and /api/schedules/:id — dose times & windows (M3).

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{FamilyUser, require_family_patient},
    error::{ApiError, ApiResult},
    extract::ApiJson,
    models::{DoseSchedule, ScheduleWithVoice},
    new_id,
    routes::{double_option, ok},
    schedule_select,
    services::{clock, convert, dose_engine},
    validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/schedules", get(list).post(create))
        .route("/schedules/{schedule_id}", patch(update).delete(remove))
}

async fn load_dto(st: &AppState, id: &str) -> ApiResult<Value> {
    let s = sqlx::query_as::<_, ScheduleWithVoice>(concat!(schedule_select!(), " WHERE s.id = $1"))
        .bind(id)
        .fetch_one(&st.pool)
        .await?;
    Ok(json!(convert::schedule_dto(&s)))
}

async fn list(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let rows = sqlx::query_as::<_, ScheduleWithVoice>(concat!(
        schedule_select!(),
        " WHERE s.patient_id = $1 AND s.active AND s.deleted_at IS NULL ORDER BY s.time_of_day"
    ))
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({ "schedules": rows.iter().map(convert::schedule_dto).collect::<Vec<_>>() })))
}

async fn check_voice(st: &AppState, patient_id: &str, voice_id: &str) -> ApiResult<()> {
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM voice_messages WHERE id = $1 AND patient_id = $2")
        .bind(voice_id)
        .bind(patient_id)
        .fetch_one(&st.pool)
        .await?;
    if n == 0 {
        return Err(ApiError::validation("voiceMessageId", "That voice message doesn't belong to this patient."));
    }
    Ok(())
}

async fn check_clash(st: &AppState, patient_id: &str, time_of_day: &str, except: Option<&str>) -> ApiResult<()> {
    let clash: Option<String> = sqlx::query_scalar(
        "SELECT label FROM dose_schedules
         WHERE patient_id = $1 AND active AND deleted_at IS NULL AND time_of_day = $2 AND ($3::text IS NULL OR id <> $3)",
    )
    .bind(patient_id)
    .bind(time_of_day)
    .bind(except)
    .fetch_optional(&st.pool)
    .await?;
    if let Some(label) = clash {
        return Err(ApiError::conflict(format!("There is already a dose at {time_of_day} (\"{label}\").")));
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateBody {
    label: String,
    time_of_day: String,
    window_minutes: Option<i32>,
    late_minutes: Option<i32>,
    pill_note: Option<String>,
    voice_message_id: Option<String>,
}

async fn create(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<CreateBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_family_patient(&st, &user, &patient_id).await?;
    let label = validate::text(&b.label, "label", 1, 40, "Give this dose a name")?;
    let time_of_day = validate::time_of_day(&b.time_of_day)?;
    let window = validate::int_range(b.window_minutes.unwrap_or(30), "windowMinutes", 5, 120)?;
    let late = validate::int_range(b.late_minutes.unwrap_or(60), "lateMinutes", 0, 240)?;
    let pill_note = validate::opt_text(b.pill_note.as_deref(), "pillNote", 60)?;
    check_clash(&st, &patient_id, &time_of_day, None).await?;
    if let Some(v) = &b.voice_message_id {
        check_voice(&st, &patient_id, v).await?;
    }
    let now = clock::now(&st.pool).await?;
    let id = new_id("sch");
    sqlx::query(
        "INSERT INTO dose_schedules (id, patient_id, label, time_of_day, window_minutes, late_minutes, pill_note, voice_message_id, effective_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(&id)
    .bind(&patient_id)
    .bind(label)
    .bind(time_of_day)
    .bind(window)
    .bind(late)
    .bind(pill_note)
    .bind(&b.voice_message_id)
    .bind(now)
    .execute(&st.pool)
    .await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    Ok((StatusCode::CREATED, Json(json!({ "schedule": load_dto(&st, &id).await? }))))
}

async fn load_schedule(st: &AppState, user: &crate::models::User, id: &str) -> ApiResult<DoseSchedule> {
    let s = sqlx::query_as::<_, DoseSchedule>("SELECT * FROM dose_schedules WHERE id = $1 AND deleted_at IS NULL")
        .bind(id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Schedule not found."))?;
    require_family_patient(st, user, &s.patient_id).await?;
    Ok(s)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateBody {
    label: Option<String>,
    time_of_day: Option<String>,
    window_minutes: Option<i32>,
    late_minutes: Option<i32>,
    #[serde(default, deserialize_with = "double_option")]
    pill_note: Option<Option<String>>,
    #[serde(default, deserialize_with = "double_option")]
    voice_message_id: Option<Option<String>>,
}

/// Editing timing regenerates future doses whose window hasn't opened.
async fn update(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(schedule_id): Path<String>,
    ApiJson(b): ApiJson<UpdateBody>,
) -> ApiResult<Json<Value>> {
    let mut s = load_schedule(&st, &user, &schedule_id).await?;
    let before = (s.time_of_day.clone(), s.window_minutes, s.late_minutes);
    if let Some(v) = &b.label {
        s.label = validate::text(v, "label", 1, 40, "Give this dose a name")?;
    }
    if let Some(v) = &b.time_of_day {
        s.time_of_day = validate::time_of_day(v)?;
        if s.time_of_day != before.0 {
            check_clash(&st, &s.patient_id, &s.time_of_day, Some(&s.id)).await?;
        }
    }
    if let Some(v) = b.window_minutes {
        s.window_minutes = validate::int_range(v, "windowMinutes", 5, 120)?;
    }
    if let Some(v) = b.late_minutes {
        s.late_minutes = validate::int_range(v, "lateMinutes", 0, 240)?;
    }
    if let Some(v) = &b.pill_note {
        s.pill_note = validate::opt_text(v.as_deref(), "pillNote", 60)?;
    }
    if let Some(v) = &b.voice_message_id {
        if let Some(id) = v {
            check_voice(&st, &s.patient_id, id).await?;
        }
        s.voice_message_id = v.clone();
    }
    let now = clock::now(&st.pool).await?;
    let timing_changed = before != (s.time_of_day.clone(), s.window_minutes, s.late_minutes);
    if timing_changed {
        s.effective_from = now;
    }
    sqlx::query(
        "UPDATE dose_schedules SET label = $2, time_of_day = $3, window_minutes = $4, late_minutes = $5,
                pill_note = $6, voice_message_id = $7, effective_from = $8, updated_at = now()
         WHERE id = $1",
    )
    .bind(&s.id)
    .bind(&s.label)
    .bind(&s.time_of_day)
    .bind(s.window_minutes)
    .bind(s.late_minutes)
    .bind(&s.pill_note)
    .bind(&s.voice_message_id)
    .bind(s.effective_from)
    .execute(&st.pool)
    .await?;
    if timing_changed {
        dose_engine::prune_future_doses(&st.pool, &s.id, now).await?;
        dose_engine::evaluate_patient(&st.pool, &s.patient_id, now).await?;
    }
    Ok(Json(json!({ "schedule": load_dto(&st, &s.id).await? })))
}

/// Soft delete — logged history stays; open doses for this time are removed.
async fn remove(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(schedule_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let s = load_schedule(&st, &user, &schedule_id).await?;
    let now = clock::now(&st.pool).await?;
    sqlx::query("UPDATE dose_schedules SET active = FALSE, deleted_at = $2, updated_at = now() WHERE id = $1")
        .bind(&s.id)
        .bind(now)
        .execute(&st.pool)
        .await?;
    dose_engine::prune_future_doses(&st.pool, &s.id, now).await?;
    dose_engine::remove_open_doses(&st.pool, &s.id, now).await?;
    dose_engine::evaluate_patient(&st.pool, &s.patient_id, now).await?;
    Ok(ok())
}
