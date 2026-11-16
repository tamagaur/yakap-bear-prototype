//! Database row types. Enumerations are stored as TEXT (see migrations) and
//! parsed into the enums in [`crate::dose_rules`] where logic needs them.

use chrono::{DateTime, Utc};
use sqlx::FromRow;

use crate::dose_rules::{DoseStatus, DoseWindows, compute_windows};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Family,
    Clinician,
    ClinicAdmin,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Family => "FAMILY",
            Self::Clinician => "CLINICIAN",
            Self::ClinicAdmin => "CLINIC_ADMIN",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "FAMILY" => Self::Family,
            "CLINICIAN" => Self::Clinician,
            "CLINIC_ADMIN" => Self::ClinicAdmin,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub name: String,
    pub role: String,
    pub clinic_name: Option<String>,
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn role(&self) -> Option<Role> {
        Role::parse(&self.role)
    }
}

#[derive(Clone, Debug, FromRow)]
pub struct Patient {
    pub id: String,
    pub full_name: String,
    pub nickname: String,
    pub birth_year: Option<i32>,
    pub notes: Option<String>,
    pub plan_started_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow)]
pub struct BearDevice {
    pub id: String,
    pub patient_id: String,
    pub device_key: String,
    pub battery_pct: i32,
    pub last_seen_at: Option<DateTime<Utc>>,
    pub low_battery_alerted: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow)]
pub struct FamilyContact {
    pub id: String,
    pub patient_id: String,
    pub name: String,
    pub relationship: String,
    pub phone: String,
    pub receives_sms: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow)]
pub struct DoseSchedule {
    pub id: String,
    pub patient_id: String,
    pub label: String,
    pub time_of_day: String,
    pub window_minutes: i32,
    pub late_minutes: i32,
    pub pill_note: Option<String>,
    pub voice_message_id: Option<String>,
    pub active: bool,
    pub effective_from: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Schedule joined with its voice title.
#[derive(Clone, Debug, FromRow)]
pub struct ScheduleWithVoice {
    #[sqlx(flatten)]
    pub schedule: DoseSchedule,
    pub voice_title: Option<String>,
}

#[derive(Clone, Debug, FromRow)]
pub struct DoseEvent {
    pub id: String,
    pub patient_id: String,
    pub schedule_id: String,
    pub scheduled_for: DateTime<Utc>,
    pub window_minutes: i32,
    pub late_minutes: i32,
    pub status: String,
    pub taken_at: Option<DateTime<Utc>>,
    pub hold_ms: Option<i32>,
    pub logged_by: Option<String>,
    pub client_event_id: Option<String>,
    pub reminder_count: i32,
    pub last_reminder_at: Option<DateTime<Utc>>,
    pub reminded_at: Option<DateTime<Utc>>,
    pub corrected: bool,
    pub original_status: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl DoseEvent {
    pub fn status(&self) -> DoseStatus {
        DoseStatus::parse(&self.status).unwrap_or(DoseStatus::Upcoming)
    }
    pub fn windows(&self) -> DoseWindows {
        compute_windows(self.scheduled_for, self.window_minutes, self.late_minutes)
    }
}

/// Dose event joined with its schedule's label and pill note.
#[derive(Clone, Debug, FromRow)]
pub struct DoseEventFull {
    #[sqlx(flatten)]
    pub event: DoseEvent,
    pub label: String,
    pub pill_note: Option<String>,
}

#[derive(Clone, Debug, FromRow)]
pub struct DoseCorrection {
    pub id: String,
    pub dose_event_id: String,
    pub from_status: String,
    pub to_status: String,
    pub from_taken_at: Option<DateTime<Utc>>,
    pub to_taken_at: Option<DateTime<Utc>>,
    pub reason: String,
    pub corrected_by_id: String,
    pub corrected_at: DateTime<Utc>,
    pub corrected_by_name: String,
}

/// Voice message metadata (never the audio bytes).
#[derive(Clone, Debug, FromRow)]
pub struct VoiceMeta {
    pub id: String,
    pub patient_id: String,
    pub title: String,
    pub mime_type: String,
    pub duration_sec: Option<f64>,
    pub size_bytes: i32,
    pub recorded_by_name: Option<String>,
    pub is_sample: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, FromRow)]
pub struct Alert {
    pub id: String,
    pub patient_id: String,
    #[sqlx(rename = "type")]
    pub alert_type: String,
    pub dose_event_id: Option<String>,
    pub title: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by_name: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolution: Option<String>,
    pub sms_count: i64,
}

#[derive(Clone, Debug, FromRow)]
pub struct SmsMessage {
    pub id: String,
    pub patient_id: String,
    pub alert_id: Option<String>,
    pub to_name: String,
    pub to_phone: String,
    pub body: String,
    pub sent_at: DateTime<Utc>,
}

/// Consent joined with clinician / grantor / revoker names.
#[derive(Clone, Debug, FromRow)]
pub struct ConsentFull {
    pub id: String,
    pub patient_id: String,
    pub clinician_id: String,
    pub signed_name: String,
    pub signature_data_url: String,
    pub consent_version: String,
    pub granted_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub clinician_name: String,
    pub clinician_title: Option<String>,
    pub clinician_clinic: Option<String>,
    pub granted_by_name: String,
    pub revoked_by_name: Option<String>,
}

#[derive(Clone, Debug, FromRow)]
pub struct AwayPeriod {
    pub id: String,
    pub patient_id: String,
    pub start_date: String,
    pub end_date: String,
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub reason: String,
    pub note: Option<String>,
    pub created_by_name: String,
    pub cancelled_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, FromRow)]
pub struct AuditRow {
    pub id: String,
    pub action: String,
    pub actor_name: String,
    pub actor_role: Option<String>,
    pub patient_name: Option<String>,
    pub clinic_name: Option<String>,
    pub details: Option<serde_json::Value>,
    pub sim_time: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}
