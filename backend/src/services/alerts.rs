//! Missed-dose alerts + simulated SMS (task B7) and low-battery alerts (S6).
//! No real SMS is ever sent: messages are stored and shown in the family app.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};

use crate::{
    dose_rules::LOW_BATTERY_PCT,
    models::{BearDevice, DoseEvent, FamilyContact},
    new_id,
    time::format_time,
};

pub fn missed_dose_sms_body(
    recipient_name: &str,
    nickname: &str,
    label: &str,
    scheduled_for: DateTime<Utc>,
    late_end: DateTime<Utc>,
) -> String {
    let first = recipient_name.split_whitespace().next().unwrap_or(recipient_name);
    format!(
        "Yakap Bear: Hi {first}, {nickname}'s {} dose ({label}) has not been logged and the dose window \
         closed at {}. You may want to check in with {nickname}.",
        format_time(scheduled_for),
        format_time(late_end)
    )
}

/// Creates the alert + one SMS per opted-in contact for a dose that just
/// became MISSED. Idempotent: alerts are unique per dose event.
pub async fn create_missed_dose_alert(
    conn: &mut PgConnection,
    ev: &DoseEvent,
    label: &str,
    nickname: &str,
) -> sqlx::Result<()> {
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM alerts WHERE dose_event_id = $1")
        .bind(&ev.id)
        .fetch_optional(&mut *conn)
        .await?;
    if exists.is_some() {
        return Ok(());
    }
    let w = ev.windows();
    let alert_id = new_id("al");
    sqlx::query(
        "INSERT INTO alerts (id, patient_id, type, dose_event_id, title, message, created_at)
         VALUES ($1, $2, 'MISSED_DOSE', $3, $4, $5, $6)",
    )
    .bind(&alert_id)
    .bind(&ev.patient_id)
    .bind(&ev.id)
    .bind(format!("Missed {} dose", format_time(ev.scheduled_for)))
    .bind(format!(
        "{nickname}'s {} dose ({label}) was not logged by {}.",
        format_time(ev.scheduled_for),
        format_time(w.late_end)
    ))
    .bind(w.late_end)
    .execute(&mut *conn)
    .await?;

    let contacts = sqlx::query_as::<_, FamilyContact>(
        "SELECT * FROM family_contacts WHERE patient_id = $1 AND receives_sms ORDER BY created_at",
    )
    .bind(&ev.patient_id)
    .fetch_all(&mut *conn)
    .await?;
    for c in contacts {
        sqlx::query(
            "INSERT INTO sms_messages (id, patient_id, alert_id, to_name, to_phone, body, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(new_id("sms"))
        .bind(&ev.patient_id)
        .bind(&alert_id)
        .bind(&c.name)
        .bind(&c.phone)
        .bind(missed_dose_sms_body(&c.name, nickname, label, ev.scheduled_for, w.late_end))
        .bind(w.late_end)
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

/// Marks a dose's missed-dose alert as resolved (synced hold or family correction).
pub async fn resolve_dose_alert(
    conn: &mut PgConnection,
    dose_event_id: &str,
    resolution: &str,
    now: DateTime<Utc>,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE alerts SET resolved_at = $2, resolution = $3 WHERE dose_event_id = $1 AND resolved_at IS NULL")
        .bind(dose_event_id)
        .bind(now)
        .bind(resolution)
        .execute(conn)
        .await?;
    Ok(())
}

/// Applies a battery reading. Crossing ≤ 20 % creates ONE low-battery alert;
/// recharging above the threshold re-arms it and resolves the open alert.
pub async fn apply_battery_level(
    pool: &PgPool,
    device: &BearDevice,
    nickname: &str,
    battery_pct: i32,
    now: DateTime<Utc>,
) -> sqlx::Result<bool> {
    let low = battery_pct <= LOW_BATTERY_PCT;
    let mut tx = pool.begin().await?;
    let mut created = false;
    if low && !device.low_battery_alerted {
        sqlx::query(
            "INSERT INTO alerts (id, patient_id, type, title, message, created_at)
             VALUES ($1, $2, 'LOW_BATTERY', 'Bear battery is low', $3, $4)",
        )
        .bind(new_id("al"))
        .bind(&device.patient_id)
        .bind(format!(
            "{nickname}'s bear ({}) is at {battery_pct}% battery. Please charge it soon so reminders keep playing.",
            device.id
        ))
        .bind(now)
        .execute(&mut *tx)
        .await?;
        created = true;
    } else if !low && device.low_battery_alerted {
        sqlx::query(
            "UPDATE alerts SET resolved_at = $2, resolution = $3
             WHERE patient_id = $1 AND type = 'LOW_BATTERY' AND resolved_at IS NULL",
        )
        .bind(&device.patient_id)
        .bind(now)
        .bind(format!("Bear recharged to {battery_pct}%."))
        .execute(&mut *tx)
        .await?;
    }
    sqlx::query("UPDATE bear_devices SET battery_pct = $2, low_battery_alerted = $3, last_seen_at = now() WHERE id = $1")
        .bind(&device.id)
        .bind(battery_pct)
        .bind(low)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(created)
}
