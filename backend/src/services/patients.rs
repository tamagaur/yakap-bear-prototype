//! Patient setup (task M2): every new patient gets a paired simulated bear.

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::{
    dto::PatientDto,
    models::{BearDevice, Patient, User},
    new_id,
    services::{convert, dose_engine},
};

pub struct NewContact {
    pub name: String,
    pub relationship: String,
    pub phone: String,
    pub receives_sms: bool,
}

pub struct NewPatient {
    pub full_name: String,
    pub nickname: String,
    pub birth_year: Option<i32>,
    pub relationship: String,
    pub contacts: Vec<NewContact>,
}

pub async fn next_device_id(pool: &PgPool) -> sqlx::Result<String> {
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM bear_devices").fetch_all(pool).await?;
    let max = ids
        .iter()
        .filter_map(|id| id.strip_prefix("BEAR-").and_then(|n| n.parse::<u32>().ok()))
        .max()
        .unwrap_or(0);
    Ok(format!("BEAR-{:04}", max + 1))
}

pub fn new_device_key() -> String {
    format!("bear_{}", uuid::Uuid::new_v4().simple())
}

pub async fn create_for_family(
    pool: &PgPool,
    user: &User,
    input: NewPatient,
    now: DateTime<Utc>,
) -> sqlx::Result<(Patient, BearDevice)> {
    let device_id = next_device_id(pool).await?;
    let patient_id = new_id("pat");
    let mut tx = pool.begin().await?;
    let patient = sqlx::query_as::<_, Patient>(
        "INSERT INTO patients (id, full_name, nickname, birth_year, plan_started_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(&patient_id)
    .bind(&input.full_name)
    .bind(&input.nickname)
    .bind(input.birth_year)
    .bind(now)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("INSERT INTO patient_members (user_id, patient_id, relationship) VALUES ($1, $2, $3)")
        .bind(&user.id)
        .bind(&patient_id)
        .bind(&input.relationship)
        .execute(&mut *tx)
        .await?;
    for c in &input.contacts {
        sqlx::query(
            "INSERT INTO family_contacts (id, patient_id, name, relationship, phone, receives_sms) VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(new_id("fc"))
        .bind(&patient_id)
        .bind(&c.name)
        .bind(&c.relationship)
        .bind(&c.phone)
        .bind(c.receives_sms)
        .execute(&mut *tx)
        .await?;
    }
    let device = sqlx::query_as::<_, BearDevice>(
        "INSERT INTO bear_devices (id, patient_id, device_key) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(&device_id)
    .bind(&patient_id)
    .bind(new_device_key())
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((patient, device))
}

pub async fn patient_dto_for(
    pool: &PgPool,
    patient: &Patient,
    relationship: Option<String>,
    now: DateTime<Utc>,
) -> sqlx::Result<PatientDto> {
    let device = sqlx::query_as::<_, BearDevice>("SELECT * FROM bear_devices WHERE patient_id = $1")
        .bind(&patient.id)
        .fetch_optional(pool)
        .await?;
    let away = dose_engine::is_away_now(pool, &patient.id, now).await?;
    Ok(convert::patient_dto(patient, device.as_ref(), relationship, now, away))
}
