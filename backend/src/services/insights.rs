//! Adherence cards and weekly pattern (tasks D9, D10). Away doses are excluded.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use sqlx::PgPool;

use crate::{
    dose_rules::{DoseStatus, summarize_adherence},
    dto::{AdherenceSummaryDto, DailyAdherenceDto, HotspotDto, PatternCellDto, PatternDto, PatternTimeDto},
    time,
};

fn range(days: i64, now: DateTime<Utc>) -> (chrono::NaiveDate, chrono::NaiveDate, DateTime<Utc>) {
    let to = time::date_of(now);
    let from = time::add_days(to, -(days - 1));
    (from, to, time::start_of_day(from))
}

pub async fn adherence_summary(
    pool: &PgPool,
    patient_id: &str,
    days: i64,
    now: DateTime<Utc>,
) -> sqlx::Result<AdherenceSummaryDto> {
    let (from, to, start) = range(days, now);
    let rows: Vec<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT status, scheduled_for FROM dose_events
         WHERE patient_id = $1 AND status IN ('TAKEN', 'LATE', 'MISSED', 'AWAY')
           AND scheduled_for >= $2 AND scheduled_for <= $3",
    )
    .bind(patient_id)
    .bind(start)
    .bind(now)
    .fetch_all(pool)
    .await?;
    let statuses: Vec<(DoseStatus, DateTime<Utc>)> =
        rows.into_iter().filter_map(|(s, t)| DoseStatus::parse(&s).map(|s| (s, t))).collect();
    let counts = summarize_adherence(statuses.iter().map(|(s, _)| *s));
    let mut daily: BTreeMap<String, DailyAdherenceDto> = time::date_range(from, to)
        .into_iter()
        .map(|d| {
            let k = time::key(d);
            (k.clone(), DailyAdherenceDto { date: k, taken: 0, late: 0, missed: 0, away: 0 })
        })
        .collect();
    for (s, t) in &statuses {
        if let Some(d) = daily.get_mut(&time::date_key(*t)) {
            match s {
                DoseStatus::Taken => d.taken += 1,
                DoseStatus::Late => d.late += 1,
                DoseStatus::Missed => d.missed += 1,
                DoseStatus::Away => d.away += 1,
                _ => {}
            }
        }
    }
    Ok(AdherenceSummaryDto {
        days,
        from: time::key(from),
        to: time::key(to),
        counts,
        daily: daily.into_values().collect(),
    })
}

pub async fn weekly_pattern(pool: &PgPool, patient_id: &str, days: i64, now: DateTime<Utc>) -> sqlx::Result<PatternDto> {
    let (from, to, start) = range(days, now);
    let rows: Vec<(String, DateTime<Utc>, String)> = sqlx::query_as(
        "SELECT e.status, e.scheduled_for, s.label FROM dose_events e
         JOIN dose_schedules s ON s.id = e.schedule_id
         WHERE e.patient_id = $1 AND e.status IN ('TAKEN', 'LATE', 'MISSED')
           AND e.scheduled_for >= $2 AND e.scheduled_for <= $3",
    )
    .bind(patient_id)
    .bind(start)
    .bind(now)
    .fetch_all(pool)
    .await?;
    let mut labels: BTreeMap<String, String> = BTreeMap::new();
    for (_, t, label) in &rows {
        labels.insert(time::time_of_day(*t), label.clone());
    }
    let times: Vec<PatternTimeDto> =
        labels.into_iter().map(|(time_of_day, label)| PatternTimeDto { time_of_day, label }).collect();
    let index = |tod: &str| times.iter().position(|t| t.time_of_day == tod);
    let mut cells = vec![vec![PatternCellDto::default(); times.len()]; 7];
    for (s, t, _) in &rows {
        let Some(i) = index(&time::time_of_day(*t)) else { continue };
        let cell = &mut cells[time::weekday(*t) as usize][i];
        cell.total += 1;
        match s.as_str() {
            "MISSED" => cell.missed += 1,
            "LATE" => cell.late += 1,
            _ => cell.taken += 1,
        }
    }
    let mut hotspots: Vec<HotspotDto> = cells
        .iter()
        .enumerate()
        .flat_map(|(weekday, row)| {
            row.iter().enumerate().filter(|(_, c)| c.missed > 0).map(move |(i, c)| (weekday, i, *c))
        })
        .map(|(weekday, i, c)| HotspotDto {
            weekday: weekday as u32,
            time_of_day: times[i].time_of_day.clone(),
            missed: c.missed,
            total: c.total,
        })
        .collect();
    hotspots.sort_by(|a, b| {
        let ra = a.missed as f64 / a.total as f64;
        let rb = b.missed as f64 / b.total as f64;
        rb.partial_cmp(&ra).unwrap_or(std::cmp::Ordering::Equal).then(b.missed.cmp(&a.missed))
    });
    hotspots.truncate(3);
    Ok(PatternDto { days, from: time::key(from), to: time::key(to), times, cells, hotspots })
}
