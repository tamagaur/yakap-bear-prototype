//! Clinic dashboard queries (tasks D2, D3, D4, D8). Callers enforce consent first.

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;

use chrono::Duration;

use crate::{
    dose_rules::{DoseStatus, summarize_adherence},
    dose_select,
    dto::{
        AdminOverviewDto, AttentionDto, AuditEntryDto, ClinicAwayDto, ClinicConsentDto, ClinicPatientDetailDto,
        ClinicPatientRowDto, ClinicianOverviewDto, DoseEventDto, LastDoseDto, NameRelationDto, RecentMissedDto,
        TodayCountsDto,
    },
    models::{AuditRow, ConsentFull, DoseEventFull, FamilyContact, Patient, ScheduleWithVoice, User},
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

/// Clinician home page: totals across patients who consented to THIS clinician only.
pub async fn clinician_overview(pool: &PgPool, clinician: &User, now: DateTime<Utc>) -> sqlx::Result<ClinicianOverviewDto> {
    let rows = patient_rows(pool, clinician, None, now).await?; // also brings dose state up to date
    let ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let today = time::date_of(now);
    let week_start = time::start_of_day(time::add_days(today, -6));

    let week_counts: Vec<(String, i64)> = sqlx::query_as(
        "SELECT status, count(*) FROM dose_events
         WHERE patient_id = ANY($1) AND scheduled_for >= $2 AND scheduled_for <= $3
           AND status IN ('TAKEN', 'LATE', 'MISSED', 'AWAY')
         GROUP BY status",
    )
    .bind(&ids)
    .bind(week_start)
    .bind(now)
    .fetch_all(pool)
    .await?;
    let week = summarize_adherence(week_counts.iter().flat_map(|(s, n)| {
        std::iter::repeat_n(DoseStatus::parse(s).unwrap_or(DoseStatus::Upcoming), *n as usize)
    }));

    let today_counts: Vec<(String, i64)> = sqlx::query_as(
        "SELECT status, count(*) FROM dose_events
         WHERE patient_id = ANY($1) AND scheduled_for >= $2 AND scheduled_for < $3
         GROUP BY status",
    )
    .bind(&ids)
    .bind(time::start_of_day(today))
    .bind(time::start_of_day(time::add_days(today, 1)))
    .fetch_all(pool)
    .await?;
    let mut today_dto = TodayCountsDto::default();
    for (s, n) in today_counts {
        match s.as_str() {
            "TAKEN" => today_dto.taken += n,
            "LATE" => today_dto.late += n,
            "MISSED" => today_dto.missed += n,
            "AWAY" => today_dto.away += n,
            _ => today_dto.upcoming += n,
        }
    }

    let mut needs_attention: Vec<AttentionDto> = rows
        .iter()
        .filter(|r| r.has_data && !r.away_now)
        .filter_map(|r| {
            let mut reasons = Vec::new();
            if r.missed7 >= 2 {
                reasons.push(format!("{} missed doses in the last 7 days", r.missed7));
            }
            if let Some(p) = r.on_time_pct7.filter(|p| *p < 70) {
                reasons.push(format!("only {p}% on time this week"));
            }
            (!reasons.is_empty()).then(|| AttentionDto {
                id: r.id.clone(),
                full_name: r.full_name.clone(),
                nickname: r.nickname.clone(),
                missed7: r.missed7,
                on_time_pct7: r.on_time_pct7,
                reasons,
            })
        })
        .collect();
    needs_attention.sort_by(|a, b| b.missed7.cmp(&a.missed7).then(a.on_time_pct7.cmp(&b.on_time_pct7)));

    let recent: Vec<(String, String, String, DateTime<Utc>, String)> = sqlx::query_as(
        "SELECT p.id, p.full_name, p.nickname, e.scheduled_for, s.label
         FROM dose_events e
         JOIN patients p ON p.id = e.patient_id
         JOIN dose_schedules s ON s.id = e.schedule_id
         WHERE e.patient_id = ANY($1) AND e.status = 'MISSED' AND e.scheduled_for >= $2
         ORDER BY e.scheduled_for DESC LIMIT 6",
    )
    .bind(&ids)
    .bind(week_start)
    .fetch_all(pool)
    .await?;

    Ok(ClinicianOverviewDto {
        patients: rows.len() as i64,
        with_data: rows.iter().filter(|r| r.has_data).count() as i64,
        away_now: rows.iter().filter(|r| r.away_now).count() as i64,
        week,
        today: today_dto,
        needs_attention,
        recent_missed: recent
            .into_iter()
            .map(|(patient_id, full_name, nickname, at, label)| RecentMissedDto {
                patient_id,
                full_name,
                nickname,
                scheduled_for: iso(at),
                label,
            })
            .collect(),
    })
}

/// Audit entries a clinic admin may see: this clinic's views/exports, consent
/// changes involving its clinicians, and family corrections on patients who
/// consented to it.
pub async fn clinic_audit(
    pool: &PgPool,
    clinic: &str,
    action: Option<&str>,
    limit: i64,
) -> sqlx::Result<Vec<AuditEntryDto>> {
    let rows = sqlx::query_as::<_, AuditRow>(
        "SELECT a.id, a.action, a.actor_name, a.actor_role, p.full_name AS patient_name, a.clinic_name,
                a.details, a.sim_time, a.created_at
         FROM audit_log a LEFT JOIN patients p ON p.id = a.patient_id
         WHERE (a.clinic_name = $1
                OR (a.action = 'CORRECT_LOG' AND a.patient_id IN (
                      SELECT c.patient_id FROM consents c JOIN users u ON u.id = c.clinician_id WHERE u.clinic_name = $1)))
           AND ($2::text IS NULL OR a.action = $2)
         ORDER BY a.sim_time DESC LIMIT $3",
    )
    .bind(clinic)
    .bind(action)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| AuditEntryDto {
            id: r.id,
            action: r.action,
            actor_name: r.actor_name,
            actor_role: r.actor_role,
            patient_name: r.patient_name,
            clinic_name: r.clinic_name,
            details: r.details,
            sim_time: iso(r.sim_time),
            created_at: iso(r.created_at),
        })
        .collect())
}

/// Clinic-admin home page: clinic-wide counts — no patient dose data.
pub async fn admin_overview(pool: &PgPool, admin: &User, now: DateTime<Utc>) -> sqlx::Result<AdminOverviewDto> {
    let clinic = admin.clinic_name.clone().unwrap_or_default();
    let clinicians: i64 =
        sqlx::query_scalar("SELECT count(*) FROM users WHERE role = 'CLINICIAN' AND clinic_name = $1")
            .bind(&clinic)
            .fetch_one(pool)
            .await?;
    let (active_consents, consenting_patients): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(DISTINCT c.patient_id) FROM consents c
         JOIN users u ON u.id = c.clinician_id
         WHERE u.clinic_name = $1 AND c.revoked_at IS NULL",
    )
    .bind(&clinic)
    .fetch_one(pool)
    .await?;
    let activity: Vec<(String, i64)> = sqlx::query_as(
        "SELECT a.action, count(*) FROM audit_log a
         WHERE (a.clinic_name = $1
                OR (a.action = 'CORRECT_LOG' AND a.patient_id IN (
                      SELECT c.patient_id FROM consents c JOIN users u ON u.id = c.clinician_id WHERE u.clinic_name = $1)))
           AND a.sim_time >= $2 AND a.sim_time <= $3
         GROUP BY a.action",
    )
    .bind(&clinic)
    .bind(now - Duration::days(7))
    .bind(now)
    .fetch_all(pool)
    .await?;
    let count = |names: &[&str]| activity.iter().filter(|(a, _)| names.contains(&a.as_str())).map(|(_, n)| n).sum();
    Ok(AdminOverviewDto {
        clinicians,
        active_consents,
        consenting_patients,
        views7: count(&["VIEW_PATIENT"]),
        exports7: count(&["EXPORT_CSV", "EXPORT_PDF"]),
        consent_changes7: count(&["CONSENT_GRANT", "CONSENT_REVOKE"]),
        corrections7: count(&["CORRECT_LOG"]),
        recent_activity: clinic_audit(pool, &clinic, None, 6).await?,
    })
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
