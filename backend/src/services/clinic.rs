//! Clinic dashboard queries (tasks D2, D3, D4, D8). Callers enforce consent first.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;

use crate::{
    dose_rules::DoseStatus,
    dose_select,
    dto::{
        ClinicAwayDto, ClinicConsentDto, ClinicPatientDetailDto, ClinicPatientRowDto, DoseEventDto, LastDoseDto,
        NameRelationDto,
    },
    models::{ConsentFull, DoseEventFull, FamilyContact, Patient, ScheduleWithVoice, User},
    schedule_select,
    services::{convert, dose_engine, insights},
    time::{self, format_time, iso},
};

#[derive(sqlx::FromRow)]
struct ConsentedPatient {
    #[sqlx(flatten)]
    patient: Patient,
    granted_at: DateTime<Utc>,
}

/// Escapes LIKE wildcards in user search text.
fn like_pattern(q: &str) -> String {
    let escaped = q.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

pub async fn patient_rows(
    pool: &PgPool,
    clinician: &User,
    q: Option<&str>,
    now: DateTime<Utc>,
) -> sqlx::Result<Vec<ClinicPatientRowDto>> {
    let rows = sqlx::query_as::<_, ConsentedPatient>(
        "SELECT p.*, c.granted_at FROM consents c JOIN patients p ON p.id = c.patient_id
         WHERE c.clinician_id = $1 AND c.revoked_at IS NULL
           AND ($2::text IS NULL OR p.full_name ILIKE $2 OR p.nickname ILIKE $2)
         ORDER BY p.full_name",
    )
    .bind(&clinician.id)
    .bind(q.map(like_pattern))
    .fetch_all(pool)
    .await?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let pid = &r.patient.id;
        dose_engine::evaluate_patient(pool, pid, now).await?;
        let s7 = insights::adherence_summary(pool, pid, 7, now).await?;
        let s30 = insights::adherence_summary(pool, pid, 30, now).await?;
        let last: Option<(DateTime<Utc>, String, String)> = sqlx::query_as(
            "SELECT e.scheduled_for, e.status, s.label FROM dose_events e JOIN dose_schedules s ON s.id = e.schedule_id
             WHERE e.patient_id = $1 AND e.status IN ('TAKEN', 'LATE', 'MISSED', 'AWAY') AND e.scheduled_for <= $2
             ORDER BY e.scheduled_for DESC LIMIT 1",
        )
        .bind(pid)
        .bind(now)
        .fetch_optional(pool)
        .await?;
        let logged: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM dose_events WHERE patient_id = $1 AND status IN ('TAKEN', 'LATE', 'MISSED')",
        )
        .bind(pid)
        .fetch_one(pool)
        .await?;
        out.push(ClinicPatientRowDto {
            id: r.patient.id.clone(),
            full_name: r.patient.full_name.clone(),
            nickname: r.patient.nickname.clone(),
            birth_year: r.patient.birth_year,
            consent_since: iso(r.granted_at),
            on_time_pct7: s7.counts.on_time_pct,
            adherence_pct30: s30.counts.adherence_pct,
            missed7: s7.counts.missed,
            last_dose: last.map(|(t, status, label)| LastDoseDto { scheduled_for: iso(t), status, label }),
            away_now: dose_engine::is_away_now(pool, pid, now).await?,
            has_data: logged > 0,
        });
    }
    Ok(out)
}

pub async fn patient_detail(
    pool: &PgPool,
    patient: &Patient,
    consent: &ConsentFull,
    now: DateTime<Utc>,
) -> sqlx::Result<ClinicPatientDetailDto> {
    dose_engine::evaluate_patient(pool, &patient.id, now).await?;
    let contacts =
        sqlx::query_as::<_, FamilyContact>("SELECT * FROM family_contacts WHERE patient_id = $1 ORDER BY created_at")
            .bind(&patient.id)
            .fetch_all(pool)
            .await?;
    let schedules = sqlx::query_as::<_, ScheduleWithVoice>(concat!(
        schedule_select!(),
        " WHERE s.patient_id = $1 AND s.active AND s.deleted_at IS NULL ORDER BY s.time_of_day"
    ))
    .bind(&patient.id)
    .fetch_all(pool)
    .await?;
    let away: Vec<(String, String, String, DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
        "SELECT start_date, end_date, reason, starts_at, ends_at FROM away_periods
         WHERE patient_id = $1 AND cancelled_at IS NULL ORDER BY starts_at DESC LIMIT 5",
    )
    .bind(&patient.id)
    .fetch_all(pool)
    .await?;
    let recent = sqlx::query_as::<_, DoseEventFull>(concat!(
        dose_select!(),
        " WHERE e.patient_id = $1 AND e.scheduled_for <= $2 AND e.status IN ('TAKEN', 'LATE', 'MISSED', 'AWAY')
          ORDER BY e.scheduled_for DESC LIMIT 10"
    ))
    .bind(&patient.id)
    .bind(now)
    .fetch_all(pool)
    .await?;
    let first: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT min(scheduled_for) FROM dose_events WHERE patient_id = $1 AND status IN ('TAKEN', 'LATE', 'MISSED', 'AWAY')",
    )
    .bind(&patient.id)
    .fetch_one(pool)
    .await?;
    Ok(ClinicPatientDetailDto {
        id: patient.id.clone(),
        full_name: patient.full_name.clone(),
        nickname: patient.nickname.clone(),
        birth_year: patient.birth_year,
        consent: ClinicConsentDto {
            id: consent.id.clone(),
            granted_at: iso(consent.granted_at),
            signed_name: consent.signed_name.clone(),
            granted_by_name: consent.granted_by_name.clone(),
            consent_version: consent.consent_version.clone(),
        },
        family_contacts: contacts
            .iter()
            .map(|c| NameRelationDto { name: c.name.clone(), relationship: c.relationship.clone() })
            .collect(),
        // Voice messages are family content — never shared with clinicians.
        schedules: schedules
            .iter()
            .map(|s| {
                let mut d = convert::schedule_dto(s);
                d.voice_message_id = None;
                d.voice_title = None;
                d
            })
            .collect(),
        away_periods: away
            .into_iter()
            .map(|(start_date, end_date, reason, s, e)| ClinicAwayDto {
                start_date,
                end_date,
                reason,
                active: s <= now && now < e,
            })
            .collect(),
        recent: convert::dose_dtos(pool, recent).await?,
        first_dose_date: first.map(time::date_key),
        now: iso(now),
    })
}

#[derive(Clone, Copy, Debug)]
pub enum SortField {
    ScheduledFor,
    Status,
}

pub async fn dose_rows(
    pool: &PgPool,
    patient_id: &str,
    from: NaiveDate,
    to: NaiveDate,
    statuses: &[DoseStatus],
    sort: SortField,
    ascending: bool,
    now: DateTime<Utc>,
) -> sqlx::Result<Vec<DoseEventDto>> {
    let end = time::start_of_day(time::add_days(to, 1)).min(now);
    let statuses: Vec<String> = statuses.iter().map(|s| s.as_str().to_string()).collect();
    let sql: &'static str = match (sort, ascending) {
        (SortField::ScheduledFor, true) => concat!(
            dose_select!(),
            " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 AND e.status = ANY($4)
              ORDER BY e.scheduled_for ASC"
        ),
        (SortField::ScheduledFor, false) => concat!(
            dose_select!(),
            " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 AND e.status = ANY($4)
              ORDER BY e.scheduled_for DESC"
        ),
        (SortField::Status, true) => concat!(
            dose_select!(),
            " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 AND e.status = ANY($4)
              ORDER BY e.status ASC, e.scheduled_for DESC"
        ),
        (SortField::Status, false) => concat!(
            dose_select!(),
            " WHERE e.patient_id = $1 AND e.scheduled_for >= $2 AND e.scheduled_for < $3 AND e.status = ANY($4)
              ORDER BY e.status DESC, e.scheduled_for DESC"
        ),
    };
    let rows = sqlx::query_as::<_, DoseEventFull>(sql)
        .bind(patient_id)
        .bind(time::start_of_day(from))
        .bind(end)
        .bind(&statuses)
        .fetch_all(pool)
        .await?;
    convert::dose_dtos(pool, rows).await
}

pub fn logged_by_label(l: Option<&str>) -> &'static str {
    match l {
        Some("BEAR") => "Bear (paw hold)",
        Some("OFFLINE_SYNC") => "Bear (synced after offline)",
        Some("FAMILY") => "Family correction",
        _ => "—",
    }
}

fn status_label(s: &str) -> &'static str {
    DoseStatus::parse(s).map(|s| s.label()).unwrap_or("Unknown")
}

fn csv_cell(v: &str) -> String {
    if v.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_string()
    }
}

pub fn doses_to_csv(patient_name: &str, doses: &[DoseEventDto]) -> String {
    let mut out = String::from("\u{FEFF}");
    out.push_str(
        "Patient,Date,Dose,Scheduled time,Status,Recorded at,Logged by,Corrected,Original status,Correction reason\r\n",
    );
    for d in doses {
        let scheduled: DateTime<Utc> = d.scheduled_for.parse().unwrap_or_else(|_| Utc::now());
        let taken = d.taken_at.as_deref().and_then(|t| t.parse::<DateTime<Utc>>().ok());
        let cells = [
            patient_name.to_string(),
            time::date_key(scheduled),
            d.label.clone(),
            format_time(scheduled),
            status_label(&d.status).to_string(),
            taken.map(format_time).unwrap_or_default(),
            logged_by_label(d.logged_by.as_deref()).to_string(),
            if d.corrected { "Yes".into() } else { "No".into() },
            d.original_status.as_deref().map(status_label).unwrap_or("").to_string(),
            d.corrections.last().map(|c| c.reason.clone()).unwrap_or_default(),
        ];
        out.push_str(&cells.iter().map(|c| csv_cell(c)).collect::<Vec<_>>().join(","));
        out.push_str("\r\n");
    }
    out
}
