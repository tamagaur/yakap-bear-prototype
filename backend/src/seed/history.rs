//! Deterministic 6-week dose history generator (task D11). Pure: returns rows
//! for the reset to insert. Internally consistent — every MISSED dose gets one
//! alert and one simulated SMS per opted-in contact.

use std::collections::HashMap;

use chrono::{DateTime, Duration, NaiveDate, Utc};

use crate::{
    dose_rules::{TimeRange, compute_windows, is_within_away},
    services::alerts::missed_dose_sms_body,
    seed::demo_data::{Profile, SeedPatient},
    time,
};

/// Small seeded PRNG (mulberry32) so a reset on the same day gives the same history.
pub struct Mulberry32(u32);

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self(seed)
    }
    pub fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Taken,
    Late,
    Missed,
}

pub fn pick_outcome(profile: &Profile, weekday: u32, time_of_day: &str, rng: &mut Mulberry32) -> Outcome {
    let mut p_late = profile.late;
    let mut p_miss = (1.0 - profile.taken - profile.late).max(0.0);
    for p in profile.patterns {
        if p.time_of_day != time_of_day || !p.weekdays.contains(&weekday) {
            continue;
        }
        if let Some(m) = p.missed {
            p_miss = m;
        }
        if let Some(l) = p.late {
            p_late = l;
        }
    }
    let r = rng.next_f64();
    if r < p_miss {
        Outcome::Missed
    } else if r < p_miss + p_late {
        Outcome::Late
    } else {
        Outcome::Taken
    }
}

#[derive(Clone, Debug)]
pub struct SeedEvent {
    pub id: String,
    pub patient_id: String,
    pub schedule_id: String,
    pub scheduled_for: DateTime<Utc>,
    pub window_minutes: i32,
    pub late_minutes: i32,
    pub status: &'static str,
    pub taken_at: Option<DateTime<Utc>>,
    pub hold_ms: Option<i32>,
    pub logged_by: Option<&'static str>,
    pub reminder_count: i32,
    pub reminded_at: Option<DateTime<Utc>>,
    pub corrected: bool,
    pub original_status: Option<&'static str>,
}

#[derive(Clone, Debug)]
pub struct SeedAlert {
    pub id: String,
    pub patient_id: String,
    pub dose_event_id: String,
    pub title: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub acknowledged_at: Option<DateTime<Utc>>,
    pub acknowledged_by_id: Option<String>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolution: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SeedSms {
    pub patient_id: String,
    pub alert_id: String,
    pub to_name: String,
    pub to_phone: String,
    pub body: String,
    pub sent_at: DateTime<Utc>,
}

#[derive(Clone, Debug)]
pub struct SeedAttempt {
    pub patient_id: String,
    pub device_id: String,
    pub dose_event_id: Option<String>,
    pub held_at: DateTime<Utc>,
    pub hold_ms: i32,
    pub reason: &'static str,
}

#[derive(Clone, Debug)]
pub struct SeedCorrectionRow {
    pub dose_event_id: String,
    pub to_taken_at: DateTime<Utc>,
    pub reason: String,
    pub corrected_by_id: String,
    pub corrected_at: DateTime<Utc>,
}

#[derive(Default, Debug)]
pub struct HistoryRows {
    pub events: Vec<SeedEvent>,
    pub alerts: Vec<SeedAlert>,
    pub sms: Vec<SeedSms>,
    pub attempts: Vec<SeedAttempt>,
    pub corrections: Vec<SeedCorrectionRow>,
}

pub struct CorrectionSpec {
    pub date: NaiveDate,
    pub time_of_day: &'static str,
    pub reason: &'static str,
    pub taken_at_time: &'static str,
    pub corrected_by_id: &'static str,
}

pub struct HistoryInput<'a> {
    pub patient: &'a SeedPatient,
    pub today: NaiveDate,
    pub now: DateTime<Utc>,
    pub seed: u32,
    pub away: &'a [TimeRange],
    pub window_minutes: i32,
    pub late_minutes: i32,
    /// Forced outcomes per (date, "HH:mm").
    pub forced: HashMap<(NaiveDate, &'static str), Outcome>,
    /// Cap on *random* misses per weekday × dose time, so a scripted pattern stays on top.
    pub miss_cap: Option<u32>,
    pub correction: Option<CorrectionSpec>,
}

fn minutes(m: f64) -> Duration {
    Duration::milliseconds((m * 60_000.0).round() as i64)
}

pub fn generate(input: &HistoryInput<'_>) -> HistoryRows {
    let p = input.patient;
    let mut rng = Mulberry32::new(input.seed);
    let mut rows = HistoryRows::default();
    let mut random_misses: HashMap<(u32, &'static str), u32> = HashMap::new();

    for s in p.schedules {
        let effective = time::add_days(input.today, -s.since_days);
        for offset in (0..=p.history_days).rev() {
            let date = time::add_days(input.today, -offset);
            if date < effective {
                continue;
            }
            let scheduled_for = time::from_manila(date, s.time_of_day);
            let w = compute_windows(scheduled_for, input.window_minutes, input.late_minutes);
            let id = format!("ev_{}_{}_{}", p.key, date.format("%Y%m%d"), s.time_of_day.replace(':', ""));
            let mut ev = SeedEvent {
                id: id.clone(),
                patient_id: p.id.into(),
                schedule_id: s.id.into(),
                scheduled_for,
                window_minutes: input.window_minutes,
                late_minutes: input.late_minutes,
                status: "AWAY",
                taken_at: None,
                hold_ms: None,
                logged_by: None,
                reminder_count: 0,
                reminded_at: None,
                corrected: false,
                original_status: None,
            };
            if is_within_away(scheduled_for, input.away) {
                rows.events.push(ev);
                continue;
            }
            // Doses that can still be logged are left for the live dose engine.
            if w.late_end >= input.now {
                continue;
            }
            let outcome = match input.forced.get(&(date, s.time_of_day)).copied() {
                Some(o) => o,
                None => {
                    let weekday = time::weekday(scheduled_for);
                    let picked = pick_outcome(&p.profile, weekday, s.time_of_day, &mut rng);
                    match (picked, input.miss_cap) {
                        (Outcome::Missed, Some(cap)) => {
                            let n = random_misses.entry((weekday, s.time_of_day)).or_insert(0);
                            if *n >= cap {
                                Outcome::Taken
                            } else {
                                *n += 1;
                                Outcome::Missed
                            }
                        }
                        _ => picked,
                    }
                }
            };

            match outcome {
                Outcome::Taken => {
                    let taken_at = scheduled_for + minutes(rng.next_f64() * 46.0 - 22.0);
                    ev.status = "TAKEN";
                    ev.taken_at = Some(taken_at);
                    ev.hold_ms = Some(3100 + (rng.next_f64() * 2200.0) as i32);
                    ev.logged_by = Some(if rng.next_f64() < 0.06 { "OFFLINE_SYNC" } else { "BEAR" });
                    let before = taken_at < scheduled_for;
                    ev.reminder_count = if before { 0 } else { 1 };
                    ev.reminded_at = (!before).then_some(scheduled_for);
                    if rng.next_f64() < 0.18 {
                        rows.attempts.push(SeedAttempt {
                            patient_id: p.id.into(),
                            device_id: p.device_id.into(),
                            dose_event_id: Some(id.clone()),
                            held_at: taken_at - Duration::seconds(30 + (rng.next_f64() * 90.0) as i64),
                            hold_ms: 300 + (rng.next_f64() * 1500.0) as i32,
                            reason: "TOO_SHORT",
                        });
                    }
                    rows.events.push(ev);
                }
                Outcome::Late => {
                    let span = (input.late_minutes - 4).max(1) as f64;
                    ev.status = "LATE";
                    ev.taken_at = Some(w.on_time_end + minutes(2.0 + rng.next_f64() * span));
                    ev.hold_ms = Some(3100 + (rng.next_f64() * 2500.0) as i32);
                    ev.logged_by = Some("BEAR");
                    ev.reminder_count = 3;
                    ev.reminded_at = Some(scheduled_for);
                    rows.events.push(ev);
                }
                Outcome::Missed => {
                    let correction = input
                        .correction
                        .as_ref()
                        .filter(|c| c.date == date && c.time_of_day == s.time_of_day);
                    let alert_id = format!("al_{id}");
                    let acknowledged = (input.now - w.late_end) > Duration::hours(36) || correction.is_some();
                    let mut resolved_at = None;
                    let mut resolution = None;
                    ev.reminder_count = 3;
                    ev.reminded_at = Some(scheduled_for);
                    if let Some(c) = correction {
                        let corrected_at = w.late_end + Duration::hours(13);
                        let to_taken_at = time::from_manila(date, c.taken_at_time);
                        ev.status = "TAKEN";
                        ev.taken_at = Some(to_taken_at);
                        ev.logged_by = Some("FAMILY");
                        ev.corrected = true;
                        ev.original_status = Some("MISSED");
                        rows.corrections.push(SeedCorrectionRow {
                            dose_event_id: id.clone(),
                            to_taken_at,
                            reason: c.reason.into(),
                            corrected_by_id: c.corrected_by_id.into(),
                            corrected_at,
                        });
                        resolved_at = Some(corrected_at);
                        resolution = Some(format!("Corrected by family: {}", c.reason));
                    } else {
                        ev.status = "MISSED";
                    }
                    rows.events.push(ev);
                    rows.alerts.push(SeedAlert {
                        id: alert_id.clone(),
                        patient_id: p.id.into(),
                        dose_event_id: id.clone(),
                        title: format!("Missed {} dose", time::format_time(scheduled_for)),
                        message: format!(
                            "{}'s {} dose ({}) was not logged by {}.",
                            p.nickname,
                            time::format_time(scheduled_for),
                            s.label,
                            time::format_time(w.late_end)
                        ),
                        created_at: w.late_end,
                        acknowledged_at: acknowledged.then(|| w.late_end + minutes(10.0 + rng.next_f64() * 110.0)),
                        acknowledged_by_id: acknowledged.then(|| p.member_user_id.to_string()),
                        resolved_at,
                        resolution,
                    });
                    for c in p.contacts.iter().filter(|c| c.receives_sms) {
                        rows.sms.push(SeedSms {
                            patient_id: p.id.into(),
                            alert_id: alert_id.clone(),
                            to_name: c.name.into(),
                            to_phone: c.phone.into(),
                            body: missed_dose_sms_body(c.name, p.nickname, s.label, scheduled_for, w.late_end),
                            sent_at: w.late_end,
                        });
                    }
                }
            }

            if rng.next_f64() < 0.04 {
                rows.attempts.push(SeedAttempt {
                    patient_id: p.id.into(),
                    device_id: p.device_id.into(),
                    dose_event_id: None,
                    held_at: scheduled_for - minutes(120.0 + rng.next_f64() * 120.0),
                    hold_ms: 3200 + (rng.next_f64() * 1500.0) as i32,
                    reason: "OUTSIDE_WINDOW",
                });
            }
        }
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::demo_data::PATIENTS;

    fn rosa_rows() -> HistoryRows {
        let today = time::parse_date_key("2026-11-16").unwrap();
        generate(&HistoryInput {
            patient: &PATIENTS[0],
            today,
            now: time::from_manila(today, "19:45"),
            seed: 1000,
            away: &[],
            window_minutes: 30,
            late_minutes: 60,
            forced: HashMap::new(),
            miss_cap: None,
            correction: None,
        })
    }

    #[test]
    fn is_deterministic() {
        let a = rosa_rows();
        let b = rosa_rows();
        assert_eq!(a.events.len(), b.events.len());
        assert!(a.events.iter().zip(&b.events).all(|(x, y)| x.status == y.status && x.taken_at == y.taken_at));
    }

    #[test]
    fn one_event_per_schedule_per_day() {
        let rows = rosa_rows();
        let mut keys: Vec<_> = rows.events.iter().map(|e| (e.schedule_id.clone(), e.scheduled_for)).collect();
        let n = keys.len();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), n);
    }

    #[test]
    fn every_missed_dose_has_one_alert_and_sms_per_contact() {
        let rows = rosa_rows();
        let missed: Vec<_> = rows.events.iter().filter(|e| e.status == "MISSED").collect();
        assert!(!missed.is_empty());
        for m in &missed {
            assert_eq!(rows.alerts.iter().filter(|a| a.dose_event_id == m.id).count(), 1);
        }
        assert_eq!(rows.sms.len(), rows.alerts.len() * 2);
    }

    #[test]
    fn leaves_loggable_doses_to_the_engine() {
        assert!(rosa_rows().events.iter().all(|e| !e.id.ends_with("20261116_2000")));
    }

    #[test]
    fn taken_and_late_times_fit_their_windows() {
        for e in rosa_rows().events {
            let Some(t) = e.taken_at else { continue };
            let diff = (t - e.scheduled_for).num_minutes();
            match e.status {
                "TAKEN" => assert!(diff.abs() <= 30, "taken {diff} min"),
                "LATE" => assert!(diff > 30 && diff <= 90, "late {diff} min"),
                _ => {}
            }
        }
    }
}
