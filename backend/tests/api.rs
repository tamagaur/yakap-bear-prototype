//! HTTP-level integration tests against TEST_DATABASE_URL (never the dev DB).
//! Run with `npm run test:api` (single-threaded: suites share one database).
//! Each test resets the demo dataset first (clock = 7:45 PM Manila today).

// The lock is held across awaits on purpose: it serializes suites sharing one DB.
#![allow(clippy::await_holding_lock)]

use std::{collections::HashMap, sync::Mutex};

use axum::{
    Router,
    body::Body,
    http::{HeaderMap, Method, Request, StatusCode, header},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower::ServiceExt;
use yakap_api::{AppState, MIGRATOR, build_app, config::Config, seed};

static LOCK: Mutex<()> = Mutex::new(());
const BEAR_KEY: &str = "test-bear-key";

fn test_config(url: &str) -> Config {
    Config {
        database_url: url.into(),
        session_secret: "integration-test-secret-integration-test".into(),
        demo_mode: true,
        bear_device_key: BEAR_KEY.into(),
        port: 0,
        cookie_secure: false,
        auto_migrate: false,
    }
}

async fn setup() -> Option<(Router, PgPool)> {
    yakap_api::config::load_env_files();
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set — skipping integration test");
        return None;
    };
    let pool = PgPoolOptions::new().max_connections(5).connect(&url).await.expect("connect test db");
    MIGRATOR.run(&pool).await.expect("migrate test db");
    let cfg = test_config(&url);
    seed::reset_demo(&pool, &cfg, None).await.expect("reset demo");
    Some((build_app(AppState::new(pool.clone(), cfg)), pool))
}

/// Minimal cookie-keeping client around the in-process router.
struct Client {
    app: Router,
    cookies: HashMap<String, String>,
}

struct Res {
    status: StatusCode,
    headers: HeaderMap,
    body: Vec<u8>,
}

impl Res {
    fn json(&self) -> Value {
        serde_json::from_slice(&self.body).unwrap_or(Value::Null)
    }
    fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).into_owned()
    }
}

impl Client {
    fn new(app: &Router) -> Self {
        Self { app: app.clone(), cookies: HashMap::new() }
    }

    async fn send(&mut self, method: Method, path: &str, body: Option<Value>, extra: &[(&str, &str)]) -> Res {
        let mut b = Request::builder().method(method).uri(path);
        if !self.cookies.is_empty() {
            let c = self.cookies.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("; ");
            b = b.header(header::COOKIE, c);
        }
        for (k, v) in extra {
            b = b.header(*k, *v);
        }
        let req = match body {
            Some(v) => b.header(header::CONTENT_TYPE, "application/json").body(Body::from(v.to_string())),
            None => b.body(Body::empty()),
        }
        .unwrap();
        let res = self.app.clone().oneshot(req).await.unwrap();
        let status = res.status();
        let headers = res.headers().clone();
        for sc in headers.get_all(header::SET_COOKIE) {
            let s = sc.to_str().unwrap();
            let (pair, _) = s.split_once(';').unwrap_or((s, ""));
            let (k, v) = pair.split_once('=').unwrap();
            if v.is_empty() {
                self.cookies.remove(k);
            } else {
                self.cookies.insert(k.into(), v.into());
            }
        }
        let body = res.into_body().collect().await.unwrap().to_bytes().to_vec();
        Res { status, headers, body }
    }
    async fn get(&mut self, path: &str) -> Res {
        self.send(Method::GET, path, None, &[]).await
    }
    async fn post(&mut self, path: &str, body: Value) -> Res {
        self.send(Method::POST, path, Some(body), &[]).await
    }
    async fn login(&mut self, email: &str, area: &str) -> Res {
        self.post("/api/auth/login", json!({ "email": email, "password": seed::DEMO_PASSWORD, "area": area })).await
    }
    async fn bear(&mut self, method: Method, device: &str, action: &str, body: Option<Value>) -> Res {
        let path = format!("/api/bear/{device}/{action}");
        self.send(method, &path, body, &[("x-bear-key", BEAR_KEY)]).await
    }
    async fn clock(&mut self, body: Value) -> Res {
        let r = self.post("/api/demo/clock", body).await;
        assert_eq!(r.status, StatusCode::OK, "clock action failed: {}", r.text());
        r
    }
}

macro_rules! guard {
    () => {
        let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    };
}

async fn count(pool: &PgPool, sql: &'static str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
}

#[tokio::test]
async fn auth_rejects_bad_credentials_wrong_area_and_missing_sessions() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut c = Client::new(&app);
    let r = c.post("/api/auth/login", json!({ "email": "family@yakap.demo", "password": "nope", "area": "family" })).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert_eq!(r.json()["error"]["code"], "INVALID_CREDENTIALS");
    assert_eq!(c.login("doctor@yakap.demo", "family").await.status, StatusCode::FORBIDDEN);
    assert_eq!(c.get("/api/patients").await.status, StatusCode::UNAUTHORIZED);
    assert_eq!(c.get("/api/clinic/patients").await.status, StatusCode::UNAUTHORIZED);

    let r = c.login("family@yakap.demo", "family").await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.headers.get(header::SET_COOKIE).unwrap().to_str().unwrap().contains("HttpOnly"));
    assert_eq!(c.get("/api/auth/me?area=family").await.json()["user"]["email"], "family@yakap.demo");
    // A family session never opens clinic endpoints.
    assert_eq!(c.get("/api/clinic/patients").await.status, StatusCode::UNAUTHORIZED);
    let patients = c.get("/api/patients").await.json();
    assert_eq!(patients["patients"].as_array().unwrap().len(), 1);
    assert_eq!(patients["patients"][0]["nickname"], "Lola Rosa");
    // Another family's patient is invisible.
    assert_eq!(c.get("/api/patients/pat_jun").await.status, StatusCode::NOT_FOUND);
    assert_eq!(c.get("/api/patients/pat_jun/doses").await.status, StatusCode::NOT_FOUND);
    // Tampered cookie → 401.
    c.cookies.insert("yakap_family_session".into(), "garbage.token.value".into());
    assert_eq!(c.get("/api/patients").await.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn bear_reminder_hold_filter_and_one_log_per_dose() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    assert_eq!(
        c.send(Method::GET, "/api/bear/BEAR-0001/state", None, &[("x-bear-key", "wrong")]).await.status,
        StatusCode::UNAUTHORIZED
    );

    // 7:45 PM: the 8 PM window is open but the reminder isn't due yet.
    let s = c.bear(Method::GET, "BEAR-0001", "state", None).await.json();
    assert_eq!(s["patient"]["nickname"], "Lola Rosa");
    assert_eq!(s["activeDose"]["pillNote"], "3 pills");
    assert_eq!(s["reminderDue"], false);
    let dose_id = s["activeDose"]["doseId"].as_str().unwrap().to_string();

    c.clock(json!({ "action": "next-dose", "deviceId": "BEAR-0001" })).await;
    let s = c.bear(Method::GET, "BEAR-0001", "state", None).await.json();
    assert_eq!(s["reminderDue"], true);
    assert_eq!(s["activeDose"]["voice"]["isSample"], true);

    let r = c.bear(Method::POST, "BEAR-0001", "reminder", Some(json!({ "doseId": dose_id }))).await.json();
    assert_eq!((r["play"].as_bool(), r["reminderCount"].as_i64()), (Some(true), Some(1)));
    // The 20-second repeat rule is enforced by the server.
    let r = c.bear(Method::POST, "BEAR-0001", "reminder", Some(json!({ "doseId": dose_id }))).await.json();
    assert_eq!(r["play"], false);

    let r = c.bear(Method::POST, "BEAR-0001", "hold", Some(json!({ "clientEventId": "tap-0001-short", "holdMs": 2990 }))).await.json();
    assert_eq!((r["accepted"].as_bool(), r["reason"].as_str()), (Some(false), Some("TOO_SHORT")));
    let r = c.bear(Method::POST, "BEAR-0001", "hold", Some(json!({ "clientEventId": "hold-0001-ok", "holdMs": 3000 }))).await.json();
    assert_eq!((r["accepted"].as_bool(), r["status"].as_str()), (Some(true), Some("TAKEN")));
    // Same event again → duplicate, no double logging.
    let r = c.bear(Method::POST, "BEAR-0001", "hold", Some(json!({ "clientEventId": "hold-0001-ok", "holdMs": 3000 }))).await.json();
    assert_eq!((r["duplicate"].as_bool(), r["status"].as_str()), (Some(true), Some("TAKEN")));
    // A second pill / second hold for the same dose time → ALREADY_LOGGED.
    let r = c.bear(Method::POST, "BEAR-0001", "hold", Some(json!({ "clientEventId": "hold-0002-again", "holdMs": 4000 }))).await.json();
    assert_eq!(r["reason"], "ALREADY_LOGGED");

    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM dose_events WHERE id = $1 AND status = 'TAKEN' AND logged_by = 'BEAR'")
        .bind(&dose_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 1);
    assert_eq!(count(&pool, "SELECT count(*) FROM dose_attempts WHERE client_event_id IN ('tap-0001-short', 'hold-0002-again')").await, 2);
    // Exactly one event per schedule per dose time across the whole DB.
    assert_eq!(
        count(&pool, "SELECT count(*) FROM (SELECT schedule_id, scheduled_for FROM dose_events GROUP BY 1, 2 HAVING count(*) > 1) d").await,
        0
    );
}

#[tokio::test]
async fn missed_dose_creates_one_alert_and_simulated_sms() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    let alerts_before = count(&pool, "SELECT count(*) FROM alerts WHERE patient_id = 'pat_rosa'").await;
    let sms_before = count(&pool, "SELECT count(*) FROM sms_messages WHERE patient_id = 'pat_rosa'").await;

    // Inside the late period the dose is still open… (exact ms boundaries: unit tests)
    c.clock(json!({ "action": "advance", "minutes": 104 })).await; // ≈ 9:29 PM
    let open: String = sqlx::query_scalar(
        "SELECT status FROM dose_events WHERE schedule_id = 'sch_rosa_pm' ORDER BY scheduled_for DESC OFFSET 1 LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(open == "UPCOMING" || open == "REMINDED", "still open at 9:29 PM, got {open}");

    let r = c.clock(json!({ "action": "past-window", "deviceId": "BEAR-0001" })).await.json();
    assert!(r["message"].as_str().unwrap().contains("8:00 PM"));
    assert_eq!(count(&pool, "SELECT count(*) FROM alerts WHERE patient_id = 'pat_rosa'").await, alerts_before + 1);
    assert_eq!(count(&pool, "SELECT count(*) FROM sms_messages WHERE patient_id = 'pat_rosa'").await, sms_before + 2);

    c.login("family@yakap.demo", "family").await;
    let alerts = c.get("/api/patients/pat_rosa/alerts").await.json();
    assert_eq!(alerts["alerts"][0]["type"], "MISSED_DOSE");
    assert_eq!(alerts["alerts"][0]["title"], "Missed 8:00 PM dose");
    let sms = c.get("/api/patients/pat_rosa/sms").await.json();
    let last = sms["messages"].as_array().unwrap().last().unwrap().clone();
    assert!(last["body"].as_str().unwrap().contains("Lola Rosa's 8:00 PM dose"));
    // Re-evaluating never duplicates.
    c.get("/api/patients/pat_rosa/today").await;
    c.get("/api/patients/pat_rosa/alerts").await;
    assert_eq!(count(&pool, "SELECT count(*) FROM alerts WHERE patient_id = 'pat_rosa'").await, alerts_before + 1);
    // Acknowledge.
    let id = alerts["alerts"][0]["id"].as_str().unwrap();
    let r = c.post(&format!("/api/alerts/{id}/ack"), json!({})).await.json();
    assert_eq!(r["alert"]["acknowledgedByName"], "Ana Santos");
}

#[tokio::test]
async fn offline_sync_dedupes_and_resolves_missed_doses_on_time_and_late() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    let s = c.bear(Method::GET, "BEAR-0001", "state", None).await.json();
    let dose_id = s["activeDose"]["doseId"].as_str().unwrap().to_string();
    let scheduled: chrono::DateTime<chrono::Utc> = s["activeDose"]["scheduledFor"].as_str().unwrap().parse().unwrap();

    // Bear goes offline; the window passes → MISSED + alert on the server.
    c.clock(json!({ "action": "past-window", "deviceId": "BEAR-0001" })).await;
    // Reconnect: the hold made at 8:05 PM is synced and re-validated at its original time.
    let held = (scheduled + chrono::Duration::minutes(5)).to_rfc3339();
    let body = json!({ "events": [{ "clientEventId": "offline-0001-a", "holdMs": 3400, "heldAt": held }] });
    let r = c.bear(Method::POST, "BEAR-0001", "sync", Some(body.clone())).await.json();
    assert_eq!(r["results"][0]["status"], "TAKEN");
    assert_eq!(r["results"][0]["resolvedMissed"], true);
    let resolved: Option<String> = sqlx::query_scalar("SELECT resolution FROM alerts WHERE dose_event_id = $1")
        .bind(&dose_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(resolved.unwrap().contains("synced"));
    // Retrying the same sync never double-logs.
    let r = c.bear(Method::POST, "BEAR-0001", "sync", Some(body)).await.json();
    assert_eq!(r["results"][0]["duplicate"], true);
    let logged_by: String = sqlx::query_scalar("SELECT logged_by FROM dose_events WHERE id = $1")
        .bind(&dose_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(logged_by, "OFFLINE_SYNC");

    // Next dose (tomorrow 8:00 AM): a hold at 8:45 AM synced later counts as LATE.
    c.clock(json!({ "action": "next-dose", "deviceId": "BEAR-0001" })).await;
    let s = c.bear(Method::GET, "BEAR-0001", "state", None).await.json();
    let morning: chrono::DateTime<chrono::Utc> = s["activeDose"]["scheduledFor"].as_str().unwrap().parse().unwrap();
    c.clock(json!({ "action": "past-window", "deviceId": "BEAR-0001" })).await;
    let held = (morning + chrono::Duration::minutes(45)).to_rfc3339();
    let r = c
        .bear(Method::POST, "BEAR-0001", "sync", Some(json!({ "events": [{ "clientEventId": "offline-0002-b", "holdMs": 3100, "heldAt": held }] })))
        .await
        .json();
    assert_eq!(r["results"][0]["status"], "LATE");
}

#[tokio::test]
async fn clinician_access_requires_active_written_consent() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut doctor = Client::new(&app);
    assert_eq!(doctor.login("doctor@yakap.demo", "clinic").await.status, StatusCode::OK);
    let list = doctor.get("/api/clinic/patients").await.json();
    let names: Vec<&str> = list["patients"].as_array().unwrap().iter().map(|p| p["nickname"].as_str().unwrap()).collect();
    assert!(names.contains(&"Lola Rosa") && !names.contains(&"Kuya Jun"), "{names:?}");
    // Guessing an unconsented patient's id → 403 on every endpoint.
    for path in [
        "/api/clinic/patients/pat_jun",
        "/api/clinic/patients/pat_jun/doses",
        "/api/clinic/patients/pat_jun/summary",
        "/api/clinic/patients/pat_jun/pattern",
        "/api/clinic/patients/pat_jun/export.csv",
    ] {
        assert_eq!(doctor.get(path).await.status, StatusCode::FORBIDDEN, "{path}");
    }

    // Mae (Jun's wife) signs written consent for Dr. Reyes.
    let mut mae = Client::new(&app);
    mae.login("mae@yakap.demo", "family").await;
    let r = mae
        .post("/api/patients/pat_jun/consents", json!({ "clinicianId": "user_dr_reyes", "agreed": false, "signedName": "Mae Villanueva", "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" }))
        .await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    let r = mae
        .post("/api/patients/pat_jun/consents", json!({ "clinicianId": "user_dr_reyes", "agreed": true, "signedName": "Mae Villanueva", "signatureDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" }))
        .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text());
    let consent_id = r.json()["consent"]["id"].as_str().unwrap().to_string();
    assert_eq!(doctor.get("/api/clinic/patients/pat_jun").await.status, StatusCode::OK);

    // Revoke → access removed immediately; audit history stays.
    let audit_before = count(&pool, "SELECT count(*) FROM audit_log WHERE patient_id = 'pat_jun'").await;
    assert_eq!(mae.post(&format!("/api/consents/{consent_id}/revoke"), json!({})).await.status, StatusCode::OK);
    assert_eq!(doctor.get("/api/clinic/patients/pat_jun").await.status, StatusCode::FORBIDDEN);
    assert_eq!(count(&pool, "SELECT count(*) FROM audit_log WHERE patient_id = 'pat_jun'").await, audit_before + 1);
    assert!(count(&pool, "SELECT count(*) FROM audit_log WHERE patient_id = 'pat_jun' AND action = 'VIEW_PATIENT' AND actor_id = 'user_dr_reyes'").await >= 2);
    // The audit log itself is append-only.
    assert!(sqlx::query("DELETE FROM audit_log").execute(&pool).await.is_err());

    // Clinic admin can't read patient logs but can read the audit log; clinicians can't.
    let mut admin = Client::new(&app);
    admin.login("admin@yakap.demo", "clinic").await;
    assert_eq!(admin.get("/api/clinic/patients/pat_rosa").await.status, StatusCode::FORBIDDEN);
    assert_eq!(admin.get("/api/clinic/patients").await.json()["patients"].as_array().unwrap().len(), 0);
    let audit = admin.get("/api/clinic/audit").await.json();
    assert!(audit["entries"].as_array().unwrap().iter().any(|e| e["action"] == "CONSENT_REVOKE"));
    assert_eq!(doctor.get("/api/clinic/audit").await.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn family_correction_preserves_original_and_is_audited() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut ana = Client::new(&app);
    ana.login("family@yakap.demo", "family").await;
    let missed = ana.get("/api/patients/pat_rosa/doses?status=MISSED").await.json();
    let dose = missed["doses"][0].clone();
    let id = dose["id"].as_str().unwrap();

    let r = ana.post(&format!("/api/doses/{id}/correct"), json!({ "toStatus": "TAKEN", "reason": "" })).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST, "reason is required");
    let r = ana
        .post(&format!("/api/doses/{id}/correct"), json!({ "toStatus": "TAKEN", "takenAt": dose["scheduledFor"], "reason": "She took it at her sister's place." }))
        .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.text());
    let d = r.json()["dose"].clone();
    assert_eq!((d["status"].as_str(), d["corrected"].as_bool(), d["originalStatus"].as_str()), (Some("TAKEN"), Some(true), Some("MISSED")));
    assert_eq!(d["loggedBy"], "FAMILY");
    assert_eq!(d["corrections"][0]["fromStatus"], "MISSED");
    assert_eq!(d["corrections"][0]["correctedByName"], "Ana Santos");

    // A second correction keeps the very first original status.
    let r = ana.post(&format!("/api/doses/{id}/correct"), json!({ "toStatus": "MISSED", "reason": "Sorry — she actually skipped it." })).await;
    let d = r.json()["dose"].clone();
    assert_eq!((d["originalStatus"].as_str(), d["corrections"].as_array().unwrap().len()), (Some("MISSED"), 2));
    let audits: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'CORRECT_LOG' AND details->>'doseId' = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(audits, 2);
    // Future doses can't be "corrected".
    let today = ana.get("/api/patients/pat_rosa/today").await.json();
    let upcoming = today["nextDose"]["id"].as_str().unwrap();
    assert_eq!(
        ana.post(&format!("/api/doses/{upcoming}/correct"), json!({ "toStatus": "TAKEN", "reason": "testing future" })).await.status,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn exports_are_audited_and_away_days_are_excluded() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut doctor = Client::new(&app);
    doctor.login("doctor@yakap.demo", "clinic").await;
    let before = count(&pool, "SELECT count(*) FROM audit_log WHERE action IN ('EXPORT_CSV', 'EXPORT_PDF')").await;
    let r = doctor.get("/api/clinic/patients/pat_rosa/export.csv").await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.headers[header::CONTENT_TYPE].to_str().unwrap().starts_with("text/csv"));
    assert!(r.text().contains("Patient,Date,Dose"));
    let r = doctor.post("/api/clinic/patients/pat_rosa/export-log", json!({ "format": "pdf" })).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(!r.json()["doses"].as_array().unwrap().is_empty());
    assert_eq!(count(&pool, "SELECT count(*) FROM audit_log WHERE action IN ('EXPORT_CSV', 'EXPORT_PDF')").await, before + 2);

    // Teresa is in hospital: her away doses are excluded from adherence.
    let s = doctor.get("/api/clinic/patients/pat_teresa/summary?days=7").await.json();
    assert!(s["away"].as_i64().unwrap() > 0);
    assert_eq!(s["total"].as_i64().unwrap(), s["counted"].as_i64().unwrap() + s["away"].as_i64().unwrap());
    let pattern = doctor.get("/api/clinic/patients/pat_rosa/pattern?days=42").await.json();
    assert_eq!(pattern["cells"].as_array().unwrap().len(), 7);
    // Holds during away mode are rejected with reason AWAY.
    let mut c = Client::new(&app);
    let r = c.bear(Method::POST, "BEAR-0003", "hold", Some(json!({ "clientEventId": "away-hold-0001", "holdMs": 3500 }))).await.json();
    assert_eq!(r["reason"], "AWAY");
}

#[tokio::test]
async fn clinic_overview_is_role_specific_and_consent_scoped() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut anon = Client::new(&app);
    assert_eq!(anon.get("/api/clinic/overview").await.status, StatusCode::UNAUTHORIZED);

    let mut doctor = Client::new(&app);
    doctor.login("doctor@yakap.demo", "clinic").await;
    let o = doctor.get("/api/clinic/overview").await.json();
    assert_eq!(o["role"], "CLINICIAN");
    assert!(o["admin"].is_null());
    let c = &o["clinician"];
    assert_eq!(c["patients"], 4, "Rosa, Miguel, Teresa, Carmela — not Jun (revoked)");
    assert_eq!(c["awayNow"], 1, "Teresa is in hospital");
    assert!(c["week"]["counted"].as_i64().unwrap() > 0);
    let attention: Vec<&str> = c["needsAttention"].as_array().unwrap().iter().map(|a| a["nickname"].as_str().unwrap()).collect();
    assert!(!attention.contains(&"Kuya Jun") && !attention.contains(&"Tita Tess"), "{attention:?}");
    for m in c["recentMissed"].as_array().unwrap() {
        assert_ne!(m["patientId"], "pat_jun", "no data from unconsented patients");
    }
    assert!(!doctor.get("/api/clinic/overview").await.text().contains("Villanueva"));

    let mut admin = Client::new(&app);
    admin.login("admin@yakap.demo", "clinic").await;
    let o = admin.get("/api/clinic/overview").await.json();
    assert_eq!(o["role"], "CLINIC_ADMIN");
    assert!(o["clinician"].is_null(), "admins get no patient dose data");
    assert_eq!(o["admin"]["clinicians"], 2);
    assert_eq!(o["admin"]["activeConsents"], 5);
    assert!(o["admin"]["recentActivity"].as_array().unwrap().len() <= 6);
}

#[tokio::test]
async fn low_battery_alerts_once_and_rearms_after_charging() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    let r = c.bear(Method::POST, "BEAR-0001", "heartbeat", Some(json!({ "batteryPct": 15 }))).await.json();
    assert_eq!(r["alertCreated"], true);
    let r = c.bear(Method::POST, "BEAR-0001", "heartbeat", Some(json!({ "batteryPct": 12 }))).await.json();
    assert_eq!(r["alertCreated"], false);
    assert_eq!(count(&pool, "SELECT count(*) FROM alerts WHERE type = 'LOW_BATTERY' AND resolved_at IS NULL").await, 1);
    c.bear(Method::POST, "BEAR-0001", "heartbeat", Some(json!({ "batteryPct": 80 }))).await;
    assert_eq!(count(&pool, "SELECT count(*) FROM alerts WHERE type = 'LOW_BATTERY' AND resolved_at IS NULL").await, 0);
}

#[tokio::test]
async fn voice_audio_is_never_public() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut anon = Client::new(&app);
    assert_eq!(anon.get("/api/voice/voice_sample_rosa/audio").await.status, StatusCode::UNAUTHORIZED);
    let mut ana = Client::new(&app);
    ana.login("family@yakap.demo", "family").await;
    let r = ana.send(Method::GET, "/api/voice/voice_sample_rosa/audio", None, &[("range", "bytes=0-99")]).await;
    assert_eq!(r.status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(r.body.len(), 100);
    assert_eq!(ana.get("/api/voice/voice_sample_miguel/audio").await.status, StatusCode::NOT_FOUND);
    // A bear can only play its own patient's messages.
    let r = anon
        .send(Method::GET, "/api/voice/voice_sample_miguel/audio", None, &[("x-bear-key", BEAR_KEY), ("x-bear-device", "BEAR-0001")])
        .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    let r = anon
        .send(Method::GET, "/api/voice/voice_sample_rosa/audio", None, &[("x-bear-key", BEAR_KEY), ("x-bear-device", "BEAR-0001")])
        .await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.headers[header::CONTENT_TYPE], "audio/wav");
}

#[tokio::test]
async fn demo_reset_is_repeatable_and_consistent() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    c.clock(json!({ "action": "past-window", "deviceId": "BEAR-0001" })).await;
    let a = c.post("/api/demo/reset", json!({})).await.json();
    let b = c.post("/api/demo/reset", json!({})).await.json();
    assert_eq!(a["counts"], b["counts"]);
    assert_eq!(
        count(&pool, "SELECT count(*) FROM dose_events e LEFT JOIN alerts a ON a.dose_event_id = e.id WHERE e.status = 'MISSED' AND a.id IS NULL").await,
        0
    );
    // The demo clock restarts at 7:45 PM and keeps ticking in real time.
    let clock = c.get("/api/demo/clock").await.json();
    let reset_at: chrono::DateTime<chrono::Utc> = b["now"].as_str().unwrap().parse().unwrap();
    let now: chrono::DateTime<chrono::Utc> = clock["now"].as_str().unwrap().parse().unwrap();
    assert!((now - reset_at).num_seconds().abs() < 10, "clock {now} vs reset {reset_at}");
    assert!(b["now"].as_str().unwrap().ends_with("11:45:00.000Z"), "7:45 PM Manila");
}

#[tokio::test]
async fn database_outage_returns_503_not_a_crash() {
    guard!();
    let pool = PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_secs(2))
        .connect_lazy("postgres://postgres@127.0.0.1:1/nope")
        .unwrap();
    let app = build_app(AppState::new(pool, test_config("postgres://postgres@127.0.0.1:1/nope")));
    let mut c = Client::new(&app);
    let r = c.get("/api/demo/clock").await;
    assert_eq!(r.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(r.json()["error"]["code"], "DB_UNAVAILABLE");
    assert_eq!(c.get("/api/health").await.status, StatusCode::OK);
}

#[tokio::test]
async fn seeded_sunday_evening_pattern_is_the_same_after_every_reset() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut doctor = Client::new(&app);
    doctor.login("doctor@yakap.demo", "clinic").await;
    for days in [28, 42] {
        let p = doctor.get(&format!("/api/clinic/patients/pat_rosa/pattern?days={days}")).await.json();
        let top = &p["hotspots"][0];
        assert_eq!(top["weekday"], 0, "{days} days: Sunday should lead, got {top}");
        assert_eq!(top["timeOfDay"], "20:00");
        assert!(top["missed"].as_i64().unwrap() >= 3, "{days} days: {top}");
    }
}

#[tokio::test]
async fn clinic_lists_and_dashboard_carry_trend_pattern_and_device_data() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut doctor = Client::new(&app);
    doctor.login("doctor@yakap.demo", "clinic").await;

    // Sparklines: four weekly on-time values per patient, null where there is no data.
    let list = doctor.get("/api/clinic/patients").await.json();
    for row in list["patients"].as_array().unwrap() {
        let spark = row["spark"].as_array().unwrap();
        assert_eq!(spark.len(), 4, "{row}");
        for v in spark {
            assert!(v.is_null() || (0..=100).contains(&v.as_i64().unwrap()), "{row}");
        }
        if row["id"] == "pat_carmela" {
            assert!(spark.iter().all(Value::is_null), "no data yet → no trend");
        }
        if row["id"] == "pat_rosa" {
            assert!(spark.iter().any(|v| !v.is_null()));
        }
    }

    // Patient detail: the paired bear (never its key) and who gets the texts.
    let res = doctor.get("/api/clinic/patients/pat_rosa").await;
    assert!(!res.text().contains("deviceKey") && !res.text().contains(BEAR_KEY));
    let d = res.json();
    assert_eq!(d["device"]["id"], "BEAR-0001");
    assert!(d["device"]["batteryPct"].is_number());
    assert!(d["familyContacts"].as_array().unwrap().iter().any(|c| c["receivesSms"] == true));

    // Dashboard: previous week, six weekly points and the plain-language pattern reason.
    let o = doctor.get("/api/clinic/overview").await.json();
    let c = &o["clinician"];
    assert_eq!(c["weekly"].as_array().unwrap().len(), 6);
    assert!(c["weekPrev"]["counted"].as_i64().unwrap() > 0);
    let last = &c["weekly"][5];
    assert_eq!(last["counted"], c["week"]["counted"], "the last bucket is this week");
    let rosa = c["needsAttention"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["id"] == "pat_rosa")
        .expect("Rosa's Sunday pattern needs a conversation");
    assert_eq!(rosa["topPattern"]["weekday"], 0);
    assert_eq!(rosa["topPattern"]["timeOfDay"], "20:00");
    assert!(rosa["reasons"][0].as_str().unwrap().contains("Sunday 8:00 PM"), "{rosa}");
}

#[tokio::test]
async fn printed_checkup_sheets_are_audited() {
    guard!();
    let Some((app, _)) = setup().await else { return };
    let mut doctor = Client::new(&app);
    doctor.login("doctor@yakap.demo", "clinic").await;
    let r = doctor.post("/api/clinic/patients/pat_rosa/export-log", json!({ "format": "print" })).await;
    assert_eq!(r.status, StatusCode::OK);
    assert!(r.json()["summary"]["counted"].is_number());
    assert_eq!(
        doctor.post("/api/clinic/patients/pat_rosa/export-log", json!({ "format": "docx" })).await.status,
        StatusCode::BAD_REQUEST
    );
    // No consent → no sheet, and nothing is logged.
    assert_eq!(
        doctor.post("/api/clinic/patients/pat_jun/export-log", json!({ "format": "print" })).await.status,
        StatusCode::FORBIDDEN
    );

    let mut admin = Client::new(&app);
    admin.login("admin@yakap.demo", "clinic").await;
    let log = admin.get("/api/clinic/audit?action=PRINT_CHECKUP").await.json();
    let entries = log["entries"].as_array().unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0]["patientName"], "Rosa Santos");
    assert_eq!(entries[0]["details"]["format"], "print");
}

#[tokio::test]
async fn launcher_overview_is_demo_only_and_leaks_no_secrets() {
    guard!();
    let Some((app, pool)) = setup().await else { return };
    let mut c = Client::new(&app);
    let res = c.get("/api/demo/overview").await;
    assert_eq!(res.status, StatusCode::OK);
    let text = res.text();
    assert!(!text.contains("deviceKey") && !text.contains("audioUrl") && !text.contains(BEAR_KEY), "{text}");
    let o = res.json();
    assert_eq!(o["patient"]["id"], "pat_rosa");
    assert_eq!(o["device"]["id"], "BEAR-0001");
    assert_eq!(o["nextDose"]["label"], "Evening");
    assert!(o["reminder"]["title"].is_string());
    assert_eq!(o["people"]["family"]["name"], "Ana Santos");
    assert_eq!(o["people"]["clinician"]["name"], "Dr. Paolo Reyes");
    assert_eq!(o["people"]["admin"]["name"], "Carla Dizon");
    assert_eq!(c.get("/api/demo/overview?deviceId=BEAR-9999").await.status, StatusCode::NOT_FOUND);

    // A missed dose shows up as one more open alert and a fresh simulated text.
    let before = o["openAlerts"].as_i64().unwrap();
    c.clock(json!({ "action": "next-dose", "deviceId": "BEAR-0001" })).await;
    c.clock(json!({ "action": "past-window", "deviceId": "BEAR-0001" })).await;
    let o = c.get("/api/demo/overview").await.json();
    assert_eq!(o["openAlerts"].as_i64().unwrap(), before + 1);
    assert!(o["latestText"]["body"].as_str().unwrap().contains("Lola Rosa"), "{o}");
    let recipients: Vec<&str> =
        o["latestText"]["recipients"].as_array().unwrap().iter().map(|r| r.as_str().unwrap()).collect();
    assert_eq!(recipients, ["Ana Santos", "Mia Santos"], "every opted-in contact got the text");

    // Outside demo mode the endpoint is closed.
    let url = std::env::var("TEST_DATABASE_URL").unwrap();
    let locked = build_app(AppState::new(pool.clone(), Config { demo_mode: false, ..test_config(&url) }));
    assert_eq!(Client::new(&locked).get("/api/demo/overview").await.status, StatusCode::FORBIDDEN);
}
