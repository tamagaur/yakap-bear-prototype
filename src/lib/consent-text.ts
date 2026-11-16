/** Written consent shown to the family before sharing dose logs (task M9 / B8). */
export const CONSENT_VERSION = "2026-11-v1";

export const CONSENT_SUMMARY =
  "Share {nickname}'s Yakap Bear dose log with the clinician you choose, so check-ups can use real data instead of memory.";

export const CONSENT_POINTS: { title: string; body: string }[] = [
  {
    title: "What the clinician will see",
    body: "Dose times, whether each dose was taken on time, late, missed or excused (away mode), when the paw was held, who logged it, and any corrections the family made — including the reason.",
  },
  {
    title: "What is never shared",
    body: "Voice recordings. The bear has no microphone and never records the patient. Family voice messages stay in the family app.",
  },
  {
    title: "Your control",
    body: "You can revoke this consent at any time in Settings → Clinician consent. Access stops immediately. Records of past views and exports stay in the audit log.",
  },
  {
    title: "Accountability",
    body: "Every time the clinician views or exports the log, it is recorded in an audit log that you and the clinic can review.",
  },
];

export const CONSENT_CHECKBOX =
  "I have read the points above and I consent to sharing this dose log with the selected clinician. I am the patient or I have the patient's permission to give this consent.";

export const PROTOTYPE_NOTICE =
  "Academic prototype — not a medical device and not a certified data-privacy system. Uses fictional demo data.";
