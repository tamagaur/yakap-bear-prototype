//! Asia/Manila time helpers (UTC+8, no daylight saving time).

use chrono::{DateTime, Datelike, Duration, FixedOffset, NaiveDate, NaiveTime, SecondsFormat, TimeZone, Utc};

pub fn manila() -> FixedOffset {
    FixedOffset::east_opt(8 * 3600).expect("valid offset")
}

/// Manila calendar day containing the instant.
pub fn date_of(dt: DateTime<Utc>) -> NaiveDate {
    dt.with_timezone(&manila()).date_naive()
}

/// "YYYY-MM-DD" of the Manila day containing the instant.
pub fn date_key(dt: DateTime<Utc>) -> String {
    key(date_of(dt))
}

pub fn key(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

pub fn parse_date_key(s: &str) -> Option<NaiveDate> {
    if s.len() != 10 {
        return None;
    }
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok().filter(|d| key(*d) == s)
}

/// Strict "HH:mm" 24-hour parser.
pub fn parse_time_of_day(s: &str) -> Option<NaiveTime> {
    let b = s.as_bytes();
    if b.len() != 5 || b[2] != b':' {
        return None;
    }
    NaiveTime::parse_from_str(s, "%H:%M").ok()
}

/// UTC instant of a Manila date + "HH:mm" wall-clock time.
pub fn from_manila(date: NaiveDate, hhmm: &str) -> DateTime<Utc> {
    let t = parse_time_of_day(hhmm).unwrap_or(NaiveTime::MIN);
    manila()
        .from_local_datetime(&date.and_time(t))
        .single()
        .expect("fixed offset is unambiguous")
        .with_timezone(&Utc)
}

pub fn start_of_day(date: NaiveDate) -> DateTime<Utc> {
    from_manila(date, "00:00")
}

/// "HH:mm" Manila wall-clock time of the instant.
pub fn time_of_day(dt: DateTime<Utc>) -> String {
    dt.with_timezone(&manila()).format("%H:%M").to_string()
}

/// Manila weekday, 0 = Sunday.
pub fn weekday(dt: DateTime<Utc>) -> u32 {
    dt.with_timezone(&manila()).weekday().num_days_from_sunday()
}

/// "8:00 PM"
pub fn format_time(dt: DateTime<Utc>) -> String {
    dt.with_timezone(&manila()).format("%-I:%M %p").to_string()
}

/// "Mon, Nov 16"
pub fn format_date(dt: DateTime<Utc>) -> String {
    dt.with_timezone(&manila()).format("%a, %b %-d").to_string()
}

/// "Nov 16, 2026"
pub fn format_short_date(dt: DateTime<Utc>) -> String {
    dt.with_timezone(&manila()).format("%b %-d, %Y").to_string()
}

/// "Mon, Nov 16 · 8:00 PM"
pub fn format_date_time(dt: DateTime<Utc>) -> String {
    format!("{} · {}", format_date(dt), format_time(dt))
}

pub fn add_days(d: NaiveDate, days: i64) -> NaiveDate {
    d + Duration::days(days)
}

/// Inclusive list of days.
pub fn date_range(from: NaiveDate, to: NaiveDate) -> Vec<NaiveDate> {
    let mut out = Vec::new();
    let mut d = from;
    while d <= to && out.len() < 400 {
        out.push(d);
        d = add_days(d, 1);
    }
    out
}

/// ISO-8601 with millisecond precision and `Z` (same as JS `toISOString`).
pub fn iso(dt: DateTime<Utc>) -> String {
    dt.to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn iso_opt(dt: Option<DateTime<Utc>>) -> Option<String> {
    dt.map(iso)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        parse_date_key(s).unwrap()
    }

    #[test]
    fn converts_manila_wall_clock_to_utc() {
        assert_eq!(iso(from_manila(d("2026-11-16"), "20:00")), "2026-11-16T12:00:00.000Z");
        assert_eq!(iso(from_manila(d("2026-11-17"), "07:30")), "2026-11-16T23:30:00.000Z");
    }

    #[test]
    fn round_trips_keys_times_and_weekdays() {
        let t = from_manila(d("2026-11-17"), "07:30");
        assert_eq!(date_key(t), "2026-11-17");
        assert_eq!(time_of_day(t), "07:30");
        assert_eq!(weekday(t), 2); // Tuesday
    }

    #[test]
    fn validates_keys_and_times() {
        assert!(parse_date_key("2026-02-30").is_none());
        assert!(parse_date_key("16-11-2026").is_none());
        assert!(parse_time_of_day("24:00").is_none());
        assert!(parse_time_of_day("8:00").is_none());
        assert!(parse_time_of_day("08:00").is_some());
    }

    #[test]
    fn formats_for_display() {
        let t = from_manila(d("2026-11-16"), "20:05");
        assert_eq!(format_time(t), "8:05 PM");
        assert_eq!(format_date(t), "Mon, Nov 16");
        assert_eq!(add_days(d("2026-11-30"), 1), d("2026-12-01"));
    }
}
