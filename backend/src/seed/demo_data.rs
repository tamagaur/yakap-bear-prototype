//! Fictional demo data (task D11). No real people, numbers or records.
//! Phone numbers use the 555 pattern.

pub const CLINIC_NAME: &str = "Kalinga Mind Clinic";

pub struct SeedUser {
    pub id: &'static str,
    pub email: &'static str,
    pub name: &'static str,
    pub role: &'static str,
    pub clinic_name: Option<&'static str>,
    pub title: Option<&'static str>,
}

pub const USERS: &[SeedUser] = &[
    SeedUser { id: "user_ana", email: "family@yakap.demo", name: "Ana Santos", role: "FAMILY", clinic_name: None, title: None },
    SeedUser { id: "user_joy", email: "joy@yakap.demo", name: "Joy Bautista", role: "FAMILY", clinic_name: None, title: None },
    SeedUser { id: "user_rico", email: "rico@yakap.demo", name: "Rico Lim", role: "FAMILY", clinic_name: None, title: None },
    SeedUser { id: "user_mae", email: "mae@yakap.demo", name: "Mae Villanueva", role: "FAMILY", clinic_name: None, title: None },
    SeedUser { id: "user_lito", email: "lito@yakap.demo", name: "Lito Cruz", role: "FAMILY", clinic_name: None, title: None },
    SeedUser {
        id: "user_dr_reyes",
        email: "doctor@yakap.demo",
        name: "Dr. Paolo Reyes",
        role: "CLINICIAN",
        clinic_name: Some(CLINIC_NAME),
        title: Some("Psychiatrist"),
    },
    SeedUser {
        id: "user_dr_manalo",
        email: "liza@yakap.demo",
        name: "Dr. Liza Manalo",
        role: "CLINICIAN",
        clinic_name: Some(CLINIC_NAME),
        title: Some("Clinical Psychologist"),
    },
    SeedUser {
        id: "user_dr_tan",
        email: "mark@yakap.demo",
        name: "Dr. Mark Tan",
        role: "CLINICIAN",
        clinic_name: Some("Bayanihan Wellness Center"),
        title: Some("Psychiatrist"),
    },
    SeedUser {
        id: "user_admin",
        email: "admin@yakap.demo",
        name: "Carla Dizon",
        role: "CLINIC_ADMIN",
        clinic_name: Some(CLINIC_NAME),
        title: Some("Clinic administrator"),
    },
];

/// Outcome tweak for (weekdays, dose time): 0 = Sunday.
pub struct Pattern {
    pub weekdays: &'static [u32],
    pub time_of_day: &'static str,
    pub missed: Option<f64>,
    pub late: Option<f64>,
}

pub struct Profile {
    pub taken: f64,
    pub late: f64,
    pub patterns: &'static [Pattern],
}

pub struct SeedContact {
    pub name: &'static str,
    pub relationship: &'static str,
    pub phone: &'static str,
    pub receives_sms: bool,
}

pub struct SeedSchedule {
    pub id: &'static str,
    pub label: &'static str,
    pub time_of_day: &'static str,
    pub pill_note: &'static str,
    /// Days before "today" that the schedule took effect (negative = starts in the future).
    pub since_days: i64,
    pub sample_voice: bool,
}

pub struct SeedPatient {
    pub key: &'static str,
    pub id: &'static str,
    pub full_name: &'static str,
    pub nickname: &'static str,
    pub birth_year: i32,
    pub device_id: &'static str,
    pub member_user_id: &'static str,
    pub member_relationship: &'static str,
    pub contacts: &'static [SeedContact],
    pub schedules: &'static [SeedSchedule],
    pub history_days: i64,
    pub profile: Profile,
    pub created_days_ago: i64,
    pub sample_voice: bool,
    pub battery_pct: i32,
}

pub const PATIENTS: &[SeedPatient] = &[
    SeedPatient {
        key: "rosa",
        id: "pat_rosa",
        full_name: "Rosa Santos",
        nickname: "Lola Rosa",
        birth_year: 1958,
        device_id: "BEAR-0001",
        member_user_id: "user_ana",
        member_relationship: "Granddaughter",
        contacts: &[
            // Same family as the mobile app's sample plan: Ana (granddaughter, app user) and Mia (daughter).
            SeedContact { name: "Ana Santos", relationship: "Granddaughter", phone: "+63 917 555 0142", receives_sms: true },
            SeedContact { name: "Mia Santos", relationship: "Daughter", phone: "+63 917 555 0198", receives_sms: true },
        ],
        schedules: &[
            SeedSchedule { id: "sch_rosa_am", label: "Morning", time_of_day: "08:00", pill_note: "2 tablets", since_days: 60, sample_voice: false },
            SeedSchedule { id: "sch_rosa_pm", label: "Evening", time_of_day: "20:00", pill_note: "3 pills", since_days: 60, sample_voice: true },
        ],
        history_days: 42,
        profile: Profile {
            taken: 0.84,
            late: 0.09,
            patterns: &[
                Pattern { weekdays: &[0], time_of_day: "20:00", missed: Some(0.6), late: None },
                Pattern { weekdays: &[1], time_of_day: "08:00", missed: None, late: Some(0.5) },
            ],
        },
        created_days_ago: 45,
        sample_voice: true,
        battery_pct: 82,
    },
    SeedPatient {
        key: "miguel",
        id: "pat_miguel",
        full_name: "Miguel Bautista",
        nickname: "Migs",
        birth_year: 1991,
        device_id: "BEAR-0002",
        member_user_id: "user_joy",
        member_relationship: "Sister",
        contacts: &[SeedContact { name: "Joy Bautista", relationship: "Sister", phone: "+63 917 555 0177", receives_sms: true }],
        schedules: &[
            SeedSchedule { id: "sch_migs_am", label: "Morning", time_of_day: "09:00", pill_note: "1 capsule", since_days: 50, sample_voice: false },
            SeedSchedule { id: "sch_migs_pm", label: "Night", time_of_day: "21:00", pill_note: "2 tablets", since_days: 50, sample_voice: false },
        ],
        history_days: 42,
        profile: Profile {
            taken: 0.78,
            late: 0.12,
            patterns: &[
                Pattern { weekdays: &[1, 2, 3, 4, 5], time_of_day: "09:00", missed: None, late: Some(0.35) },
                Pattern { weekdays: &[5], time_of_day: "21:00", missed: Some(0.45), late: None },
            ],
        },
        created_days_ago: 50,
        sample_voice: true,
        battery_pct: 64,
    },
    SeedPatient {
        key: "teresa",
        id: "pat_teresa",
        full_name: "Teresa Lim",
        nickname: "Tita Tess",
        birth_year: 1972,
        device_id: "BEAR-0003",
        member_user_id: "user_rico",
        member_relationship: "Husband",
        contacts: &[SeedContact { name: "Rico Lim", relationship: "Husband", phone: "+63 920 555 0110", receives_sms: true }],
        schedules: &[
            SeedSchedule { id: "sch_tess_am", label: "Morning", time_of_day: "08:00", pill_note: "1 tablet", since_days: 60, sample_voice: false },
            SeedSchedule { id: "sch_tess_pm", label: "Night", time_of_day: "20:30", pill_note: "1 tablet", since_days: 60, sample_voice: false },
        ],
        history_days: 42,
        profile: Profile {
            taken: 0.9,
            late: 0.05,
            patterns: &[Pattern { weekdays: &[6], time_of_day: "20:30", missed: None, late: Some(0.4) }],
        },
        created_days_ago: 70,
        sample_voice: false,
        battery_pct: 47,
    },
    SeedPatient {
        key: "jun",
        id: "pat_jun",
        full_name: "Jun Villanueva",
        nickname: "Kuya Jun",
        birth_year: 1980,
        device_id: "BEAR-0004",
        member_user_id: "user_mae",
        member_relationship: "Wife",
        contacts: &[SeedContact { name: "Mae Villanueva", relationship: "Wife", phone: "+63 919 555 0123", receives_sms: true }],
        schedules: &[
            SeedSchedule { id: "sch_jun_am", label: "Morning", time_of_day: "07:30", pill_note: "1 tablet", since_days: 50, sample_voice: false },
            SeedSchedule { id: "sch_jun_pm", label: "Evening", time_of_day: "19:30", pill_note: "2 pills", since_days: 50, sample_voice: false },
        ],
        history_days: 42,
        profile: Profile {
            taken: 0.62,
            late: 0.15,
            patterns: &[
                Pattern { weekdays: &[6], time_of_day: "07:30", missed: Some(0.5), late: None },
                Pattern { weekdays: &[6], time_of_day: "19:30", missed: Some(0.5), late: None },
            ],
        },
        created_days_ago: 55,
        sample_voice: false,
        battery_pct: 91,
    },
    SeedPatient {
        key: "carmela",
        id: "pat_carmela",
        full_name: "Carmela Cruz",
        nickname: "Mela",
        birth_year: 1996,
        device_id: "BEAR-0005",
        member_user_id: "user_lito",
        member_relationship: "Father",
        contacts: &[SeedContact { name: "Lito Cruz", relationship: "Father", phone: "+63 915 555 0166", receives_sms: true }],
        schedules: &[SeedSchedule { id: "sch_mela_bed", label: "Bedtime", time_of_day: "22:00", pill_note: "1 tablet", since_days: -1, sample_voice: false }],
        history_days: 0,
        profile: Profile { taken: 0.9, late: 0.05, patterns: &[] },
        created_days_ago: 0,
        sample_voice: false,
        battery_pct: 100,
    },
];

pub struct SeedConsent {
    pub id: &'static str,
    pub patient_id: &'static str,
    pub clinician_id: &'static str,
    pub granted_by_id: &'static str,
    pub signed_name: &'static str,
    pub days_ago: i64,
    pub revoked_days_ago: Option<i64>,
}

pub const CONSENTS: &[SeedConsent] = &[
    SeedConsent { id: "con_rosa_reyes", patient_id: "pat_rosa", clinician_id: "user_dr_reyes", granted_by_id: "user_ana", signed_name: "Ana Santos", days_ago: 30, revoked_days_ago: None },
    SeedConsent { id: "con_migs_reyes", patient_id: "pat_miguel", clinician_id: "user_dr_reyes", granted_by_id: "user_joy", signed_name: "Joy Bautista", days_ago: 25, revoked_days_ago: None },
    SeedConsent { id: "con_tess_reyes", patient_id: "pat_teresa", clinician_id: "user_dr_reyes", granted_by_id: "user_rico", signed_name: "Rico Lim", days_ago: 35, revoked_days_ago: None },
    SeedConsent { id: "con_jun_reyes", patient_id: "pat_jun", clinician_id: "user_dr_reyes", granted_by_id: "user_mae", signed_name: "Mae Villanueva", days_ago: 38, revoked_days_ago: Some(12) },
    SeedConsent { id: "con_jun_manalo", patient_id: "pat_jun", clinician_id: "user_dr_manalo", granted_by_id: "user_mae", signed_name: "Mae Villanueva", days_ago: 10, revoked_days_ago: None },
    SeedConsent { id: "con_mela_reyes", patient_id: "pat_carmela", clinician_id: "user_dr_reyes", granted_by_id: "user_lito", signed_name: "Lito Cruz", days_ago: 0, revoked_days_ago: None },
];

pub struct SeedAway {
    pub id: &'static str,
    pub patient_id: &'static str,
    pub from_days_ago: i64,
    pub to_days_ahead: i64,
    pub reason: &'static str,
    pub note: &'static str,
    pub created_by_id: &'static str,
}

/// Teresa is in hospital: away from 4 days ago until 2 days from now.
pub const AWAY: &[SeedAway] = &[SeedAway {
    id: "away_tess_hospital",
    patient_id: "pat_teresa",
    from_days_ago: 4,
    to_days_ahead: 2,
    reason: "Hospital stay",
    note: "Admitted for a few days — the ward handles her medicines.",
    created_by_id: "user_rico",
}];

pub struct SeedView {
    pub actor: &'static str,
    pub patient_id: &'static str,
    pub days_ago: i64,
    pub action: &'static str,
}

/// Historical clinician activity for the audit view.
pub const VIEWS: &[SeedView] = &[
    SeedView { actor: "user_dr_reyes", patient_id: "pat_rosa", days_ago: 28, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_rosa", days_ago: 14, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_rosa", days_ago: 14, action: "EXPORT_CSV" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_rosa", days_ago: 7, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_miguel", days_ago: 20, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_miguel", days_ago: 6, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_miguel", days_ago: 6, action: "EXPORT_PDF" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_teresa", days_ago: 10, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_reyes", patient_id: "pat_jun", days_ago: 30, action: "VIEW_PATIENT" },
    SeedView { actor: "user_dr_manalo", patient_id: "pat_jun", days_ago: 5, action: "VIEW_PATIENT" },
];

/// Lola Rosa's corrected dose: 9 days ago, evening — the family fixed a missed log.
pub struct SeedCorrection {
    pub patient_key: &'static str,
    pub days_ago: i64,
    pub time_of_day: &'static str,
    pub reason: &'static str,
    pub taken_at_time: &'static str,
    pub corrected_by_id: &'static str,
}

pub const CORRECTION: SeedCorrection = SeedCorrection {
    patient_key: "rosa",
    days_ago: 9,
    time_of_day: "20:00",
    reason: "Lola took her 8 PM pills at Tita Nena's house — the bear stayed at home.",
    taken_at_time: "20:10",
    corrected_by_id: "user_ana",
};
