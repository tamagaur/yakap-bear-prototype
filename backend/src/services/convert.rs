//! Row → DTO conversion and shared SELECT fragments.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;

use crate::{
    dto::*,
    models::*,
    time::{iso, iso_opt},
};

pub const ONLINE_THRESHOLD_SECS: i64 = 30;
/// ≈ 6 months of alerts & app included with the bear.
pub const PLAN_INCLUDED_DAYS: i64 = 183;

#[macro_export]
macro_rules! dose_select {
    () => {
        "SELECT e.*, s.label, s.pill_note FROM dose_events e JOIN dose_schedules s ON s.id = e.schedule_id"
    };
}

#[macro_export]
macro_rules! alert_select {
    () => {
        "SELECT a.*, u.name AS acknowledged_by_name,
                (SELECT count(*) FROM sms_messages m WHERE m.alert_id = a.id) AS sms_count
         FROM alerts a LEFT JOIN users u ON u.id = a.acknowledged_by_id"
    };
}

#[macro_export]
macro_rules! voice_select {
    () => {
        "SELECT v.id, v.patient_id, v.title, v.mime_type, v.duration_sec, v.size_bytes,
                u.name AS recorded_by_name, v.is_sample, v.created_at, v.updated_at
         FROM voice_messages v LEFT JOIN users u ON u.id = v.recorded_by_id"
    };
}

#[macro_export]
macro_rules! away_select {
    () => {
        "SELECT a.id, a.patient_id, a.start_date, a.end_date, a.starts_at, a.ends_at, a.reason, a.note,
                u.name AS created_by_name, a.cancelled_at
         FROM away_periods a JOIN users u ON u.id = a.created_by_id"
    };
}

#[macro_export]
macro_rules! schedule_select {
    () => {
        "SELECT s.*, v.title AS voice_title FROM dose_schedules s
         LEFT JOIN voice_messages v ON v.id = s.voice_message_id"
    };
}

pub fn user_dto(u: &User) -> AuthUserDto {
    AuthUserDto {
        id: u.id.clone(),
        name: u.name.clone(),
        email: u.email.clone(),
        role: u.role.clone(),
        clinic_name: u.clinic_name.clone(),
        title: u.title.clone(),
    }
}

pub fn clinician_dto(u: &User) -> ClinicianDto {
    ClinicianDto { id: u.id.clone(), name: u.name.clone(), title: u.title.clone(), clinic_name: u.clinic_name.clone() }
}

pub fn device_dto(d: &BearDevice) -> DeviceDto {
    DeviceDto {
        id: d.id.clone(),
        battery_pct: d.battery_pct,
        low_battery: d.battery_pct <= crate::dose_rules::LOW_BATTERY_PCT,
        online: d.last_seen_at.is_some_and(|t| (Utc::now() - t).num_seconds() < ONLINE_THRESHOLD_SECS),
        last_seen_at: iso_opt(d.last_seen_at),
    }
}

pub fn patient_dto(
    p: &Patient,
    device: Option<&BearDevice>,
    relationship: Option<String>,
    now: DateTime<Utc>,
    away_now: bool,
) -> PatientDto {
    let until = p.plan_started_at + Duration::days(PLAN_INCLUDED_DAYS);
    let secs = (until - now).num_seconds();
    let days_left = if secs <= 0 { 0 } else { (secs + 86_399) / 86_400 };
    PatientDto {
        id: p.id.clone(),
        full_name: p.full_name.clone(),
        nickname: p.nickname.clone(),
        birth_year: p.birth_year,
        notes: p.notes.clone(),
        relationship,
        device: device.map(device_dto),
        plan: PlanDto {
            included_until: iso(until),
            days_left,
            status: if days_left > 0 { "INCLUDED" } else { "EXPIRED" },
        },
        away_now,
    }
}

pub fn contact_dto(c: &FamilyContact) -> ContactDto {
    ContactDto {
        id: c.id.clone(),
        name: c.name.clone(),
        relationship: c.relationship.clone(),
        phone: c.phone.clone(),
        receives_sms: c.receives_sms,
    }
}

pub fn schedule_dto(s: &ScheduleWithVoice) -> ScheduleDto {
    ScheduleDto {
        id: s.schedule.id.clone(),
        label: s.schedule.label.clone(),
        time_of_day: s.schedule.time_of_day.clone(),
        window_minutes: s.schedule.window_minutes,
        late_minutes: s.schedule.late_minutes,
        pill_note: s.schedule.pill_note.clone(),
        voice_message_id: s.schedule.voice_message_id.clone(),
        voice_title: s.voice_title.clone(),
    }
}

pub fn correction_dto(c: &DoseCorrection) -> CorrectionDto {
    CorrectionDto {
        id: c.id.clone(),
        from_status: c.from_status.clone(),
        to_status: c.to_status.clone(),
        from_taken_at: iso_opt(c.from_taken_at),
        to_taken_at: iso_opt(c.to_taken_at),
        reason: c.reason.clone(),
        corrected_by_name: c.corrected_by_name.clone(),
        corrected_at: iso(c.corrected_at),
    }
}

pub fn dose_dto(e: &DoseEventFull, corrections: Vec<CorrectionDto>) -> DoseEventDto {
    let w = e.event.windows();
    DoseEventDto {
        id: e.event.id.clone(),
        schedule_id: e.event.schedule_id.clone(),
        label: e.label.clone(),
        pill_note: e.pill_note.clone(),
        scheduled_for: iso(e.event.scheduled_for),
        window_start: iso(w.window_start),
        on_time_end: iso(w.on_time_end),
        late_end: iso(w.late_end),
        status: e.event.status.clone(),
        taken_at: iso_opt(e.event.taken_at),
        hold_ms: e.event.hold_ms,
        logged_by: e.event.logged_by.clone(),
        reminder_count: e.event.reminder_count,
        corrected: e.event.corrected,
        original_status: e.event.original_status.clone(),
        corrections,
    }
}

/// Converts dose rows and attaches their correction history (one query).
pub async fn dose_dtos(pool: &PgPool, rows: Vec<DoseEventFull>) -> sqlx::Result<Vec<DoseEventDto>> {
    let corrected: Vec<String> = rows.iter().filter(|r| r.event.corrected).map(|r| r.event.id.clone()).collect();
    let mut by_event: HashMap<String, Vec<CorrectionDto>> = HashMap::new();
    if !corrected.is_empty() {
        let corrections = sqlx::query_as::<_, DoseCorrection>(
            "SELECT c.*, u.name AS corrected_by_name FROM dose_corrections c
             JOIN users u ON u.id = c.corrected_by_id
             WHERE c.dose_event_id = ANY($1) ORDER BY c.corrected_at ASC",
        )
        .bind(&corrected)
        .fetch_all(pool)
        .await?;
        for c in &corrections {
            by_event.entry(c.dose_event_id.clone()).or_default().push(correction_dto(c));
        }
    }
    Ok(rows
        .iter()
        .map(|r| dose_dto(r, by_event.remove(&r.event.id).unwrap_or_default()))
        .collect())
}

pub fn voice_dto(v: &VoiceMeta, assigned: Vec<AssignedToDto>) -> VoiceMessageDto {
    VoiceMessageDto {
        id: v.id.clone(),
        title: v.title.clone(),
        mime_type: v.mime_type.clone(),
        duration_sec: v.duration_sec,
        size_bytes: v.size_bytes,
        recorded_by_name: v.recorded_by_name.clone(),
        is_sample: v.is_sample,
        created_at: iso(v.created_at),
        updated_at: iso(v.updated_at),
        audio_url: format!("/api/voice/{}/audio?v={}", v.id, v.updated_at.timestamp_millis()),
        assigned_to: assigned,
    }
}

pub fn alert_dto(a: &Alert) -> AlertDto {
    AlertDto {
        id: a.id.clone(),
        alert_type: a.alert_type.clone(),
        title: a.title.clone(),
        message: a.message.clone(),
        created_at: iso(a.created_at),
        acknowledged_at: iso_opt(a.acknowledged_at),
        acknowledged_by_name: a.acknowledged_by_name.clone(),
        resolved_at: iso_opt(a.resolved_at),
        resolution: a.resolution.clone(),
        dose_event_id: a.dose_event_id.clone(),
        sms_count: a.sms_count,
    }
}

pub fn sms_dto(s: &SmsMessage) -> SmsDto {
    SmsDto {
        id: s.id.clone(),
        to_name: s.to_name.clone(),
        to_phone: s.to_phone.clone(),
        body: s.body.clone(),
        sent_at: iso(s.sent_at),
        alert_id: s.alert_id.clone(),
    }
}

pub fn consent_dto(c: &ConsentFull) -> ConsentDto {
    ConsentDto {
        id: c.id.clone(),
        clinician: ClinicianDto {
            id: c.clinician_id.clone(),
            name: c.clinician_name.clone(),
            title: c.clinician_title.clone(),
            clinic_name: c.clinician_clinic.clone(),
        },
        granted_by_name: c.granted_by_name.clone(),
        signed_name: c.signed_name.clone(),
        signature_data_url: c.signature_data_url.clone(),
        consent_version: c.consent_version.clone(),
        granted_at: iso(c.granted_at),
        revoked_at: iso_opt(c.revoked_at),
        revoked_by_name: c.revoked_by_name.clone(),
        active: c.revoked_at.is_none(),
    }
}

pub fn away_dto(a: &AwayPeriod, now: DateTime<Utc>) -> AwayDto {
    let state = if a.cancelled_at.is_some() {
        "CANCELLED"
    } else if now < a.starts_at {
        "UPCOMING"
    } else if now >= a.ends_at {
        "ENDED"
    } else {
        "ACTIVE"
    };
    AwayDto {
        id: a.id.clone(),
        start_date: a.start_date.clone(),
        end_date: a.end_date.clone(),
        reason: a.reason.clone(),
        note: a.note.clone(),
        created_by_name: a.created_by_name.clone(),
        state,
    }
}
