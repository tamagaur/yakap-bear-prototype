//! Family voice messages (tasks B9, M4, M5). Audio bytes live in Postgres with
//! their original MIME type. Never public: family session or the patient's bear.

use axum::{
    Json, Router,
    body::Body,
    extract::{Multipart, Path, State, multipart::MultipartRejection},
    http::{HeaderMap, StatusCode, header},
    response::Response,
    routing::{get, patch},
};
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{self, Area, BEAR_DEVICE_HEADER, BEAR_KEY_HEADER, FamilyUser, require_family_patient},
    error::{ApiError, ApiResult},
    models::{BearDevice, Role, User, VoiceMeta},
    new_id,
    routes::ok,
    services::convert,
    voice_select,
};

pub const VOICE_MAX_BYTES: usize = 2 * 1024 * 1024;
const MIME_TYPES: &[&str] = &[
    "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac", "audio/x-m4a",
];

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/voice", get(list).post(upload))
        .route("/voice/{voice_id}", patch(update).delete(remove))
        .route("/voice/{voice_id}/audio", get(audio))
}

struct VoiceForm {
    file: Option<(Vec<u8>, String)>,
    title: Option<String>,
    duration_sec: Option<f64>,
    schedule_id: Option<String>,
}

fn mp_err(e: impl std::fmt::Display) -> ApiError {
    ApiError::bad_request(format!("Could not read the upload: {e}"))
}

async fn parse_form(mp: Result<Multipart, MultipartRejection>) -> ApiResult<VoiceForm> {
    let mut mp = mp.map_err(|e| ApiError::bad_request(format!("Send the recording as multipart/form-data ({e}).")))?;
    let mut form = VoiceForm { file: None, title: None, duration_sec: None, schedule_id: None };
    while let Some(field) = mp.next_field().await.map_err(mp_err)? {
        match field.name().unwrap_or_default() {
            "file" => {
                let mime = field.content_type().unwrap_or("").split(';').next().unwrap_or("").trim().to_lowercase();
                let bytes = field.bytes().await.map_err(mp_err)?;
                if bytes.is_empty() {
                    return Err(ApiError::validation("file", "The recording is empty. Please record again."));
                }
                if bytes.len() > VOICE_MAX_BYTES {
                    return Err(ApiError::validation("file", "Recording is too large (max 2 MB, about 30 seconds)."));
                }
                if !MIME_TYPES.contains(&mime.as_str()) {
                    return Err(ApiError::validation("file", format!("Unsupported audio format \"{mime}\".")));
                }
                form.file = Some((bytes.to_vec(), mime));
            }
            "title" => {
                let t = field.text().await.map_err(mp_err)?.trim().to_string();
                if !t.is_empty() {
                    if t.chars().count() > 60 {
                        return Err(ApiError::validation("title", "Keep the title under 60 characters"));
                    }
                    form.title = Some(t);
                }
            }
            "durationSec" => {
                let t = field.text().await.map_err(mp_err)?;
                form.duration_sec = t.trim().parse::<f64>().ok().filter(|d| d.is_finite() && *d >= 0.0 && *d <= 35.0);
            }
            "scheduleId" => {
                let t = field.text().await.map_err(mp_err)?.trim().to_string();
                if !t.is_empty() {
                    form.schedule_id = Some(t);
                }
            }
            _ => {}
        }
    }
    Ok(form)
}

async fn voice_dto(st: &AppState, id: &str) -> ApiResult<Value> {
    let v = sqlx::query_as::<_, VoiceMeta>(concat!(voice_select!(), " WHERE v.id = $1"))
        .bind(id)
        .fetch_one(&st.pool)
        .await?;
    let assigned: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, label, time_of_day FROM dose_schedules WHERE voice_message_id = $1 AND deleted_at IS NULL ORDER BY time_of_day",
    )
    .bind(id)
    .fetch_all(&st.pool)
    .await?;
    let assigned = assigned
        .into_iter()
        .map(|(schedule_id, label, time_of_day)| crate::dto::AssignedToDto { schedule_id, label, time_of_day })
        .collect();
    Ok(json!(convert::voice_dto(&v, assigned)))
}

async fn check_schedule(st: &AppState, patient_id: &str, schedule_id: &str) -> ApiResult<()> {
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM dose_schedules WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL",
    )
    .bind(schedule_id)
    .bind(patient_id)
    .fetch_one(&st.pool)
    .await?;
    if n == 0 {
        return Err(ApiError::validation("scheduleId", "That dose time doesn't belong to this patient."));
    }
    Ok(())
}

async fn list(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM voice_messages WHERE patient_id = $1 ORDER BY is_sample ASC, updated_at DESC",
    )
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    let mut voices = Vec::new();
    for id in ids {
        voices.push(voice_dto(&st, &id).await?);
    }
    Ok(Json(json!({ "voices": voices })))
}

async fn upload(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    mp: Result<Multipart, MultipartRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_family_patient(&st, &user, &patient_id).await?;
    let form = parse_form(mp).await?;
    let (bytes, mime) = form.file.ok_or_else(|| ApiError::validation("file", "Attach a recording."))?;
    let title = form.title.ok_or_else(|| ApiError::validation("title", "Give the message a title"))?;
    if let Some(s) = &form.schedule_id {
        check_schedule(&st, &patient_id, s).await?;
    }
    let id = new_id("voice");
    sqlx::query(
        "INSERT INTO voice_messages (id, patient_id, title, mime_type, duration_sec, size_bytes, data, recorded_by_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(&id)
    .bind(&patient_id)
    .bind(&title)
    .bind(&mime)
    .bind(form.duration_sec)
    .bind(bytes.len() as i32)
    .bind(&bytes)
    .bind(&user.id)
    .execute(&st.pool)
    .await?;
    if let Some(s) = &form.schedule_id {
        sqlx::query("UPDATE dose_schedules SET voice_message_id = $2, updated_at = now() WHERE id = $1")
            .bind(s)
            .bind(&id)
            .execute(&st.pool)
            .await?;
    }
    Ok((StatusCode::CREATED, Json(json!({ "voice": voice_dto(&st, &id).await? }))))
}

async fn owned_voice(st: &AppState, user: &User, voice_id: &str) -> ApiResult<String> {
    let patient_id: String = sqlx::query_scalar("SELECT patient_id FROM voice_messages WHERE id = $1")
        .bind(voice_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Voice message not found."))?;
    require_family_patient(st, user, &patient_id).await?;
    Ok(patient_id)
}

/// Replace the recording (file), rename (title) and/or assign to a dose time (scheduleId).
async fn update(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(voice_id): Path<String>,
    mp: Result<Multipart, MultipartRejection>,
) -> ApiResult<Json<Value>> {
    let patient_id = owned_voice(&st, &user, &voice_id).await?;
    let form = parse_form(mp).await?;
    if form.file.is_none() && form.title.is_none() && form.schedule_id.is_none() {
        return Err(ApiError::bad_request("Nothing to update."));
    }
    if let Some(s) = &form.schedule_id {
        check_schedule(&st, &patient_id, s).await?;
    }
    if let Some(t) = &form.title {
        sqlx::query("UPDATE voice_messages SET title = $2, updated_at = now() WHERE id = $1")
            .bind(&voice_id)
            .bind(t)
            .execute(&st.pool)
            .await?;
    }
    if let Some((bytes, mime)) = &form.file {
        sqlx::query(
            "UPDATE voice_messages SET data = $2, mime_type = $3, size_bytes = $4, duration_sec = $5,
                    recorded_by_id = $6, is_sample = FALSE, updated_at = now()
             WHERE id = $1",
        )
        .bind(&voice_id)
        .bind(bytes)
        .bind(mime)
        .bind(bytes.len() as i32)
        .bind(form.duration_sec)
        .bind(&user.id)
        .execute(&st.pool)
        .await?;
    }
    if let Some(s) = &form.schedule_id {
        sqlx::query("UPDATE dose_schedules SET voice_message_id = $2, updated_at = now() WHERE id = $1")
            .bind(s)
            .bind(&voice_id)
            .execute(&st.pool)
            .await?;
    }
    Ok(Json(json!({ "voice": voice_dto(&st, &voice_id).await? })))
}

/// Dose times using it fall back to the latest remaining message.
async fn remove(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(voice_id): Path<String>,
) -> ApiResult<Json<Value>> {
    owned_voice(&st, &user, &voice_id).await?;
    sqlx::query("DELETE FROM voice_messages WHERE id = $1").bind(&voice_id).execute(&st.pool).await?;
    Ok(ok())
}

/// Streams the recording with HTTP Range support (Safari needs it for media).
async fn audio(State(st): State<AppState>, headers: HeaderMap, Path(voice_id): Path<String>) -> ApiResult<Response> {
    let row: Option<(String, String, Vec<u8>)> =
        sqlx::query_as("SELECT patient_id, mime_type, data FROM voice_messages WHERE id = $1")
            .bind(&voice_id)
            .fetch_optional(&st.pool)
            .await?;
    let (patient_id, mime, bytes) = row.ok_or_else(|| ApiError::not_found("Voice message not found."))?;

    let device_id = headers.get(BEAR_DEVICE_HEADER).and_then(|v| v.to_str().ok());
    let key = headers.get(BEAR_KEY_HEADER).and_then(|v| v.to_str().ok());
    if let (Some(device_id), Some(key)) = (device_id, key) {
        let device = sqlx::query_as::<_, BearDevice>("SELECT * FROM bear_devices WHERE id = $1")
            .bind(device_id)
            .fetch_optional(&st.pool)
            .await?;
        if !device.is_some_and(|d| d.device_key == key && d.patient_id == patient_id) {
            return Err(ApiError::forbidden("This bear can't play that message."));
        }
    } else {
        let user = auth::require_user(&st, &headers, Area::Family, &[Role::Family]).await?;
        require_family_patient(&st, &user, &patient_id).await.map_err(|_| ApiError::not_found("Voice message not found."))?;
    }

    let total = bytes.len();
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok()).and_then(|r| r.strip_prefix("bytes="));
    let builder = Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "private, no-store");
    if let Some(spec) = range {
        let (s, e) = spec.split_once('-').unwrap_or((spec, ""));
        let (start, end) = match (s.trim().parse::<usize>().ok(), e.trim().parse::<usize>().ok()) {
            (Some(s), Some(e)) => (s, e.min(total.saturating_sub(1))),
            (Some(s), None) => (s, total.saturating_sub(1)),
            (None, Some(n)) => (total.saturating_sub(n), total.saturating_sub(1)),
            (None, None) => (0, total.saturating_sub(1)),
        };
        if start >= total || end < start {
            return Ok(Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{total}"))
                .body(Body::empty())
                .expect("response"));
        }
        let slice = bytes[start..=end].to_vec();
        return Ok(builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{total}"))
            .header(header::CONTENT_LENGTH, slice.len())
            .body(Body::from(slice))
            .expect("response"));
    }
    Ok(builder.header(header::CONTENT_LENGTH, total).body(Body::from(bytes)).expect("response"))
}
