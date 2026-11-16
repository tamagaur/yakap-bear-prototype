use axum::{
    Json,
    extract::{FromRequest, FromRequestParts, Query, Request},
    http::request::Parts,
};
use serde::de::DeserializeOwned;

use crate::error::ApiError;

/// JSON body extractor whose rejections use the API error format (400).
pub struct ApiJson<T>(pub T);

impl<S, T> FromRequest<S> for ApiJson<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(v)) => Ok(ApiJson(v)),
            Err(rej) => Err(ApiError::new(
                axum::http::StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                format!("Invalid request body: {}", rej.body_text()),
            )),
        }
    }
}

/// Query-string extractor whose rejections use the API error format (400).
pub struct ApiQuery<T>(pub T);

impl<S, T> FromRequestParts<S> for ApiQuery<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Query::<T>::from_request_parts(parts, state).await {
            Ok(Query(v)) => Ok(ApiQuery(v)),
            Err(rej) => Err(ApiError::new(
                axum::http::StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                format!("Invalid query: {}", rej.body_text()),
            )),
        }
    }
}
