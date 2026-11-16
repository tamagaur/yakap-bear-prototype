//! Written clinician consent (tasks B8, M9) and the family's access log.

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState, consent_select,
    auth::{FamilyUser, require_family_patient},
    dto::AccessLogEntryDto,
    error::{ApiError, ApiResult},
    extract::ApiJson,
    models::ConsentFull,
    services::{clock, consent, convert},
    time::{self, iso},
    validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients/{patient_id}/consents", get(list).post(grant))
        .route("/consents/{consent_id}/revoke", post(revoke))
        .route("/patients/{patient_id}/access-log", get(access_log))
}

async fn list(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let rows = sqlx::query_as::<_, ConsentFull>(concat!(
        consent_select!(),
        " WHERE c.patient_id = $1 ORDER BY (c.revoked_at IS NULL) DESC, c.granted_at DESC"
    ))
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    Ok(Json(json!({ "consents": rows.iter().map(convert::consent_dto).collect::<Vec<_>>() })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrantBody {
    clinician_id: String,
    agreed: bool,
    signed_name: String,
    signature_data_url: String,
}

async fn grant(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<GrantBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_family_patient(&st, &user, &patient_id).await?;
    if !b.agreed {
        return Err(ApiError::validation("agreed", "Please tick the consent box"));
    }
    let signed_name = validate::text(&b.signed_name, "signedName", 2, 80, "Type your full name")?;
    if !b.signature_data_url.starts_with("data:image/png;base64,") || b.signature_data_url.len() < 40 {
        return Err(ApiError::validation("signatureDataUrl", "Please sign in the signature box"));
    }
    if b.signature_data_url.len() > 400_000 {
        return Err(ApiError::validation("signatureDataUrl", "Signature image is too large"));
    }
    let now = clock::now(&st.pool).await?;
    let c = consent::grant(&st.pool, &patient_id, &user, &b.clinician_id, &signed_name, &b.signature_data_url, now).await?;
    Ok((StatusCode::CREATED, Json(json!({ "consent": convert::consent_dto(&c) }))))
}

/// Clinician access ends immediately; past audit entries stay.
async fn revoke(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(consent_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let now = clock::now(&st.pool).await?;
    let c = consent::revoke(&st.pool, &consent_id, &user, now).await?;
    Ok(Json(json!({ "consent": convert::consent_dto(&c) })))
}

fn summarize(action: &str, d: &Value) -> String {
    let s = |k: &str| d.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    match action {
        "VIEW_PATIENT" => "Viewed the dose log".into(),
        "EXPORT_CSV" => "Exported the dose log (CSV)".into(),
        "EXPORT_PDF" => "Exported the dose log (PDF)".into(),
        "CONSENT_GRANT" => format!("Gave consent to {}", s("clinician")),
        "CONSENT_REVOKE" => format!("Revoked consent for {}", s("clinician")),
        "CORRECT_LOG" => {
            let when = d
                .get("scheduledFor")
                .and_then(Value::as_str)
                .and_then(|t| t.parse().ok())
                .map(|t| format!(" on {}", time::format_short_date(t)))
                .unwrap_or_default();
            format!("Corrected {}{when}: {} → {}", s("dose"), s("from"), s("to"))
        }
        other => other.into(),
    }
}

/// Who viewed/exported the log, consent changes and corrections for this patient.
async fn access_log(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let rows: Vec<(String, String, String, Option<String>, Option<Value>, chrono::DateTime<chrono::Utc>)> = sqlx::query_as(
        "SELECT id, action, actor_name, clinic_name, details, sim_time FROM audit_log
         WHERE patient_id = $1 ORDER BY sim_time DESC LIMIT 60",
    )
    .bind(&patient_id)
    .fetch_all(&st.pool)
    .await?;
    let entries: Vec<AccessLogEntryDto> = rows
        .into_iter()
        .map(|(id, action, actor_name, clinic_name, details, sim_time)| AccessLogEntryDto {
            summary: summarize(&action, details.as_ref().unwrap_or(&Value::Null)),
            id,
            action,
            actor_name,
            clinic_name,
            sim_time: iso(sim_time),
        })
        .collect();
    Ok(Json(json!({ "entries": entries })))
}
