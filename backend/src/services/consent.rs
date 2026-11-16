//! Consent-based clinician access (task B8).

use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::PgPool;

use crate::{
    consent_select,
    error::{ApiError, ApiResult},
    models::{ConsentFull, Role, User},
    new_id,
    services::audit::{self, AuditEntry},
};

pub const CONSENT_VERSION: &str = "2026-11-v1";

pub async fn has_active_consent(pool: &PgPool, patient_id: &str, clinician_id: &str) -> sqlx::Result<bool> {
    let n: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM consents WHERE patient_id = $1 AND clinician_id = $2 AND revoked_at IS NULL",
    )
    .bind(patient_id)
    .bind(clinician_id)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

pub async fn load(pool: &PgPool, consent_id: &str) -> sqlx::Result<Option<ConsentFull>> {
    sqlx::query_as::<_, ConsentFull>(concat!(consent_select!(), " WHERE c.id = $1"))
        .bind(consent_id)
        .fetch_optional(pool)
        .await
}

pub async fn grant(
    pool: &PgPool,
    patient_id: &str,
    granted_by: &User,
    clinician_id: &str,
    signed_name: &str,
    signature_data_url: &str,
    now: DateTime<Utc>,
) -> ApiResult<ConsentFull> {
    let clinician = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(clinician_id)
        .fetch_optional(pool)
        .await?
        .filter(|u| u.role() == Some(Role::Clinician))
        .ok_or_else(|| ApiError::validation("clinicianId", "Choose a clinician from the list."))?;
    if has_active_consent(pool, patient_id, &clinician.id).await? {
        return Err(ApiError::conflict(format!("{} already has active consent for this patient.", clinician.name)));
    }
    let id = new_id("con");
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO consents (id, patient_id, clinician_id, granted_by_id, signed_name, signature_data_url, consent_version, granted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(&id)
    .bind(patient_id)
    .bind(&clinician.id)
    .bind(&granted_by.id)
    .bind(signed_name)
    .bind(signature_data_url)
    .bind(CONSENT_VERSION)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    audit::record(
        &mut tx,
        AuditEntry {
            actor: Some(granted_by),
            action: "CONSENT_GRANT",
            patient_id: Some(patient_id),
            clinic_name: clinician.clinic_name.as_deref(),
            details: json!({ "clinician": clinician.name, "signedName": signed_name, "version": CONSENT_VERSION }),
            sim_time: now,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(load(pool, &id).await?.expect("consent just created"))
}

/// Revocation takes effect immediately; past audit entries stay intact.
pub async fn revoke(pool: &PgPool, consent_id: &str, user: &User, now: DateTime<Utc>) -> ApiResult<ConsentFull> {
    let consent = load(pool, consent_id).await?.ok_or_else(|| ApiError::not_found("Consent not found."))?;
    let member: i64 = sqlx::query_scalar("SELECT count(*) FROM patient_members WHERE user_id = $1 AND patient_id = $2")
        .bind(&user.id)
        .bind(&consent.patient_id)
        .fetch_one(pool)
        .await?;
    if member == 0 {
        return Err(ApiError::not_found("Consent not found."));
    }
    if consent.revoked_at.is_some() {
        return Err(ApiError::conflict("This consent was already revoked."));
    }
    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE consents SET revoked_at = $2, revoked_by_id = $3 WHERE id = $1 AND revoked_at IS NULL")
        .bind(consent_id)
        .bind(now)
        .bind(&user.id)
        .execute(&mut *tx)
        .await?;
    audit::record(
        &mut tx,
        AuditEntry {
            actor: Some(user),
            action: "CONSENT_REVOKE",
            patient_id: Some(&consent.patient_id),
            clinic_name: consent.clinician_clinic.as_deref(),
            details: json!({ "clinician": consent.clinician_name }),
            sim_time: now,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(load(pool, consent_id).await?.expect("consent exists"))
}
