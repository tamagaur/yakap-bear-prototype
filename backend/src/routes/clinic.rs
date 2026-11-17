//! Clinic dashboard API (tasks D1–D10). Every patient endpoint requires an
//! active written consent for the signed-in clinician; views and exports are
//! audited; clinic admins get the audit log, not patient records.

use axum::{
    Json, Router,
    body::Body,
    extract::{Path, State},
    http::header,
    response::Response,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    AppState,
    auth::{ClinicUser, require_clinician_patient},
    dose_rules::DoseStatus,
    dto::{AdherenceSummaryDto, ClinicOverviewDto, ClinicPatientDetailDto, PatternDto},
    error::{ApiError, ApiResult},
    extract::{ApiJson, ApiQuery},
    models::Role,
    routes::doses::parse_statuses,
    services::{
        audit::{self, AuditEntry},
        clinic::{self, SortField},
        clock, dose_engine, insights,
    },
    time, validate,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/clinic/overview", get(overview))
        .route("/clinic/patients", get(patients))
        .route("/clinic/patients/{patient_id}", get(detail))
        .route("/clinic/patients/{patient_id}/doses", get(doses))
        .route("/clinic/patients/{patient_id}/summary", get(summary))
        .route("/clinic/patients/{patient_id}/pattern", get(pattern))
        .route("/clinic/patients/{patient_id}/export.csv", get(export_csv))
        .route("/clinic/patients/{patient_id}/export-log", post(export_pdf))
        .route("/clinic/audit", get(audit_log))
}

/// Dashboard home page. Clinicians get totals across their consented patients;
/// clinic admins get clinic-wide consent/audit counts (no patient dose data).
async fn overview(State(st): State<AppState>, ClinicUser(user): ClinicUser) -> ApiResult<Json<ClinicOverviewDto>> {
    let now = clock::now(&st.pool).await?;
    let is_admin = user.role() == Some(Role::ClinicAdmin);
    Ok(Json(ClinicOverviewDto {
        role: user.role.clone(),
        clinic_name: user.clinic_name.clone(),
        now: time::iso(now),
        clinician: if is_admin { None } else { Some(clinic::clinician_overview(&st.pool, &user, now).await?) },
        admin: if is_admin { Some(clinic::admin_overview(&st.pool, &user, now).await?) } else { None },
    }))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

/// Only patients whose family consented to this clinician.
async fn patients(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    ApiQuery(q): ApiQuery<SearchQuery>,
) -> ApiResult<Json<Value>> {
    if user.role() != Some(Role::Clinician) {
        return Ok(Json(json!({ "patients": [], "role": user.role })));
    }
    let search: Option<String> = q.q.map(|s| s.trim().chars().take(60).collect()).filter(|s: &String| !s.is_empty());
    let now = clock::now(&st.pool).await?;
    let rows = clinic::patient_rows(&st.pool, &user, search.as_deref(), now).await?;
    Ok(Json(json!({ "patients": rows, "role": user.role })))
}

async fn detail(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
) -> ApiResult<Json<ClinicPatientDetailDto>> {
    let (patient, consent) = require_clinician_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    audit::record_patient_view(&mut *st.pool.acquire().await?, &user, &patient_id, now, "overview").await?;
    Ok(Json(clinic::patient_detail(&st.pool, &patient, &consent, now).await?))
}

#[derive(Deserialize)]
struct DoseQuery {
    from: Option<String>,
    to: Option<String>,
    status: Option<String>,
    sort: Option<String>,
    order: Option<String>,
}

struct Range {
    from: chrono::NaiveDate,
    to: chrono::NaiveDate,
}

fn parse_range(from: Option<&str>, to: Option<&str>, now: chrono::DateTime<chrono::Utc>) -> ApiResult<Range> {
    let to = match to {
        Some(t) => validate::date_key(t, "to")?,
        None => time::date_of(now),
    };
    let from = match from {
        Some(f) => validate::date_key(f, "from")?,
        None => time::add_days(to, -29),
    };
    if from > to {
        return Err(ApiError::bad_request("`from` must be before `to`."));
    }
    Ok(Range { from, to })
}

const FINAL: [DoseStatus; 4] = [DoseStatus::Taken, DoseStatus::Late, DoseStatus::Missed, DoseStatus::Away];

async fn doses(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
    ApiQuery(q): ApiQuery<DoseQuery>,
) -> ApiResult<Json<Value>> {
    require_clinician_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    let r = parse_range(q.from.as_deref(), q.to.as_deref(), now)?;
    let statuses = parse_statuses(q.status.as_deref())?.unwrap_or_else(|| FINAL.to_vec());
    let sort = match q.sort.as_deref() {
        None | Some("scheduledFor") => SortField::ScheduledFor,
        Some("status") => SortField::Status,
        Some(_) => return Err(ApiError::validation("sort", "Use scheduledFor or status")),
    };
    let ascending = match q.order.as_deref() {
        None | Some("desc") => false,
        Some("asc") => true,
        Some(_) => return Err(ApiError::validation("order", "Use asc or desc")),
    };
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    audit::record_patient_view(&mut *st.pool.acquire().await?, &user, &patient_id, now, "dose-log").await?;
    let rows = clinic::dose_rows(&st.pool, &patient_id, r.from, r.to, &statuses, sort, ascending, now).await?;
    Ok(Json(json!({ "from": time::key(r.from), "to": time::key(r.to), "doses": rows })))
}

#[derive(Deserialize)]
struct DaysQuery {
    days: Option<i64>,
}

async fn summary(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
    ApiQuery(q): ApiQuery<DaysQuery>,
) -> ApiResult<Json<AdherenceSummaryDto>> {
    require_clinician_patient(&st, &user, &patient_id).await?;
    let days = q.days.unwrap_or(7);
    if !(1..=90).contains(&days) {
        return Err(ApiError::validation("days", "days must be 1–90"));
    }
    let now = clock::now(&st.pool).await?;
    dose_engine::evaluate_patient(&st.pool, &patient_id, now).await?;
    Ok(Json(insights::adherence_summary(&st.pool, &patient_id, days, now).await?))
}

async fn pattern(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
    ApiQuery(q): ApiQuery<DaysQuery>,
) -> ApiResult<Json<PatternDto>> {
    require_clinician_patient(&st, &user, &patient_id).await?;
    let days = q.days.unwrap_or(28);
    if !(7..=90).contains(&days) {
        return Err(ApiError::validation("days", "days must be 7–90"));
    }
    let now = clock::now(&st.pool).await?;
    Ok(Json(insights::weekly_pattern(&st.pool, &patient_id, days, now).await?))
}

#[derive(Deserialize)]
struct ExportQuery {
    from: Option<String>,
    to: Option<String>,
}

/// CSV download — recorded in the audit log.
async fn export_csv(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
    ApiQuery(q): ApiQuery<ExportQuery>,
) -> ApiResult<Response> {
    let (patient, _) = require_clinician_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    let r = parse_range(q.from.as_deref(), q.to.as_deref(), now)?;
    let rows = clinic::dose_rows(&st.pool, &patient_id, r.from, r.to, &FINAL, SortField::ScheduledFor, true, now).await?;
    audit::record(
        &mut *st.pool.acquire().await?,
        AuditEntry {
            actor: Some(&user),
            action: "EXPORT_CSV",
            patient_id: Some(&patient_id),
            clinic_name: user.clinic_name.as_deref(),
            details: json!({ "format": "csv", "from": time::key(r.from), "to": time::key(r.to), "rows": rows.len() }),
            sim_time: now,
        },
    )
    .await?;
    let slug: String = patient
        .full_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let filename = format!("yakap-{slug}-dose-log-{}-to-{}.csv", time::key(r.from), time::key(r.to));
    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{filename}\""))
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from(clinic::doses_to_csv(&patient.full_name, &rows)))
        .expect("response"))
}

#[derive(Deserialize)]
struct PdfBody {
    format: String,
    from: Option<String>,
    to: Option<String>,
}

/// Authorizes + audits a PDF export and returns the rows the browser renders.
async fn export_pdf(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    Path(patient_id): Path<String>,
    ApiJson(b): ApiJson<PdfBody>,
) -> ApiResult<Json<Value>> {
    // "pdf" = browser-built PDF of the dose log; "print" = the one-page check-up sheet.
    let (action, format) = match b.format.as_str() {
        "pdf" => ("EXPORT_PDF", "pdf"),
        "print" => ("PRINT_CHECKUP", "print"),
        _ => return Err(ApiError::validation("format", "Use pdf or print (CSV uses export.csv)")),
    };
    let (patient, consent) = require_clinician_patient(&st, &user, &patient_id).await?;
    let now = clock::now(&st.pool).await?;
    let r = parse_range(b.from.as_deref(), b.to.as_deref(), now)?;
    let rows = clinic::dose_rows(&st.pool, &patient_id, r.from, r.to, &FINAL, SortField::ScheduledFor, true, now).await?;
    let summary = insights::adherence_summary(&st.pool, &patient_id, 30, now).await?;
    audit::record(
        &mut *st.pool.acquire().await?,
        AuditEntry {
            actor: Some(&user),
            action,
            patient_id: Some(&patient_id),
            clinic_name: user.clinic_name.as_deref(),
            details: json!({ "format": format, "from": time::key(r.from), "to": time::key(r.to), "rows": rows.len() }),
            sim_time: now,
        },
    )
    .await?;
    Ok(Json(json!({
        "patient": { "fullName": patient.full_name, "nickname": patient.nickname, "birthYear": patient.birth_year },
        "clinician": { "name": user.name, "clinicName": user.clinic_name },
        "consent": { "grantedAt": time::iso(consent.granted_at), "signedName": consent.signed_name },
        "from": time::key(r.from),
        "to": time::key(r.to),
        "generatedAt": time::iso(now),
        "summary": summary,
        "doses": rows,
    })))
}

#[derive(Deserialize)]
struct AuditQuery {
    action: Option<String>,
}

const AUDIT_ACTIONS: &[&str] =
    &["VIEW_PATIENT", "EXPORT_CSV", "EXPORT_PDF", "PRINT_CHECKUP", "CORRECT_LOG", "CONSENT_GRANT", "CONSENT_REVOKE"];

/// Clinic admins only: this clinic's views/exports, consent changes involving
/// its clinicians, and family corrections on patients who consented to it.
async fn audit_log(
    State(st): State<AppState>,
    ClinicUser(user): ClinicUser,
    ApiQuery(q): ApiQuery<AuditQuery>,
) -> ApiResult<Json<Value>> {
    if user.role() != Some(Role::ClinicAdmin) {
        return Err(ApiError::forbidden("Only clinic administrators can open the audit log."));
    }
    if let Some(a) = &q.action {
        if !AUDIT_ACTIONS.contains(&a.as_str()) {
            return Err(ApiError::validation("action", "Unknown audit action"));
        }
    }
    let clinic = user.clinic_name.clone().unwrap_or_default();
    let entries = clinic::clinic_audit(&st.pool, &clinic, q.action.as_deref(), 300).await?;
    Ok(Json(json!({ "entries": entries, "clinicName": clinic })))
}
