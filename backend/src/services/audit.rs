//! Append-only privacy log (task B11). Rows can't be updated or deleted
//! (database trigger); every clinician view/export, correction and consent
//! change is written here.

use chrono::{DateTime, Duration, Utc};
use serde_json::{Value, json};
use sqlx::PgConnection;

use crate::{models::User, new_id};

pub struct AuditEntry<'a> {
    pub actor: Option<&'a User>,
    pub action: &'static str,
    pub patient_id: Option<&'a str>,
    pub clinic_name: Option<&'a str>,
    pub details: Value,
    pub sim_time: DateTime<Utc>,
}

pub async fn record(conn: &mut PgConnection, e: AuditEntry<'_>) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO audit_log (id, actor_id, actor_name, actor_role, action, patient_id, clinic_name, details, sim_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(new_id("aud"))
    .bind(e.actor.map(|u| u.id.clone()))
    .bind(e.actor.map(|u| u.name.clone()).unwrap_or_else(|| "System".into()))
    .bind(e.actor.map(|u| u.role.clone()))
    .bind(e.action)
    .bind(e.patient_id)
    .bind(e.clinic_name)
    .bind(e.details)
    .bind(e.sim_time)
    .execute(conn)
    .await?;
    Ok(())
}

/// Repeated views of the same patient by the same clinician within 5 minutes
/// (real time) collapse into one entry so refreshes don't flood the log.
pub async fn record_patient_view(
    conn: &mut PgConnection,
    actor: &User,
    patient_id: &str,
    sim_time: DateTime<Utc>,
    section: &str,
) -> sqlx::Result<()> {
    let recent: Option<String> = sqlx::query_scalar(
        "SELECT id FROM audit_log WHERE actor_id = $1 AND patient_id = $2 AND action = 'VIEW_PATIENT'
           AND created_at >= $3 LIMIT 1",
    )
    .bind(&actor.id)
    .bind(patient_id)
    .bind(Utc::now() - Duration::minutes(5))
    .fetch_optional(&mut *conn)
    .await?;
    if recent.is_some() {
        return Ok(());
    }
    record(
        conn,
        AuditEntry {
            actor: Some(actor),
            action: "VIEW_PATIENT",
            patient_id: Some(patient_id),
            clinic_name: actor.clinic_name.as_deref(),
            details: json!({ "section": section }),
            sim_time,
        },
    )
    .await
}
