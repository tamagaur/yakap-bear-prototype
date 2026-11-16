use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;

/// Shared application state handed to every handler.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
}

impl AppState {
    pub fn new(pool: PgPool, cfg: Config) -> Self {
        Self { pool, cfg: Arc::new(cfg) }
    }
}
