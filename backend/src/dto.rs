//! API response shapes (camelCase JSON). These mirror the zod contracts in
//! `src/lib/contracts` used by the Next.js frontend; docs/API.md lists them.

use serde::Serialize;

use crate::dose_rules::AdherenceCounts;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuthUserDto {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    pub clinic_name: Option<String>,
    pub title: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClinicianDto {
    pub id: String,
    pub name: String,
    pub title: Option<String>,
    pub clinic_name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDto {
    pub id: String,
    pub battery_pct: i32,
    pub low_battery: bool,
    pub online: bool,
    pub last_seen_at: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlanDto {
    pub included_until: String,
    pub days_left: i64,
    pub status: &'static str,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PatientDto {
    pub id: String,
    pub full_name: String,
    pub nickname: String,
    pub birth_year: Option<i32>,
    pub notes: Option<String>,
    pub relationship: Option<String>,
    pub device: Option<DeviceDto>,
    pub plan: PlanDto,
    pub away_now: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContactDto {
    pub id: String,
    pub name: String,
    pub relationship: String,
    pub phone: String,
    pub receives_sms: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDto {
    pub id: String,
    pub label: String,
    pub time_of_day: String,
    pub window_minutes: i32,
    pub late_minutes: i32,
    pub pill_note: Option<String>,
    pub voice_message_id: Option<String>,
    pub voice_title: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionDto {
    pub id: String,
    pub from_status: String,
    pub to_status: String,
    pub from_taken_at: Option<String>,
    pub to_taken_at: Option<String>,
    pub reason: String,
    pub corrected_by_name: String,
    pub corrected_at: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DoseEventDto {
    pub id: String,
    pub schedule_id: String,
    pub label: String,
    pub pill_note: Option<String>,
    pub scheduled_for: String,
    pub window_start: String,
    pub on_time_end: String,
    pub late_end: String,
    pub status: String,
    pub taken_at: Option<String>,
    pub hold_ms: Option<i32>,
    pub logged_by: Option<String>,
    pub reminder_count: i32,
    pub corrected: bool,
    pub original_status: Option<String>,
    pub corrections: Vec<CorrectionDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TodayDto {
    pub now: String,
    pub date_key: String,
    pub doses: Vec<DoseEventDto>,
    pub next_dose: Option<DoseEventDto>,
    pub open_alerts: i64,
    pub away_now: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DoseHistoryDto {
    pub from: String,
    pub to: String,
    pub now: String,
    pub doses: Vec<DoseEventDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AssignedToDto {
    pub schedule_id: String,
    pub label: String,
    pub time_of_day: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VoiceMessageDto {
    pub id: String,
    pub title: String,
    pub mime_type: String,
    pub duration_sec: Option<f64>,
    pub size_bytes: i32,
    pub recorded_by_name: Option<String>,
    pub is_sample: bool,
    pub created_at: String,
    pub updated_at: String,
    pub audio_url: String,
    pub assigned_to: Vec<AssignedToDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlertDto {
    pub id: String,
    #[serde(rename = "type")]
    pub alert_type: String,
    pub title: String,
    pub message: String,
    pub created_at: String,
    pub acknowledged_at: Option<String>,
    pub acknowledged_by_name: Option<String>,
    pub resolved_at: Option<String>,
    pub resolution: Option<String>,
    pub dose_event_id: Option<String>,
    pub sms_count: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SmsDto {
    pub id: String,
    pub to_name: String,
    pub to_phone: String,
    pub body: String,
    pub sent_at: String,
    pub alert_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConsentDto {
    pub id: String,
    pub clinician: ClinicianDto,
    pub granted_by_name: String,
    pub signed_name: String,
    pub signature_data_url: String,
    pub consent_version: String,
    pub granted_at: String,
    pub revoked_at: Option<String>,
    pub revoked_by_name: Option<String>,
    pub active: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccessLogEntryDto {
    pub id: String,
    pub action: String,
    pub actor_name: String,
    pub clinic_name: Option<String>,
    pub sim_time: String,
    pub summary: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AwayDto {
    pub id: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: String,
    pub note: Option<String>,
    pub created_by_name: String,
    pub state: &'static str,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BearVoiceDto {
    pub id: String,
    pub title: String,
    pub is_sample: bool,
    pub recorded_by_name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BearDoseDto {
    pub dose_id: String,
    pub label: String,
    pub pill_note: Option<String>,
    pub scheduled_for: String,
    pub window_start: String,
    pub on_time_end: String,
    pub late_end: String,
    pub status: String,
    pub taken_at: Option<String>,
    pub reminder_count: i32,
    pub voice: Option<BearVoiceDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BearDeviceStateDto {
    pub id: String,
    pub battery_pct: i32,
    pub low_battery: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BearPatientDto {
    pub nickname: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BearStateDto {
    pub now: String,
    pub device: BearDeviceStateDto,
    pub patient: BearPatientDto,
    pub away: bool,
    pub active_dose: Option<BearDoseDto>,
    pub reminder_due: bool,
    pub next_dose: Option<BearDoseDto>,
    pub doses: Vec<BearDoseDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HoldResultDto {
    pub client_event_id: String,
    pub accepted: bool,
    pub duplicate: bool,
    pub status: Option<String>,
    pub reason: Option<String>,
    pub dose_id: Option<String>,
    pub scheduled_for: Option<String>,
    pub held_at: String,
    pub hold_ms: i64,
    pub resolved_missed: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReminderResultDto {
    pub play: bool,
    pub reminder_count: i32,
    pub voice_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatResultDto {
    pub ok: bool,
    pub battery_pct: i32,
    pub low_battery: bool,
    pub alert_created: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DailyAdherenceDto {
    pub date: String,
    pub taken: i64,
    pub late: i64,
    pub missed: i64,
    pub away: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AdherenceSummaryDto {
    pub days: i64,
    pub from: String,
    pub to: String,
    #[serde(flatten)]
    pub counts: AdherenceCounts,
    pub daily: Vec<DailyAdherenceDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LastDoseDto {
    pub scheduled_for: String,
    pub status: String,
    pub label: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClinicPatientRowDto {
    pub id: String,
    pub full_name: String,
    pub nickname: String,
    pub birth_year: Option<i32>,
    pub consent_since: String,
    pub on_time_pct7: Option<i64>,
    pub adherence_pct30: Option<i64>,
    pub missed7: i64,
    pub last_dose: Option<LastDoseDto>,
    pub away_now: bool,
    pub has_data: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClinicConsentDto {
    pub id: String,
    pub granted_at: String,
    pub signed_name: String,
    pub granted_by_name: String,
    pub consent_version: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NameRelationDto {
    pub name: String,
    pub relationship: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClinicAwayDto {
    pub start_date: String,
    pub end_date: String,
    pub reason: String,
    pub active: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClinicPatientDetailDto {
    pub id: String,
    pub full_name: String,
    pub nickname: String,
    pub birth_year: Option<i32>,
    pub consent: ClinicConsentDto,
    pub family_contacts: Vec<NameRelationDto>,
    pub schedules: Vec<ScheduleDto>,
    pub away_periods: Vec<ClinicAwayDto>,
    pub recent: Vec<DoseEventDto>,
    pub first_dose_date: Option<String>,
    pub now: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PatternTimeDto {
    pub time_of_day: String,
    pub label: String,
}

#[derive(Serialize, Clone, Copy, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PatternCellDto {
    pub missed: i64,
    pub late: i64,
    pub taken: i64,
    pub total: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HotspotDto {
    pub weekday: u32,
    pub time_of_day: String,
    pub missed: i64,
    pub total: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PatternDto {
    pub days: i64,
    pub from: String,
    pub to: String,
    pub times: Vec<PatternTimeDto>,
    /// cells[weekday 0=Sun..6][time index]
    pub cells: Vec<Vec<PatternCellDto>>,
    pub hotspots: Vec<HotspotDto>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntryDto {
    pub id: String,
    pub action: String,
    pub actor_name: String,
    pub actor_role: Option<String>,
    pub patient_name: Option<String>,
    pub clinic_name: Option<String>,
    pub details: Option<serde_json::Value>,
    pub sim_time: String,
    pub created_at: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ClockDto {
    pub now: String,
    pub real_now: String,
    pub offset_ms: i64,
    pub demo_mode: bool,
    pub timezone: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DemoDeviceDto {
    pub id: String,
    pub device_key: String,
    pub patient_nickname: String,
    pub patient_name: String,
}
