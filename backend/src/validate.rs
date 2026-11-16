//! Small request-validation helpers producing field-level 400 errors.

use chrono::NaiveDate;

use crate::{error::ApiError, time};

pub fn text(value: &str, field: &str, min: usize, max: usize, msg: &str) -> Result<String, ApiError> {
    let t = value.trim();
    let n = t.chars().count();
    if n < min || n > max {
        return Err(ApiError::validation(field, msg));
    }
    Ok(t.to_string())
}

pub fn opt_text(value: Option<&str>, field: &str, max: usize) -> Result<Option<String>, ApiError> {
    match value.map(str::trim) {
        None | Some("") => Ok(None),
        Some(t) if t.chars().count() > max => {
            Err(ApiError::validation(field, format!("Keep it under {max} characters")))
        }
        Some(t) => Ok(Some(t.to_string())),
    }
}

pub fn email(value: &str) -> Result<String, ApiError> {
    let e = value.trim().to_lowercase();
    let valid = e.len() <= 120
        && e.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.starts_with('.') && !domain.ends_with('.')
        })
        && !e.contains(char::is_whitespace);
    if !valid {
        return Err(ApiError::validation("email", "Enter a valid email"));
    }
    Ok(e)
}

pub fn phone(value: &str) -> Result<String, ApiError> {
    let p = value.trim();
    let ok = (7..=24).contains(&p.len())
        && p.chars().next().is_some_and(|c| c == '+' || c.is_ascii_digit())
        && p.chars().all(|c| c.is_ascii_digit() || c == ' ' || c == '-' || c == '+');
    if !ok {
        return Err(ApiError::validation("phone", "Enter a phone number (digits, spaces, + or -)"));
    }
    Ok(p.to_string())
}

pub fn time_of_day(value: &str) -> Result<String, ApiError> {
    time::parse_time_of_day(value)
        .map(|_| value.to_string())
        .ok_or_else(|| ApiError::validation("timeOfDay", "Use HH:mm (24-hour)"))
}

pub fn date_key(value: &str, field: &str) -> Result<NaiveDate, ApiError> {
    time::parse_date_key(value).ok_or_else(|| ApiError::validation(field, "Use YYYY-MM-DD"))
}

pub fn int_range(value: i32, field: &str, min: i32, max: i32) -> Result<i32, ApiError> {
    if value < min || value > max {
        return Err(ApiError::validation(field, format!("Must be between {min} and {max}")));
    }
    Ok(value)
}
