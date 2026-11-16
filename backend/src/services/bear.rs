//! The bear's view of the world (tasks S1, S4, S5): the current dose, whether
//! the reminder should play, and upcoming doses cached for offline memory.

use chrono::{DateTime, Duration, Utc};
use sqlx::{FromRow, PgPool};

use crate::{
    dose_rules::{DoseStatus, LOW_BATTERY_PCT, TimeRange, is_within_away, reminder_due},
    dto::{BearDeviceStateDto, BearDoseDto, BearPatientDto, BearStateDto, BearVoiceDto, ReminderResultDto},
    error::{ApiError, ApiResult},
    models::{BearDevice, DoseEvent, Patient},
    time::{iso, iso_opt},
};

#[derive(FromRow)]
struct DoseWithVoice {
    #[sqlx(flatten)]
    event: DoseEvent,
    label: String,
    pill_note: Option<String>,
    voice_id: Option<String>,
    voice_title: Option<String>,
    voice_is_sample: Option<bool>,
    voice_by: Option<String>,
}

#[derive(FromRow)]
struct VoiceRef {
    id: String,
    title: String,
    is_sample: bool,
    recorded_by_name: Option<String>,
}

/// Latest family recording (real recordings preferred over the sample chime).
async fn fallback_voice(pool: &PgPool, patient_id: &str) -> sqlx::Result<Option<BearVoiceDto>> {
    let v = sqlx::query_as::<_, VoiceRef>(
        "SELECT v.id, v.title, v.is_sample, u.name AS recorded_by_name
         FROM voice_messages v LEFT JOIN users u ON u.id = v.recorded_by_id
         WHERE v.patient_id = $1 ORDER BY v.is_sample ASC, v.updated_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    Ok(v.map(|v| BearVoiceDto { id: v.id, title: v.title, is_sample: v.is_sample, recorded_by_name: v.recorded_by_name }))
}

pub async fn get_state(
    pool: &PgPool,
    device: &BearDevice,
    patient: &Patient,
    now: DateTime<Utc>,
) -> ApiResult<BearStateDto> {
    crate::services::dose_engine::evaluate_patient(pool, &patient.id, now).await?;
    sqlx::query("UPDATE bear_devices SET last_seen_at = now() WHERE id = $1")
        .bind(&device.id)
        .execute(pool)
        .await?;

    let rows = sqlx::query_as::<_, DoseWithVoice>(
        "SELECT e.*, s.label, s.pill_note, v.id AS voice_id, v.title AS voice_title,
                v.is_sample AS voice_is_sample, u.name AS voice_by
         FROM dose_events e
         JOIN dose_schedules s ON s.id = e.schedule_id
         LEFT JOIN voice_messages v ON v.id = s.voice_message_id
         LEFT JOIN users u ON u.id = v.recorded_by_id
         WHERE e.patient_id = $1 AND e.scheduled_for BETWEEN $2 AND $3
         ORDER BY e.scheduled_for",
    )
    .bind(&patient.id)
    .bind(now - Duration::hours(12))
    .bind(now + Duration::hours(36))
    .fetch_all(pool)
    .await?;
    let fallback = fallback_voice(pool, &patient.id).await?;
    let away_rows: Vec<(DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
        "SELECT starts_at, ends_at FROM away_periods WHERE patient_id = $1 AND cancelled_at IS NULL",
    )
    .bind(&patient.id)
    .fetch_all(pool)
    .await?;
    let away: Vec<TimeRange> = away_rows.into_iter().map(|(starts_at, ends_at)| TimeRange { starts_at, ends_at }).collect();

    let to_dto = |r: &DoseWithVoice| {
        let w = r.event.windows();
        BearDoseDto {
            dose_id: r.event.id.clone(),
            label: r.label.clone(),
            pill_note: r.pill_note.clone(),
            scheduled_for: iso(w.scheduled_for),
            window_start: iso(w.window_start),
            on_time_end: iso(w.on_time_end),
            late_end: iso(w.late_end),
            status: r.event.status.clone(),
            taken_at: iso_opt(r.event.taken_at),
            reminder_count: r.event.reminder_count,
            voice: match &r.voice_id {
                Some(id) => Some(BearVoiceDto {
                    id: id.clone(),
                    title: r.voice_title.clone().unwrap_or_default(),
                    is_sample: r.voice_is_sample.unwrap_or(false),
                    recorded_by_name: r.voice_by.clone(),
                }),
                None => fallback.clone(),
            },
        }
    };

    let mut in_window: Vec<&DoseWithVoice> = rows
        .iter()
        .filter(|r| {
            let w = r.event.windows();
            w.window_start <= now && now <= w.late_end
        })
        .collect();
    in_window.sort_by_key(|r| (r.event.scheduled_for - now).num_milliseconds().abs());
    let active = in_window
        .iter()
        .find(|r| r.event.status().is_open())
        .or_else(|| in_window.iter().find(|r| r.event.status() != DoseStatus::Away))
        .copied();
    let next = rows.iter().find(|r| {
        r.event.scheduled_for > now
            && r.event.status() != DoseStatus::Away
            && active.is_none_or(|a| a.event.id != r.event.id)
    });
    let due = active.is_some_and(|a| {
        reminder_due(
            a.event.status(),
            &a.event.windows(),
            a.event.reminder_count,
            a.event.last_reminder_at,
            now,
            Utc::now(),
        )
    });

    Ok(BearStateDto {
        now: iso(now),
        device: BearDeviceStateDto {
            id: device.id.clone(),
            battery_pct: device.battery_pct,
            low_battery: device.battery_pct <= LOW_BATTERY_PCT,
        },
        patient: BearPatientDto { nickname: patient.nickname.clone() },
        away: is_within_away(now, &away),
        active_dose: active.map(to_dto),
        reminder_due: due,
        next_dose: next.map(to_dto),
        doses: rows.iter().map(&to_dto).collect(),
    })
}

/// Server-authoritative reminder playback: the count only increments when
/// the 20 s / max-3 rule allows it, so two open tabs can't double-play.
pub async fn claim_reminder(
    pool: &PgPool,
    device: &BearDevice,
    dose_id: &str,
    now: DateTime<Utc>,
) -> ApiResult<ReminderResultDto> {
    let ev = sqlx::query_as::<_, DoseEvent>("SELECT * FROM dose_events WHERE id = $1")
        .bind(dose_id)
        .fetch_optional(pool)
        .await?
        .filter(|e| e.patient_id == device.patient_id)
        .ok_or_else(|| ApiError::not_found("Dose not found for this bear."))?;
    let voice_id: Option<String> = sqlx::query_scalar("SELECT voice_message_id FROM dose_schedules WHERE id = $1")
        .bind(&ev.schedule_id)
        .fetch_one(pool)
        .await?;
    let voice_id = match voice_id {
        Some(v) => Some(v),
        None => fallback_voice(pool, &device.patient_id).await?.map(|v| v.id),
    };
    let real_now = Utc::now();
    if !reminder_due(ev.status(), &ev.windows(), ev.reminder_count, ev.last_reminder_at, now, real_now) {
        return Ok(ReminderResultDto { play: false, reminder_count: ev.reminder_count, voice_id });
    }
    let changed = sqlx::query(
        "UPDATE dose_events SET reminder_count = reminder_count + 1, last_reminder_at = $3,
                reminded_at = COALESCE(reminded_at, $4), status = 'REMINDED', updated_at = now()
         WHERE id = $1 AND reminder_count = $2 AND status IN ('UPCOMING', 'REMINDED')",
    )
    .bind(&ev.id)
    .bind(ev.reminder_count)
    .bind(real_now)
    .bind(now)
    .execute(pool)
    .await?
    .rows_affected();
    Ok(ReminderResultDto {
        play: changed == 1,
        reminder_count: ev.reminder_count + changed as i32,
        voice_id,
    })
}
