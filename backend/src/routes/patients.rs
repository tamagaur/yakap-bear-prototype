//! /api/patients, /api/contacts, /api/clinicians — family patient setup (M2).

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{FamilyUser, require_family_patient},
    error::{ApiError, ApiResult},
    extract::ApiJson,
    models::{FamilyContact, Patient, User},
    new_id,
    routes::{double_option, ok},
    services::{
        clock, convert,
        patients::{self, NewContact, NewPatient},
    },
    validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/patients", get(list).post(create))
        .route("/patients/{patient_id}", get(get_one).patch(update))
        .route("/patients/{patient_id}/contacts", get(list_contacts).post(create_contact))
        .route("/contacts/{contact_id}", patch(update_contact).delete(delete_contact))
        .route("/clinicians", get(clinicians))
}

async fn list(State(st): State<AppState>, FamilyUser(user): FamilyUser) -> ApiResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        #[sqlx(flatten)]
        patient: Patient,
        relationship: Option<String>,
    }
    let now = clock::now(&st.pool).await?;
    let rows = sqlx::query_as::<_, Row>(
        "SELECT p.*, m.relationship FROM patients p JOIN patient_members m ON m.patient_id = p.id
         WHERE m.user_id = $1 ORDER BY m.created_at",
    )
    .bind(&user.id)
    .fetch_all(&st.pool)
    .await?;
    let mut out = Vec::new();
    for r in rows {
        out.push(patients::patient_dto_for(&st.pool, &r.patient, r.relationship, now).await?);
    }
    Ok(Json(json!({ "patients": out })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContactBody {
    name: String,
    relationship: String,
    phone: String,
    #[serde(default = "yes")]
    receives_sms: bool,
}
fn yes() -> bool {
    true
}

fn validate_contact(c: &ContactBody) -> ApiResult<NewContact> {
    Ok(NewContact {
        name: validate::text(&c.name, "name", 2, 80, "Enter a name")?,
        relationship: validate::text(&c.relationship, "relationship", 2, 40, "Enter the relationship")?,
        phone: validate::phone(&c.phone)?,
        receives_sms: c.receives_sms,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateBody {
    full_name: String,
    nickname: String,
    birth_year: Option<i32>,
    relationship: String,
    #[serde(default)]
    contacts: Vec<ContactBody>,
}

fn validate_birth_year(y: Option<i32>) -> ApiResult<Option<i32>> {
    match y {
        Some(y) if !(1900..=2010).contains(&y) => {
            Err(ApiError::validation("birthYear", "Yakap Bear is designed for adults (birth year 1900–2010)"))
        }
        other => Ok(other),
    }
}

async fn create(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    ApiJson(b): ApiJson<CreateBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    if b.contacts.len() > 5 {
        return Err(ApiError::validation("contacts", "Add up to 5 contacts here (more later in Settings)"));
    }
    let input = NewPatient {
        full_name: validate::text(&b.full_name, "fullName", 2, 80, "Enter the patient's full name")?,
        nickname: validate::text(&b.nickname, "nickname", 1, 40, "Enter what the bear should call them")?,
        birth_year: validate_birth_year(b.birth_year)?,
        relationship: validate::text(&b.relationship, "relationship", 2, 40, "Enter your relationship")?,
        contacts: b.contacts.iter().map(validate_contact).collect::<ApiResult<_>>()?,
    };
    let relationship = input.relationship.clone();
    let now = clock::now(&st.pool).await?;
    let (patient, device) = patients::create_for_family(&st.pool, &user, input, now).await?;
    let dto = convert::patient_dto(&patient, Some(&device), Some(relationship), now, false);
    Ok((StatusCode::CREATED, Json(json!({ "patient": dto }))))
}

async fn get_one(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    let (patient, relationship) = require_family_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    Ok(Json(json!({ "patient": patients::patient_dto_for(&st.pool, &patient, relationship, now).await? })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateBody {
    full_name: Option<String>,
    nickname: Option<String>,
    #[serde(default, deserialize_with = "double_option")]
    birth_year: Option<Option<i32>>,
    #[serde(default, deserialize_with = "double_option")]
    notes: Option<Option<String>>,
}

async fn update(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<UpdateBody>,
) -> ApiResult<Json<Value>> {
    let (mut patient, relationship) = require_family_patient(&st, &user, &patient_id).await?;
    if let Some(n) = &b.full_name {
        patient.full_name = validate::text(n, "fullName", 2, 80, "Enter the patient's full name")?;
    }
    if let Some(n) = &b.nickname {
        patient.nickname = validate::text(n, "nickname", 1, 40, "Enter what the bear should call them")?;
    }
    if let Some(y) = b.birth_year {
        patient.birth_year = validate_birth_year(y)?;
    }
    if let Some(n) = &b.notes {
        patient.notes = validate::opt_text(n.as_deref(), "notes", 500)?;
    }
    sqlx::query("UPDATE patients SET full_name = $2, nickname = $3, birth_year = $4, notes = $5 WHERE id = $1")
        .bind(&patient.id)
        .bind(&patient.full_name)
        .bind(&patient.nickname)
        .bind(patient.birth_year)
        .bind(&patient.notes)
        .execute(&st.pool)
        .await?;
    let now = clock::now(&st.pool).await?;
    Ok(Json(json!({ "patient": patients::patient_dto_for(&st.pool, &patient, relationship, now).await? })))
}

async fn list_contacts(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<Value>> {
    require_family_patient(&st, &user, &patient_id).await?;
    let contacts =
        sqlx::query_as::<_, FamilyContact>("SELECT * FROM family_contacts WHERE patient_id = $1 ORDER BY created_at")
            .bind(&patient_id)
            .fetch_all(&st.pool)
            .await?;
    Ok(Json(json!({ "contacts": contacts.iter().map(convert::contact_dto).collect::<Vec<_>>() })))
}

async fn create_contact(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<ContactBody>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    require_family_patient(&st, &user, &patient_id).await?;
    let c = validate_contact(&b)?;
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM family_contacts WHERE patient_id = $1")
        .bind(&patient_id)
        .fetch_one(&st.pool)
        .await?;
    if count >= 8 {
        return Err(ApiError::bad_request("You can add up to 8 caregiver contacts."));
    }
    let contact = sqlx::query_as::<_, FamilyContact>(
        "INSERT INTO family_contacts (id, patient_id, name, relationship, phone, receives_sms)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(new_id("fc"))
    .bind(&patient_id)
    .bind(c.name)
    .bind(c.relationship)
    .bind(c.phone)
    .bind(c.receives_sms)
    .fetch_one(&st.pool)
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "contact": convert::contact_dto(&contact) }))))
}

async fn load_contact(st: &AppState, user: &User, contact_id: &str) -> ApiResult<FamilyContact> {
    let c = sqlx::query_as::<_, FamilyContact>("SELECT * FROM family_contacts WHERE id = $1")
        .bind(contact_id)
        .fetch_optional(&st.pool)
        .await?
        .ok_or_else(|| ApiError::not_found("Contact not found."))?;
    require_family_patient(st, user, &c.patient_id).await?;
    Ok(c)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContactPatch {
    name: Option<String>,
    relationship: Option<String>,
    phone: Option<String>,
    receives_sms: Option<bool>,
}

async fn update_contact(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(contact_id): Path<String>,
    ApiJson(b): ApiJson<ContactPatch>,
) -> ApiResult<Json<Value>> {
    let mut c = load_contact(&st, &user, &contact_id).await?;
    if let Some(v) = &b.name {
        c.name = validate::text(v, "name", 2, 80, "Enter a name")?;
    }
    if let Some(v) = &b.relationship {
        c.relationship = validate::text(v, "relationship", 2, 40, "Enter the relationship")?;
    }
    if let Some(v) = &b.phone {
        c.phone = validate::phone(v)?;
    }
    if let Some(v) = b.receives_sms {
        c.receives_sms = v;
    }
    sqlx::query("UPDATE family_contacts SET name = $2, relationship = $3, phone = $4, receives_sms = $5 WHERE id = $1")
        .bind(&c.id)
        .bind(&c.name)
        .bind(&c.relationship)
        .bind(&c.phone)
        .bind(c.receives_sms)
        .execute(&st.pool)
        .await?;
    Ok(Json(json!({ "contact": convert::contact_dto(&c) })))
}

async fn delete_contact(
    State(st): State<AppState>,
    FamilyUser(user): FamilyUser,
    Path(contact_id): Path<String>,
) -> ApiResult<Json<Value>> {
    load_contact(&st, &user, &contact_id).await?;
    sqlx::query("DELETE FROM family_contacts WHERE id = $1").bind(&contact_id).execute(&st.pool).await?;
    Ok(ok())
}

async fn clinicians(State(st): State<AppState>, FamilyUser(_): FamilyUser) -> ApiResult<Json<Value>> {
    let users = sqlx::query_as::<_, User>("SELECT * FROM users WHERE role = 'CLINICIAN' ORDER BY name")
        .fetch_all(&st.pool)
        .await?;
    Ok(Json(json!({ "clinicians": users.iter().map(convert::clinician_dto).collect::<Vec<_>>() })))
}
