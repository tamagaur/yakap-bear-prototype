//! Simulated demo clock (task B12). The app's "now" = real time + offset,
//! stored in one row so the bear, family app and clinic always agree.

use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;

use crate::time;

/// Demo reset time: 15 minutes before Lola Rosa's 8:00 PM dose.
pub const DEMO_START_TIME: &str = "19:45";

pub async fn offset_ms(pool: &PgPool) -> sqlx::Result<i64> {
    let v: Option<i64> = sqlx::query_scalar("SELECT offset_ms FROM sim_clock WHERE id = 1")
        .fetch_optional(pool)
        .await?;
    Ok(v.unwrap_or(0))
}

pub async fn now(pool: &PgPool) -> sqlx::Result<DateTime<Utc>> {
    Ok(Utc::now() + Duration::milliseconds(offset_ms(pool).await?))
}

/// Moves the clock to `target`. Never moves backwards unless `allow_backward` (reset).
pub async fn set_now(pool: &PgPool, target: DateTime<Utc>, allow_backward: bool) -> sqlx::Result<DateTime<Utc>> {
    let current = now(pool).await?;
    if !allow_backward && target < current {
        return Ok(current);
    }
    let offset = (target - Utc::now()).num_milliseconds();
    sqlx::query(
        "INSERT INTO sim_clock (id, offset_ms, updated_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET offset_ms = EXCLUDED.offset_ms, updated_at = now()",
    )
    .bind(offset)
    .execute(pool)
    .await?;
    Ok(target)
}

pub async fn advance(pool: &PgPool, minutes: i64) -> sqlx::Result<DateTime<Utc>> {
    let n = now(pool).await?;
    set_now(pool, n + Duration::minutes(minutes), false).await
}

/// Today's (real) Manila date at 7:45 PM.
pub fn reset_target(real_now: DateTime<Utc>) -> DateTime<Utc> {
    time::from_manila(time::date_of(real_now), DEMO_START_TIME)
}
