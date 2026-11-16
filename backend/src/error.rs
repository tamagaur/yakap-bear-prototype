use axum::{
    Json,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};

/// Every error response: `{ "error": { "code", "message", "details"? } }`.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub details: Option<Value>,
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self { status, code, message: message.into(), details: None }
    }
    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "BAD_REQUEST", message)
    }
    /// Field-level validation error (400).
    pub fn validation(field: &str, message: impl Into<String>) -> Self {
        let message = message.into();
        Self::new(StatusCode::BAD_REQUEST, "VALIDATION_ERROR", message.clone())
            .with_details(json!({ field: [message] }))
    }
    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "UNAUTHORIZED", message)
    }
    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "FORBIDDEN", message)
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "NOT_FOUND", message)
    }
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, "CONFLICT", message)
    }
    pub fn internal() -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL", "Something went wrong on our side.")
    }
    pub fn db_unavailable() -> Self {
        Self::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "DB_UNAVAILABLE",
            "The database is not reachable right now. Please try again in a moment.",
        )
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut body = json!({ "error": { "code": self.code, "message": self.message } });
        if let Some(d) = self.details {
            body["error"]["details"] = d;
        }
        (self.status, [(header::CACHE_CONTROL, "no-store")], Json(body)).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        match &e {
            sqlx::Error::PoolTimedOut
            | sqlx::Error::PoolClosed
            | sqlx::Error::Io(_)
            | sqlx::Error::Tls(_) => {
                tracing::error!(error = %e, "database unavailable");
                Self::db_unavailable()
            }
            sqlx::Error::RowNotFound => Self::not_found("Not found."),
            _ => {
                tracing::error!(error = %e, "database error");
                Self::internal()
            }
        }
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        if let Some(sqlx_err) = e.downcast_ref::<sqlx::Error>() {
            if matches!(
                sqlx_err,
                sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed | sqlx::Error::Io(_)
            ) {
                return Self::db_unavailable();
            }
        }
        tracing::error!(error = %e, "unexpected error");
        Self::internal()
    }
}

/// Postgres unique-constraint violation (SQLSTATE 23505).
pub fn is_unique_violation(e: &sqlx::Error) -> bool {
    matches!(e, sqlx::Error::Database(d) if d.code().as_deref() == Some("23505"))
}
