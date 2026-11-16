//! HTTP routes. Every path is under `/api` (docs/API.md).

use axum::{
    Json, Router,
    extract::DefaultBodyLimit,
    http::{HeaderValue, header},
    middleware::map_response,
    response::Response,
    routing::get,
};
use serde::{Deserialize, Deserializer};
use serde_json::json;
use tower_http::trace::TraceLayer;

use crate::{AppState, error::ApiError};

mod alerts;
mod auth;
mod away;
mod bear;
mod clinic;
mod consents;
mod demo;
mod doses;
mod patients;
mod schedules;
mod voice;

pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .merge(auth::routes())
        .merge(patients::routes())
        .merge(schedules::routes())
        .merge(voice::routes())
        .merge(doses::routes())
        .merge(alerts::routes())
        .merge(consents::routes())
        .merge(away::routes())
        .merge(bear::routes())
        .merge(clinic::routes())
        .merge(demo::routes());
    Router::new()
        .nest("/api", api)
        .fallback(|| async { ApiError::not_found("No such endpoint.") })
        .layer(DefaultBodyLimit::max(3 * 1024 * 1024))
        .layer(map_response(no_store))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "ok": true, "service": "yakap-api" }))
}

/// API responses are never cached (they depend on session + demo clock).
async fn no_store(mut res: Response) -> Response {
    res.headers_mut()
        .entry(header::CACHE_CONTROL)
        .or_insert(HeaderValue::from_static("no-store"));
    res
}

/// Distinguishes "field absent" (None) from "field: null" (Some(None)) in PATCH bodies.
pub(crate) fn double_option<'de, D, T>(d: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(d).map(Some)
}

pub(crate) fn ok() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}
