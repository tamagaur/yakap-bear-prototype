//! Yakap Bear prototype — Rust API.
//!
//! Axum + SQLx + PostgreSQL. Serves every `/api/*` endpoint used by the bear
//! simulator, the family app and the clinic dashboard (Next.js forwards
//! `/api/*` here). Business rules live in [`dose_rules`] (pure) and
//! [`services`] (database orchestration).

// Row tuples from ad-hoc SELECTs and a few query helpers with many filters are clearer inline.
#![allow(clippy::type_complexity, clippy::too_many_arguments)]

pub mod auth;
pub mod config;
pub mod dose_rules;
pub mod dto;
pub mod error;
pub mod extract;
pub mod models;
pub mod routes;
pub mod seed;
pub mod services;
pub mod state;
pub mod time;
pub mod validate;

pub use state::AppState;

/// Embedded SQL migrations from `backend/migrations`.
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

/// Builds the full HTTP application (used by `main` and the integration tests).
pub fn build_app(state: AppState) -> axum::Router {
    routes::router(state)
}

/// New random id with a readable prefix, e.g. `ev_3f2a…`.
pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}
