//! /api/auth — signup (family only), login, logout, current user.

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header::SET_COOKIE},
    response::IntoResponse,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    auth::{self, Area},
    error::{ApiError, ApiResult},
    extract::{ApiJson, ApiQuery},
    models::{Role, User},
    new_id,
    services::convert,
    validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/signup", post(signup))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
}

#[derive(Deserialize)]
struct SignupBody {
    name: String,
    email: String,
    password: String,
}

async fn signup(State(st): State<AppState>, ApiJson(b): ApiJson<SignupBody>) -> ApiResult<impl IntoResponse> {
    let name = validate::text(&b.name, "name", 2, 80, "Enter your name")?;
    let email = validate::email(&b.email)?;
    if b.password.chars().count() < 8 || b.password.len() > 200 {
        return Err(ApiError::validation("password", "Use at least 8 characters"));
    }
    let exists: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(&st.pool)
        .await?;
    if exists > 0 {
        return Err(ApiError::conflict("An account with this email already exists. Try signing in."));
    }
    let hash = auth::hash_password(b.password).await?;
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, 'FAMILY') RETURNING *",
    )
    .bind(new_id("user"))
    .bind(&email)
    .bind(hash)
    .bind(&name)
    .fetch_one(&st.pool)
    .await?;
    let token = auth::sign_session(&st.cfg.session_secret, &user, Area::Family)?;
    Ok((
        StatusCode::CREATED,
        [(SET_COOKIE, auth::session_cookie(Area::Family, &token, st.cfg.cookie_secure))],
        Json(json!({ "user": convert::user_dto(&user) })),
    ))
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
    area: String,
}

async fn login(State(st): State<AppState>, ApiJson(b): ApiJson<LoginBody>) -> ApiResult<impl IntoResponse> {
    let area = Area::parse(&b.area).ok_or_else(|| ApiError::validation("area", "Use family or clinic"))?;
    let email = validate::email(&b.email)?;
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&st.pool)
        .await?;
    // Always spend one bcrypt round so unknown emails take as long as wrong passwords.
    let ok = match &user {
        Some(u) => auth::verify_password(b.password, u.password_hash.clone()).await,
        None => {
            let _ = auth::hash_password(b.password).await;
            false
        }
    };
    let user = match user {
        Some(u) if ok => u,
        _ => return Err(ApiError::new(StatusCode::UNAUTHORIZED, "INVALID_CREDENTIALS", "Incorrect email or password.")),
    };
    let role = user.role().ok_or_else(ApiError::internal)?;
    if !area.allows(role) {
        let msg = if area == Area::Family {
            "This is a clinic account. Please use the clinic dashboard sign-in."
        } else {
            "This is a family account. Please use the family app sign-in."
        };
        return Err(ApiError::new(StatusCode::FORBIDDEN, "WRONG_AREA", msg));
    }
    let token = auth::sign_session(&st.cfg.session_secret, &user, area)?;
    Ok((
        [(SET_COOKIE, auth::session_cookie(area, &token, st.cfg.cookie_secure))],
        Json(json!({ "user": convert::user_dto(&user) })),
    ))
}

#[derive(Deserialize)]
struct AreaQuery {
    area: String,
}

async fn logout(State(st): State<AppState>, ApiQuery(q): ApiQuery<AreaQuery>) -> ApiResult<impl IntoResponse> {
    let area = Area::parse(&q.area).ok_or_else(|| ApiError::validation("area", "Use family or clinic"))?;
    Ok(([(SET_COOKIE, auth::clear_session_cookie(area, st.cfg.cookie_secure))], Json(json!({ "ok": true }))))
}

async fn me(
    State(st): State<AppState>,
    headers: HeaderMap,
    ApiQuery(q): ApiQuery<AreaQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let area = Area::parse(&q.area).ok_or_else(|| ApiError::validation("area", "Use family or clinic"))?;
    let user = auth::optional_user(&st, &headers, area)
        .await?
        .filter(|u| u.role().is_some_and(|r: Role| area.allows(r)));
    Ok(Json(json!({ "user": user.as_ref().map(convert::user_dto) })))
}
