//! Offline dose memory + sync (task B10). Holds recorded while the bear was
//! offline are re-validated against the time they actually happened, in
//! chronological order. Duplicates (same client_event_id) are skipped.

use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;

use crate::{
    dto::HoldResultDto,
    error::ApiResult,
    services::{
        dose_engine,
        hold_filter::{self, HoldInput},
    },
};

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SyncEvent {
    pub client_event_id: String,
    pub hold_ms: i64,
    pub held_at: DateTime<Utc>,
}

pub async fn sync_device_events(
    pool: &PgPool,
    device_id: &str,
    patient_id: &str,
    mut events: Vec<SyncEvent>,
    now: DateTime<Utc>,
) -> ApiResult<Vec<HoldResultDto>> {
    // Bring dose state up to date first (doses may have become MISSED meanwhile).
    dose_engine::evaluate_patient(pool, patient_id, now).await?;
    events.sort_by_key(|e| e.held_at);
    let mut results = Vec::with_capacity(events.len());
    for ev in &events {
        results.push(
            hold_filter::process_hold(
                pool,
                HoldInput {
                    patient_id,
                    device_id,
                    client_event_id: &ev.client_event_id,
                    hold_ms: ev.hold_ms,
                    // A device clock can't log the future.
                    held_at: ev.held_at.min(now),
                    via_sync: true,
                    now,
                },
            )
            .await?,
        );
    }
    Ok(results)
}
