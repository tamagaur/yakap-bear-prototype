//! Pure dose rules (tasks B5, B6, S2, S5) — no database access.
//!
//! Documented in docs/DOSE_RULES.md. The bear simulator keeps a TypeScript
//! mirror (src/lib/dose-rules.ts) for offline feedback; this module is the
//! authority.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::time;

pub const HOLD_MIN_MS: i64 = 3000;
pub const REMINDER_REPEAT_MS: i64 = 20_000;
pub const MAX_REMINDERS: i32 = 3;
pub const DEFAULT_WINDOW_MINUTES: i32 = 30;
pub const DEFAULT_LATE_MINUTES: i32 = 60;
pub const LOW_BATTERY_PCT: i32 = 20;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DoseStatus {
    Upcoming,
    Reminded,
    Taken,
    Late,
    Missed,
    Away,
}

impl DoseStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Upcoming => "UPCOMING",
            Self::Reminded => "REMINDED",
            Self::Taken => "TAKEN",
            Self::Late => "LATE",
            Self::Missed => "MISSED",
            Self::Away => "AWAY",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "UPCOMING" => Self::Upcoming,
            "REMINDED" => Self::Reminded,
            "TAKEN" => Self::Taken,
            "LATE" => Self::Late,
            "MISSED" => Self::Missed,
            "AWAY" => Self::Away,
            _ => return None,
        })
    }
    /// Still waiting for a paw hold.
    pub fn is_open(self) -> bool {
        matches!(self, Self::Upcoming | Self::Reminded)
    }
    pub fn is_logged(self) -> bool {
        matches!(self, Self::Taken | Self::Late)
    }
    pub fn is_final(self) -> bool {
        matches!(self, Self::Taken | Self::Late | Self::Missed | Self::Away)
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Taken => "Taken on time",
            Self::Late => "Taken late",
            Self::Missed => "Missed",
            Self::Away => "Away (excused)",
            Self::Upcoming => "Upcoming",
            Self::Reminded => "Reminded",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttemptReason {
    TooShort,
    OutsideWindow,
    AlreadyLogged,
    Away,
}

impl AttemptReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TooShort => "TOO_SHORT",
            Self::OutsideWindow => "OUTSIDE_WINDOW",
            Self::AlreadyLogged => "ALREADY_LOGGED",
            Self::Away => "AWAY",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "TOO_SHORT" => Self::TooShort,
            "OUTSIDE_WINDOW" => Self::OutsideWindow,
            "ALREADY_LOGGED" => Self::AlreadyLogged,
            "AWAY" => Self::Away,
            _ => return None,
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DoseWindows {
    /// Window opens: scheduled_for − window.
    pub window_start: DateTime<Utc>,
    pub scheduled_for: DateTime<Utc>,
    /// Last instant that still counts as on time: scheduled_for + window.
    pub on_time_end: DateTime<Utc>,
    /// Last instant that still counts as late: on_time_end + late period.
    pub late_end: DateTime<Utc>,
}

pub fn compute_windows(scheduled_for: DateTime<Utc>, window_minutes: i32, late_minutes: i32) -> DoseWindows {
    let w = Duration::minutes(window_minutes as i64);
    DoseWindows {
        window_start: scheduled_for - w,
        scheduled_for,
        on_time_end: scheduled_for + w,
        late_end: scheduled_for + w + Duration::minutes(late_minutes as i64),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WindowPosition {
    Before,
    OnTime,
    Late,
    After,
}

/// Inclusive boundaries: [window_start, on_time_end] → OnTime,
/// (on_time_end, late_end] → Late.
pub fn position_in_window(w: &DoseWindows, at: DateTime<Utc>) -> WindowPosition {
    if at < w.window_start {
        WindowPosition::Before
    } else if at <= w.on_time_end {
        WindowPosition::OnTime
    } else if at <= w.late_end {
        WindowPosition::Late
    } else {
        WindowPosition::After
    }
}

#[derive(Clone, Debug)]
pub struct HoldCandidate {
    pub id: String,
    pub status: DoseStatus,
    pub windows: DoseWindows,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HoldDecision {
    Accepted {
        dose_id: String,
        status: DoseStatus,
        /// A delayed (offline) hold turns a MISSED dose into TAKEN/LATE.
        resolves_missed: bool,
    },
    Rejected {
        reason: AttemptReason,
        dose_id: Option<String>,
    },
}

/// Accidental-squeeze filter (B6). A hold counts only if it lasted ≥ 3 s,
/// away mode is off, it happened inside a dose window, and that dose has not
/// been logged yet. Check order: TOO_SHORT → AWAY → OUTSIDE_WINDOW → ALREADY_LOGGED.
pub fn classify_hold(
    hold_ms: i64,
    held_at: DateTime<Utc>,
    away_active: bool,
    candidates: &[HoldCandidate],
) -> HoldDecision {
    let mut containing: Vec<(&HoldCandidate, WindowPosition)> = candidates
        .iter()
        .map(|c| (c, position_in_window(&c.windows, held_at)))
        .filter(|(_, p)| matches!(p, WindowPosition::OnTime | WindowPosition::Late))
        .collect();
    containing.sort_by_key(|(c, _)| (c.windows.scheduled_for - held_at).num_milliseconds().abs());
    let nearest = containing.first().map(|(c, _)| c.id.clone());

    if hold_ms < HOLD_MIN_MS {
        return HoldDecision::Rejected { reason: AttemptReason::TooShort, dose_id: nearest };
    }
    if away_active {
        return HoldDecision::Rejected { reason: AttemptReason::Away, dose_id: nearest };
    }
    if containing.is_empty() {
        return HoldDecision::Rejected { reason: AttemptReason::OutsideWindow, dose_id: None };
    }
    if let Some((c, pos)) = containing
        .iter()
        .find(|(c, _)| c.status.is_open() || c.status == DoseStatus::Missed)
    {
        return HoldDecision::Accepted {
            dose_id: c.id.clone(),
            status: if *pos == WindowPosition::OnTime { DoseStatus::Taken } else { DoseStatus::Late },
            resolves_missed: c.status == DoseStatus::Missed,
        };
    }
    if let Some((c, _)) = containing.iter().find(|(c, _)| c.status == DoseStatus::Away) {
        return HoldDecision::Rejected { reason: AttemptReason::Away, dose_id: Some(c.id.clone()) };
    }
    HoldDecision::Rejected { reason: AttemptReason::AlreadyLogged, dose_id: nearest }
}

/// A dose becomes MISSED once the late period has fully passed with no valid hold.
pub fn should_mark_missed(status: DoseStatus, w: &DoseWindows, now: DateTime<Utc>) -> bool {
    status.is_open() && now > w.late_end
}

/// Reminder rule (S4/S5): play when the dose time has arrived and the dose is
/// still open, at most 3 times, at least 20 s (real time) apart.
pub fn reminder_due(
    status: DoseStatus,
    w: &DoseWindows,
    reminder_count: i32,
    last_reminder_at: Option<DateTime<Utc>>,
    now_sim: DateTime<Utc>,
    now_real: DateTime<Utc>,
) -> bool {
    if !status.is_open() || now_sim < w.scheduled_for || now_sim > w.late_end {
        return false;
    }
    if reminder_count >= MAX_REMINDERS {
        return false;
    }
    match last_reminder_at {
        Some(last) => (now_real - last).num_milliseconds() >= REMINDER_REPEAT_MS,
        None => true,
    }
}

#[derive(Clone, Copy, Debug)]
pub struct TimeRange {
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
}

/// Away periods are [starts_at, ends_at).
pub fn is_within_away(at: DateTime<Utc>, periods: &[TimeRange]) -> bool {
    periods.iter().any(|p| at >= p.starts_at && at < p.ends_at)
}

/// Dose times for one schedule across a date range — exactly one per day,
/// regardless of the number of pills. A slot is skipped if it could no longer
/// be logged when the schedule took effect.
pub fn slots_for_range(
    time_of_day: &str,
    window_minutes: i32,
    late_minutes: i32,
    effective_from: DateTime<Utc>,
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<DateTime<Utc>> {
    time::date_range(from, to)
        .into_iter()
        .map(|d| time::from_manila(d, time_of_day))
        .filter(|slot| compute_windows(*slot, window_minutes, late_minutes).late_end > effective_from)
        .collect()
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdherenceCounts {
    pub total: i64,
    pub taken: i64,
    pub late: i64,
    pub missed: i64,
    pub away: i64,
    /// Doses that count towards adherence (away excluded).
    pub counted: i64,
    pub on_time_pct: Option<i64>,
    pub adherence_pct: Option<i64>,
}

fn pct(part: i64, whole: i64) -> Option<i64> {
    (whole > 0).then(|| ((part as f64 / whole as f64) * 100.0).round() as i64)
}

/// Adherence summary. AWAY doses are excluded from every percentage.
pub fn summarize_adherence(statuses: impl IntoIterator<Item = DoseStatus>) -> AdherenceCounts {
    let mut c = AdherenceCounts::default();
    for s in statuses {
        match s {
            DoseStatus::Taken => c.taken += 1,
            DoseStatus::Late => c.late += 1,
            DoseStatus::Missed => c.missed += 1,
            DoseStatus::Away => c.away += 1,
            _ => {}
        }
    }
    c.counted = c.taken + c.late + c.missed;
    c.total = c.counted + c.away;
    c.on_time_pct = pct(c.taken, c.counted);
    c.adherence_pct = pct(c.taken + c.late, c.counted);
    c
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::{from_manila, parse_date_key};

    fn at(hhmm: &str) -> DateTime<Utc> {
        from_manila(parse_date_key("2026-11-16").unwrap(), hhmm)
    }
    fn ms(t: DateTime<Utc>, delta: i64) -> DateTime<Utc> {
        t + Duration::milliseconds(delta)
    }
    fn dose8pm() -> DoseWindows {
        compute_windows(at("20:00"), 30, 60)
    }
    fn hold(hold_ms: i64, held_at: DateTime<Utc>, status: DoseStatus, away: bool) -> HoldDecision {
        let c = HoldCandidate { id: "d1".into(), status, windows: dose8pm() };
        classify_hold(hold_ms, held_at, away, &[c])
    }
    fn accepted(status: DoseStatus) -> HoldDecision {
        HoldDecision::Accepted { dose_id: "d1".into(), status, resolves_missed: false }
    }
    fn rejected(reason: AttemptReason, dose: bool) -> HoldDecision {
        HoldDecision::Rejected { reason, dose_id: dose.then(|| "d1".to_string()) }
    }
    use DoseStatus::*;

    #[test]
    fn computes_windows_for_8pm_dose() {
        let w = dose8pm();
        assert_eq!(w.window_start, at("19:30"));
        assert_eq!(w.on_time_end, at("20:30"));
        assert_eq!(w.late_end, at("21:30"));
    }

    #[test]
    fn exact_on_time_boundaries_are_inclusive() {
        let w = dose8pm();
        assert_eq!(position_in_window(&w, ms(at("19:30"), -1)), WindowPosition::Before);
        assert_eq!(position_in_window(&w, at("19:30")), WindowPosition::OnTime);
        assert_eq!(position_in_window(&w, at("20:30")), WindowPosition::OnTime);
    }

    #[test]
    fn exact_late_boundaries() {
        let w = dose8pm();
        assert_eq!(position_in_window(&w, ms(at("20:30"), 1)), WindowPosition::Late);
        assert_eq!(position_in_window(&w, at("21:30")), WindowPosition::Late);
        assert_eq!(position_in_window(&w, ms(at("21:30"), 1)), WindowPosition::After);
    }

    #[test]
    fn rejects_2_99_second_hold() {
        assert_eq!(hold(2990, at("20:05"), Upcoming, false), rejected(AttemptReason::TooShort, true));
        assert_eq!(hold(2999, at("20:05"), Upcoming, false), rejected(AttemptReason::TooShort, true));
    }

    #[test]
    fn accepts_3_00_second_hold_on_time() {
        assert_eq!(hold(3000, at("20:05"), Upcoming, false), accepted(Taken));
    }

    #[test]
    fn hold_at_on_time_boundaries() {
        assert_eq!(hold(3000, at("19:30"), Upcoming, false), accepted(Taken));
        assert_eq!(hold(3000, at("20:30"), Reminded, false), accepted(Taken));
        assert_eq!(hold(3000, ms(at("19:30"), -1), Upcoming, false), rejected(AttemptReason::OutsideWindow, false));
    }

    #[test]
    fn hold_at_late_boundaries() {
        assert_eq!(hold(3000, ms(at("20:30"), 1), Upcoming, false), accepted(Late));
        assert_eq!(hold(3000, at("21:30"), Upcoming, false), accepted(Late));
        assert_eq!(hold(3000, ms(at("21:30"), 1), Upcoming, false), rejected(AttemptReason::OutsideWindow, false));
    }

    #[test]
    fn one_log_per_dose_time() {
        assert_eq!(hold(4000, at("20:10"), Taken, false), rejected(AttemptReason::AlreadyLogged, true));
        assert_eq!(hold(4000, at("21:00"), Late, false), rejected(AttemptReason::AlreadyLogged, true));
    }

    #[test]
    fn away_mode_rejects_holds() {
        assert_eq!(hold(4000, at("20:05"), Upcoming, true), rejected(AttemptReason::Away, true));
        assert_eq!(hold(4000, at("20:05"), Away, false), rejected(AttemptReason::Away, true));
    }

    #[test]
    fn delayed_valid_hold_resolves_missed_dose() {
        assert_eq!(
            hold(3500, at("20:10"), Missed, false),
            HoldDecision::Accepted { dose_id: "d1".into(), status: Taken, resolves_missed: true }
        );
        assert_eq!(
            hold(3500, at("21:10"), Missed, false),
            HoldDecision::Accepted { dose_id: "d1".into(), status: Late, resolves_missed: true }
        );
    }

    #[test]
    fn overlapping_windows_pick_nearest_dose() {
        let a = HoldCandidate { id: "a".into(), status: Upcoming, windows: compute_windows(at("20:00"), 30, 60) };
        let b = HoldCandidate { id: "b".into(), status: Upcoming, windows: compute_windows(at("21:00"), 30, 60) };
        assert_eq!(
            classify_hold(3200, at("20:55"), false, &[a, b]),
            HoldDecision::Accepted { dose_id: "b".into(), status: Taken, resolves_missed: false }
        );
    }

    #[test]
    fn missed_only_after_late_period() {
        let w = dose8pm();
        assert!(!should_mark_missed(Upcoming, &w, at("21:30")));
        assert!(should_mark_missed(Reminded, &w, ms(at("21:30"), 1)));
        for s in [Taken, Late, Missed, Away] {
            assert!(!should_mark_missed(s, &w, at("23:00")));
        }
    }

    #[test]
    fn reminder_repeats_every_20s_max_3() {
        let w = dose8pm();
        let real = Utc::now();
        assert!(!reminder_due(Upcoming, &w, 0, None, at("19:59"), real));
        assert!(reminder_due(Upcoming, &w, 0, None, at("20:00"), real));
        assert!(!reminder_due(Reminded, &w, 1, Some(ms(real, -19_999)), at("20:01"), real));
        assert!(reminder_due(Reminded, &w, 1, Some(ms(real, -20_000)), at("20:01"), real));
        assert!(!reminder_due(Reminded, &w, 3, None, at("20:05"), real));
        assert!(!reminder_due(Taken, &w, 0, None, at("20:05"), real));
        assert!(!reminder_due(Upcoming, &w, 0, None, ms(at("21:30"), 1), real));
    }

    #[test]
    fn one_slot_per_day_regardless_of_pills() {
        let from = parse_date_key("2026-11-14").unwrap();
        let to = parse_date_key("2026-11-16").unwrap();
        let eff = from_manila(parse_date_key("2026-11-01").unwrap(), "00:00");
        let slots = slots_for_range("20:00", 30, 60, eff, from, to);
        assert_eq!(slots.len(), 3);
        assert_eq!(slots[2], at("20:00"));
        let day = parse_date_key("2026-11-16").unwrap();
        assert!(slots_for_range("20:00", 30, 60, at("21:31"), day, day).is_empty());
        assert_eq!(slots_for_range("20:00", 30, 60, at("21:00"), day, day).len(), 1);
    }

    #[test]
    fn away_ranges_are_half_open() {
        let p = [TimeRange { starts_at: at("00:00"), ends_at: at("12:00") }];
        assert!(is_within_away(at("00:00"), &p));
        assert!(is_within_away(ms(at("12:00"), -1), &p));
        assert!(!is_within_away(at("12:00"), &p));
    }

    #[test]
    fn adherence_excludes_away() {
        let s = summarize_adherence([Taken, Taken, Late, Missed, Away, Away]);
        assert_eq!((s.counted, s.away, s.total), (4, 2, 6));
        assert_eq!(s.on_time_pct, Some(50));
        assert_eq!(s.adherence_pct, Some(75));
        assert_eq!(summarize_adherence([Away]).on_time_pct, None);
    }
}
