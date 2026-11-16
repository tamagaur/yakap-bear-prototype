//! Authentication & authorization (tasks B4, B8, D1).
//!
//! * Sessions are HS256 JWTs in httpOnly cookies — one cookie per area
//!   (family / clinic) so one browser can demo both side by side. The Next.js
//!   page guard (src/proxy.ts) verifies the same token format with `jose`.
//! * Every protected handler enforces roles, patient ownership and clinician
//!   consent here, on the server.

use axum::{
    extract::FromRequestParts,
    http::{HeaderMap, HeaderValue, request::Parts},
};
use chrono::Utc;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use crate::{
    AppState,
    error::{ApiError, ApiResult},
    models::{BearDevice, ConsentFull, Patient, Role, User},
};

pub const SESSION_TTL_SECONDS: i64 = 60 * 60 * 12; // 12 hours
pub const ISSUER: &str = "yakap-bear";
pub const BEAR_KEY_HEADER: &str = "x-bear-key";
pub const BEAR_DEVICE_HEADER: &str = "x-bear-device";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Area {
    Family,
    Clinic,
}

impl Area {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "family" => Some(Self::Family),
            "clinic" => Some(Self::Clinic),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Family => "family",
            Self::Clinic => "clinic",
        }
    }
    pub fn cookie_name(self) -> &'static str {
        match self {
            Self::Family => "yakap_family_session",
            Self::Clinic => "yakap_clinic_session",
        }
    }
    pub fn allows(self, role: Role) -> bool {
        match self {
            Self::Family => role == Role::Family,
            Self::Clinic => matches!(role, Role::Clinician | Role::ClinicAdmin),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub name: String,
    pub area: String,
    pub iss: String,
    pub iat: i64,
    pub exp: i64,
}

pub fn sign_session(secret: &str, user: &User, area: Area) -> ApiResult<String> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: user.id.clone(),
        role: user.role.clone(),
        name: user.name.clone(),
        area: area.as_str().into(),
        iss: ISSUER.into(),
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
    };
    let key = EncodingKey::from_secret(secret.as_bytes()).map_err(|e| {
        tracing::error!(error = %e, "invalid session secret");
        ApiError::internal()
    })?;
    encode(&Header::new(Algorithm::HS256), &claims, &key).map_err(|e| {
        tracing::error!(error = %e, "failed to sign session");
        ApiError::internal()
    })
}

pub fn verify_session(secret: &str, token: &str, area: Area) -> Option<Claims> {
    let mut v = Validation::new(Algorithm::HS256);
    v.set_issuer(&[ISSUER]);
    v.leeway = 5;
    let key = DecodingKey::from_secret(secret.as_bytes()).ok()?;
    let data = decode::<Claims>(token, &key, &v).ok()?;
    let role = Role::parse(&data.claims.role)?;
    (data.claims.area == area.as_str() && area.allows(role)).then_some(data.claims)
}

pub fn session_cookie(area: Area, token: &str, secure: bool) -> HeaderValue {
    let s = format!(
        "{}={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}{}",
        area.cookie_name(),
        token,
        SESSION_TTL_SECONDS,
        if secure { "; Secure" } else { "" }
    );
    HeaderValue::from_str(&s).expect("valid cookie header")
}

pub fn clear_session_cookie(area: Area, secure: bool) -> HeaderValue {
    let s = format!(
        "{}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{}",
        area.cookie_name(),
        if secure { "; Secure" } else { "" }
    );
    HeaderValue::from_str(&s).expect("valid cookie header")
}

pub fn read_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all(axum::http::header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(k, _)| *k == name)
        .map(|(_, v)| v.to_string())
}

pub async fn find_user(state: &AppState, id: &str) -> ApiResult<Option<User>> {
    Ok(sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await?)
}

pub async fn optional_user(state: &AppState, headers: &HeaderMap, area: Area) -> ApiResult<Option<User>> {
    let Some(token) = read_cookie(headers, area.cookie_name()) else { return Ok(None) };
    let Some(claims) = verify_session(&state.cfg.session_secret, &token, area) else { return Ok(None) };
    find_user(state, &claims.sub).await
}

pub async fn require_user(state: &AppState, headers: &HeaderMap, area: Area, roles: &[Role]) -> ApiResult<User> {
    let token = read_cookie(headers, area.cookie_name())
        .ok_or_else(|| ApiError::unauthorized("Please sign in to continue."))?;
    let claims = verify_session(&state.cfg.session_secret, &token, area)
        .ok_or_else(|| ApiError::unauthorized("Your session has expired. Please sign in again."))?;
    let user = find_user(state, &claims.sub)
        .await?
        .ok_or_else(|| ApiError::unauthorized("Your session has expired. Please sign in again."))?;
    match user.role() {
        Some(r) if roles.contains(&r) => Ok(user),
        _ => Err(ApiError::forbidden("You don't have access to this.")),
    }
}

/// Signed-in family member (cookie `yakap_family_session`).
pub struct FamilyUser(pub User);

impl FromRequestParts<AppState> for FamilyUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        require_user(state, &parts.headers, Area::Family, &[Role::Family]).await.map(FamilyUser)
    }
}

/// Signed-in clinician or clinic admin (cookie `yakap_clinic_session`).
pub struct ClinicUser(pub User);

impl FromRequestParts<AppState> for ClinicUser {
    type Rejection = ApiError;
    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        require_user(state, &parts.headers, Area::Clinic, &[Role::Clinician, Role::ClinicAdmin])
            .await
            .map(ClinicUser)
    }
}

pub async fn hash_password(plain: String) -> ApiResult<String> {
    tokio::task::spawn_blocking(move || bcrypt::hash(plain, 10))
        .await
        .map_err(|_| ApiError::internal())?
        .map_err(|_| ApiError::internal())
}

pub async fn verify_password(plain: String, hash: String) -> bool {
    tokio::task::spawn_blocking(move || bcrypt::verify(plain, &hash).unwrap_or(false))
        .await
        .unwrap_or(false)
}

/// The family member must manage this patient. Unknown/foreign patients → 404.
pub async fn require_family_patient(
    state: &AppState,
    user: &User,
    patient_id: &str,
) -> ApiResult<(Patient, Option<String>)> {
    #[derive(sqlx::FromRow)]
    struct Row {
        #[sqlx(flatten)]
        patient: Patient,
        relationship: Option<String>,
    }
    let row = sqlx::query_as::<_, Row>(
        "SELECT p.*, m.relationship FROM patients p
         JOIN patient_members m ON m.patient_id = p.id
         WHERE p.id = $1 AND m.user_id = $2",
    )
    .bind(patient_id)
    .bind(&user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("Patient not found."))?;
    Ok((row.patient, row.relationship))
}

#[macro_export]
macro_rules! consent_select {
    () => {
        "SELECT c.id, c.patient_id, c.clinician_id, c.signed_name, c.signature_data_url,
                c.consent_version, c.granted_at, c.revoked_at,
                cl.name AS clinician_name, cl.title AS clinician_title, cl.clinic_name AS clinician_clinic,
                g.name AS granted_by_name, r.name AS revoked_by_name
         FROM consents c
         JOIN users cl ON cl.id = c.clinician_id
         JOIN users g ON g.id = c.granted_by_id
         LEFT JOIN users r ON r.id = c.revoked_by_id"
    };
}

/// Clinician with an active (non-revoked) written consent for this patient.
/// Guessing or changing a patient id without consent → 403.
pub async fn require_clinician_patient(
    state: &AppState,
    user: &User,
    patient_id: &str,
) -> ApiResult<(Patient, ConsentFull)> {
    if user.role() != Some(Role::Clinician) {
        return Err(ApiError::forbidden("Only clinicians can open patient dose logs."));
    }
    let consent = sqlx::query_as::<_, ConsentFull>(concat!(
        consent_select!(),
        " WHERE c.patient_id = $1 AND c.clinician_id = $2 AND c.revoked_at IS NULL
          ORDER BY c.granted_at DESC LIMIT 1"
    ))
    .bind(patient_id)
    .bind(&user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::forbidden("You don't have the patient's written consent to view this record."))?;
    let patient = sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_one(&state.pool)
        .await?;
    Ok((patient, consent))
}

/// Bear device authenticated by its device token header.
pub async fn require_bear_device(
    state: &AppState,
    headers: &HeaderMap,
    device_id: &str,
) -> ApiResult<(BearDevice, Patient)> {
    let key = headers
        .get(BEAR_KEY_HEADER)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::unauthorized("Missing device key."))?;
    let device = sqlx::query_as::<_, BearDevice>("SELECT * FROM bear_devices WHERE id = $1")
        .bind(device_id)
        .fetch_optional(&state.pool)
        .await?
        .filter(|d| d.device_key == key)
        .ok_or_else(|| ApiError::unauthorized("Unknown device or wrong key."))?;
    let patient = sqlx::query_as::<_, Patient>("SELECT * FROM patients WHERE id = $1")
        .bind(&device.patient_id)
        .fetch_one(&state.pool)
        .await?;
    Ok((device, patient))
}
