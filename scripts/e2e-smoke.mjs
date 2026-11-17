// npm run e2e — end-to-end smoke test against a running app (default http://localhost:3000).
// Resets the demo data before and after. Usage: BASE=https://your-deploy npm run e2e
// End-to-end demonstration against the running app (through the Next.js proxy, like a browser).
const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = "yakap-demo-2026";
let failures = 0;
const results = [];
function check(step, ok, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

class Client {
  constructor() { this.cookies = new Map(); this.headers = {}; }
  async req(method, path, { json, form, headers = {}, redirect = "manual" } = {}) {
    const h = { ...this.headers, ...headers };
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    let body;
    if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(BASE + path, { method, headers: h, body, redirect });
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(";"); const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (v) this.cookies.set(k, v); else this.cookies.delete(k);
    }
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : type.startsWith("audio") ? await res.arrayBuffer() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }
  get(p, o) { return this.req("GET", p, o); }
  post(p, json, o = {}) { return this.req("POST", p, { json, ...o }); }
  login(email, area) { return this.post("/api/auth/login", { email, password: PASSWORD, area }); }
}

function wav(seconds = 1.2) {
  const sr = 8000, n = Math.floor(sr * seconds), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / sr) * 2 * Math.PI * 440) * 6000), 44 + i * 2);
  return buf;
}

const anon = new Client(), ana = new Client(), doctor = new Client(), mae = new Client(), admin = new Client(), bear = new Client();

// Fresh start
let r = await anon.post("/api/demo/reset", {});
check("Reset demo before run", r.status === 200 && r.data.now.endsWith("11:45:00.000Z"), `clock ${r.data.now}`);
const initialCounts = r.data.counts;

// Launcher data (demo mode only): live strip, role cards, voice card
const launch = await anon.get("/api/demo/overview");
check("Launcher overview: bear, next dose, people", launch.status === 200 && launch.data.device.id === "BEAR-0001" && launch.data.nextDose?.label === "Evening" && launch.data.people.family?.name === "Ana Santos" && launch.data.people.admin?.name === "Carla Dizon", `next ${launch.data.nextDose?.label}, open alerts ${launch.data.openAlerts}`);
check("    Launcher overview lists every recipient of the latest text", Array.isArray(launch.data.latestText?.recipients) && launch.data.latestText.recipients.length >= 1, (launch.data.latestText?.recipients ?? []).join(", "));
check("    Launcher overview leaks no device key or audio URL", !/deviceKey|audioUrl/.test(JSON.stringify(launch.data)));

// 1–2 launcher & bear pages
check("1. Open the launcher", (await anon.get("/")).status === 200);
check("2. Open the bear simulator", (await anon.get("/bear")).status === 200);
const devices = (await anon.get("/api/demo/devices")).data.devices;
const b1 = devices.find((d) => d.id === "BEAR-0001");
bear.headers = { "x-bear-key": b1.deviceKey };

// Family records a voice message (MediaRecorder output simulated with a WAV upload)
check("Invalid login is rejected", (await anon.post("/api/auth/login", { email: "family@yakap.demo", password: "wrong", area: "family" })).status === 401);
r = await ana.login("family@yakap.demo", "family");
check("Family signs in", r.status === 200, r.data.user?.name);
const fd = new FormData();
fd.append("file", new Blob([wav()], { type: "audio/wav" }), "ana.wav");
fd.append("title", "Ana's 8 PM reminder");
fd.append("durationSec", "1.2");
fd.append("scheduleId", "sch_rosa_pm");
r = await ana.req("POST", "/api/patients/pat_rosa/voice", { form: fd });
check("Family uploads a recorded reminder and assigns it to 8:00 PM", r.status === 201, r.data.voice?.title);
const voiceId = r.data.voice?.id;

// 3–5 reminder plays the family voice
r = await anon.post("/api/demo/clock", { action: "next-dose", deviceId: "BEAR-0001" });
check("4. Trigger the medication reminder (jump to 8:00 PM)", r.status === 200, r.data.message);
let s = (await bear.get("/api/bear/BEAR-0001/state")).data;
check("   Reminder is due on the bear", s.reminderDue === true && s.activeDose?.status !== "TAKEN");
check("   Assigned voice is the family recording (not the sample)", s.activeDose?.voice?.id === voiceId && !s.activeDose.voice.isSample, s.activeDose?.voice?.title);
r = await bear.post("/api/bear/BEAR-0001/reminder", { doseId: s.activeDose.doseId });
check("5. Server allows playback of reminder 1/3", r.data.play === true && r.data.voiceId === voiceId);
r = await bear.get(`/api/voice/${voiceId}/audio`, { headers: { "x-bear-device": "BEAR-0001" } });
check("   Bear downloads the family audio", r.status === 200 && r.headers.get("content-type") === "audio/wav", `${r.data.byteLength} bytes`);
r = await bear.post("/api/bear/BEAR-0001/reminder", { doseId: s.activeDose.doseId });
check("   Immediate repeat is refused (20 s rule)", r.data.play === false);

// 6–7 hold
r = await bear.post("/api/bear/BEAR-0001/hold", { clientEventId: "e2e-tap-0001", holdMs: 1200 });
check("   1.2 s tap → rejected TOO_SHORT", r.data.accepted === false && r.data.reason === "TOO_SHORT");
r = await bear.post("/api/bear/BEAR-0001/hold", { clientEventId: "e2e-hold-0001", holdMs: 3000 });
check("6–7. 3-second hold → dose TAKEN", r.data.accepted && r.data.status === "TAKEN");
r = await bear.post("/api/bear/BEAR-0001/hold", { clientEventId: "e2e-hold-0001", holdMs: 3000 });
check("   Duplicate submission is idempotent", r.data.duplicate === true);
const today = (await ana.get("/api/patients/pat_rosa/today")).data;
check("   Family 'today' shows 8:00 PM as TAKEN", today.doses.some((d) => d.label === "Evening" && d.status === "TAKEN"));

// 8–11 missed dose
const alertsBefore = (await ana.get("/api/patients/pat_rosa/alerts")).data.alerts.length;
const smsBefore = (await ana.get("/api/patients/pat_rosa/sms")).data.messages.length;
r = await anon.post("/api/demo/clock", { action: "next-dose", deviceId: "BEAR-0001" });
check("8. Advance to the next dose", r.status === 200, r.data.message);
r = await anon.post("/api/demo/clock", { action: "past-window", deviceId: "BEAR-0001" });
check("9–10. Leave it unacknowledged and jump past the late period", r.status === 200, r.data.message);
const alerts = (await ana.get("/api/patients/pat_rosa/alerts")).data;
check("11. Missed-dose alert generated", alerts.alerts.length === alertsBefore + 1 && alerts.alerts[0].type === "MISSED_DOSE", alerts.alerts[0]?.title);
const sms = (await ana.get("/api/patients/pat_rosa/sms")).data.messages;
check("12–13. Family sees the alert and 2 simulated SMS (Ana, Ben)", sms.length === smsBefore + 2, sms.at(-1)?.body.slice(0, 70) + "…");
const missedAlert = alerts.alerts[0];

// 14–18 clinic + consent
r = await anon.get("/clinic");
check("    /clinic without a session → clinic login", [307, 308].includes(r.status) && (r.headers.get("location") ?? "").endsWith("/clinic/login"));
r = await doctor.login("doctor@yakap.demo", "clinic");
check("14. Clinician signs in to the clinic dashboard", r.status === 200);
r = await doctor.get("/clinic/login");
check("    Signed-in clinician opening /clinic/login goes to the dashboard", [307, 308].includes(r.status) && new URL(r.headers.get("location"), BASE).pathname === "/clinic");
check("    Dashboard page (/clinic) renders for the signed-in clinician", (await doctor.get("/clinic")).status === 200);
const ov = (await doctor.get("/api/clinic/overview")).data;
check("    Dashboard overview: consented patients only, no admin data", ov.role === "CLINICIAN" && ov.clinician?.patients === 4 && ov.admin === null, `on time 7d ${ov.clinician?.week.onTimePct}%`);
const list = (await doctor.get("/api/clinic/patients")).data.patients.map((p) => p.id);
check("15. Consented patients are listed", list.includes("pat_rosa") && list.includes("pat_miguel"), list.join(", "));
check("    Detail page data loads", (await doctor.get("/api/clinic/patients/pat_rosa")).status === 200);
check("16. Unconsented patient (Jun) is inaccessible", !list.includes("pat_jun") && (await doctor.get("/api/clinic/patients/pat_jun")).status === 403);
check("    URL tampering on export is blocked too", (await doctor.get("/api/clinic/patients/pat_jun/export.csv")).status === 403);
check("    Page guard redirects signed-out visitors", [307, 308].includes((await anon.get("/clinic/patients")).status));
await mae.login("mae@yakap.demo", "family");
r = await mae.post("/api/patients/pat_jun/consents", { clinicianId: "user_dr_reyes", agreed: true, signedName: "Mae Villanueva", signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" });
check("17. Family grants written consent", r.status === 201);
check("    Clinician can now open Jun's record", (await doctor.get("/api/clinic/patients/pat_jun")).status === 200);
r = await mae.post(`/api/consents/${r.data.consent.id}/revoke`, {});
check("18. Family revokes consent", r.status === 200 && r.data.consent.active === false);
check("    Access removed immediately", (await doctor.get("/api/clinic/patients/pat_jun")).status === 403);

// 19 correction
r = await ana.post(`/api/doses/${missedAlert.doseEventId}/correct`, { toStatus: "TAKEN", reason: "ok" });
check("    A correction without a real explanation is rejected", r.status === 400, r.data.error?.message);
const missedDose = (await ana.get("/api/patients/pat_rosa/doses?status=MISSED")).data.doses.find((d) => d.id === missedAlert.doseEventId);
r = await ana.post(`/api/doses/${missedAlert.doseEventId}/correct`, { toStatus: "LATE", takenAt: new Date(new Date(missedDose.onTimeEnd).getTime() + 10 * 60000).toISOString(), reason: "Mama took it at 8:40 AM before leaving for the market." });
check("19. Family corrects the missed dose (with reason)", r.status === 200 && r.data.dose.status === "LATE" && r.data.dose.originalStatus === "MISSED", `corrections: ${r.data.dose?.corrections.length}`);
const resolved = (await ana.get("/api/patients/pat_rosa/alerts")).data.alerts.find((a) => a.id === missedAlert.id);
check("    The missed-dose alert is resolved by the correction", !!resolved?.resolvedAt);

// 20 export + audit
r = await doctor.get("/api/clinic/patients/pat_rosa/export.csv");
check("20. Clinician exports CSV", r.status === 200 && String(r.data).includes("Patient,Date,Dose"));
await admin.login("admin@yakap.demo", "clinic");
const aov = (await admin.get("/api/clinic/overview")).data;
check("    Admin dashboard: clinic-wide counts, no patient dose data", aov.role === "CLINIC_ADMIN" && aov.clinician === null && aov.admin?.exports7 >= 1, `exports 7d: ${aov.admin?.exports7}`);
const audit = (await admin.get("/api/clinic/audit")).data.entries;
check("    Admin audit shows the export", audit.some((e) => e.action === "EXPORT_CSV" && e.patientName === "Rosa Santos" && e.details?.from));
check("    Admin audit shows the correction", audit.some((e) => e.action === "CORRECT_LOG" && String(e.details?.reason).includes("market")));
check("    Admin audit shows consent grant + revoke", audit.some((e) => e.action === "CONSENT_GRANT" && e.patientName === "Jun Villanueva") && audit.some((e) => e.action === "CONSENT_REVOKE"));
check("    Clinicians cannot read the audit log", (await doctor.get("/api/clinic/audit")).status === 403);

// Extra checks
check("Missing session → 401 on family API", (await anon.get("/api/patients")).status === 401);
const carmela = (await doctor.get("/api/clinic/patients/pat_carmela")).data;
check("Empty record (Carmela) has no dose data yet", carmela.firstDoseDate === null);
const b3 = devices.find((d) => d.id === "BEAR-0004");
const sJun = (await (Object.assign(new Client(), { headers: { "x-bear-key": b3.deviceKey } })).get("/api/bear/BEAR-0004/state")).data;
check("Missing voice recording → bear falls back to chime (voice null)", sJun.doses.every((d) => d.voice === null));

// Design-refresh data: sparklines, paired bear, alert recipients, printed check-up sheet
const rows = (await doctor.get("/api/clinic/patients")).data.patients;
check("Patient list carries a 4-week sparkline per patient", rows.every((p) => Array.isArray(p.spark) && p.spark.length === 4) && rows.find((p) => p.id === "pat_carmela").spark.every((v) => v === null));
const rosaDetail = (await doctor.get("/api/clinic/patients/pat_rosa")).data;
check("Patient detail shows the paired bear and who gets texts", rosaDetail.device?.id === "BEAR-0001" && !("deviceKey" in rosaDetail.device) && rosaDetail.familyContacts.some((c) => c.receivesSms === true));
const printed = await doctor.post("/api/clinic/patients/pat_rosa/export-log", { format: "print" });
const printAudit = (await admin.get("/api/clinic/audit?action=PRINT_CHECKUP")).data.entries;
check("Printing a check-up sheet is audited", printed.status === 200 && printAudit.length === 1 && printAudit[0].patientName === "Rosa Santos");

// 21 reset
r = await anon.post("/api/demo/reset", {});
const voicesAfter = (await ana.get("/api/patients/pat_rosa/voice")).data.voices;
check("21. Reset restores the initial state", JSON.stringify(r.data.counts) === JSON.stringify(initialCounts) && voicesAfter.length === 1 && voicesAfter[0].isSample, JSON.stringify(r.data.counts));
const pat = (await doctor.get("/api/clinic/patients/pat_rosa/pattern?days=28")).data;
check("    Seeded pattern: Lola Rosa most often misses Sunday 8:00 PM", pat.hotspots[0]?.weekday === 0 && pat.hotspots[0]?.timeOfDay === "20:00" && pat.hotspots[0]?.missed >= 3, JSON.stringify(pat.hotspots[0]));
const dash = (await doctor.get("/api/clinic/overview")).data.clinician;
const rosaAttn = dash.needsAttention.find((a) => a.id === "pat_rosa");
check("    Dashboard: 6-week trend, last week, and Rosa's pattern reason", dash.weekly.length === 6 && dash.weekPrev.counted > 0 && /Sunday 8:00 PM/.test(rosaAttn?.reasons[0] ?? ""), rosaAttn?.reasons[0]);
check("    Seeded sessions survive the reset", (await ana.get("/api/auth/me?area=family")).data.user?.email === "family@yakap.demo");

console.log(results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
