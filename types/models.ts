/** ISO-8601 timestamp, e.g. 2026-05-20T08:04:00.000Z */
export type ISODateTime = string;
/** Local calendar day formatted as yyyy-MM-dd. */
export type DateKey = string;
/** Local 24-hour time formatted as HH:mm. */
export type TimeOfDay = string;
/** 0 = Sunday ... 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Caregiver {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: ISODateTime;
}

export interface CareRecipient {
  id: string;
  preferredName: string;
  relationship: string;
  timeZone: string;
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  /** Prescribed quantity exactly as the caregiver entered it, e.g. "2 tablets". */
  doseLabel: string;
  instructions?: string;
  isSample?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

/**
 * One recurring time for a medication. Changing the time or repeat days ends this
 * row and starts a new one, so past history keeps the schedule it was logged against.
 */
export interface DoseSchedule {
  id: string;
  medicationId: string;
  time: TimeOfDay;
  repeatDays: Weekday[];
  startDate: DateKey;
  endDate?: DateKey;
  /** Occurrences before this moment never existed, e.g. an 8 AM dose added at noon. */
  activeFrom: ISODateTime;
  voiceRecordingId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DoseEventType = 'taken' | 'skipped' | 'unconfirmed';
export type DoseEventSource = 'caregiver' | 'demo_paw' | 'correction' | 'sample';

/** Append-only log entry. Corrections add a new event and never rewrite an old one. */
export interface DoseEvent {
  id: string;
  occurrenceKey: string;
  scheduleId: string;
  medicationId: string;
  medicationName: string;
  doseLabel: string;
  date: DateKey;
  time: TimeOfDay;
  type: DoseEventType;
  takenAt?: ISODateTime;
  recordedAt: ISODateTime;
  recordedBy: string;
  source: DoseEventSource;
  reason?: string;
  correctsEventId?: string;
}

export type DoseStatus = 'upcoming' | 'taken' | 'late' | 'missed' | 'skipped' | 'away';

export interface DoseOccurrence {
  key: string;
  scheduleId: string;
  medicationId: string;
  date: DateKey;
  time: TimeOfDay;
  scheduledAt: Date;
  medicationName: string;
  doseLabel: string;
  instructions?: string;
  voiceRecordingId?: string;
  status: DoseStatus;
  /** True when a taken dose was confirmed after the on-time window closed. */
  confirmedLate: boolean;
  events: DoseEvent[];
  latestEvent?: DoseEvent;
  isSample: boolean;
}

export interface VoiceRecording {
  id: string;
  name: string;
  /** File name only. The folder is resolved at runtime because app paths can change. */
  fileName: string;
  durationMs: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FamilyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  notifyMissedDose: boolean;
  notifyBearIssues: boolean;
  /** When the caregiver confirmed this person agreed to receive care texts. */
  consentConfirmedAt?: ISODateTime;
  isSample?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BearConnectionState = 'disconnected' | 'searching' | 'pairing' | 'connected';
export type BearPlaybackState = 'idle' | 'chime' | 'playing' | 'awaiting_confirmation';

export interface BearDevice {
  id: string;
  serial: string;
  mode: 'demo' | 'hardware';
  pairedAt: ISODateTime;
  lastBattery: number;
}

export interface Referral {
  id: string;
  code: string;
  /** "demo" is a labeled sample. "verified" means the backend confirmed the code. */
  status: 'demo' | 'verified';
  clinicName: string;
  clinicianName?: string;
  linkedAt: ISODateTime;
}

export interface Consent {
  id: string;
  kind: 'clinic_sharing';
  status: 'active' | 'revoked';
  clinicName: string;
  scopes: string[];
  signedBy: string;
  /** SVG path data for the finger signature. */
  signaturePath: string;
  grantedAt: ISODateTime;
  revokedAt?: ISODateTime;
}

export type ActivityKind =
  | 'dose_taken'
  | 'dose_skipped'
  | 'dose_corrected'
  | 'sms_opened'
  | 'voice_saved'
  | 'contact_added'
  | 'medication_changed'
  | 'consent_changed'
  | 'away_changed'
  | 'bear_changed';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  message: string;
  at: ISODateTime;
  isSample?: boolean;
}

export interface AwayPeriod {
  id: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  followUpEnabled: boolean;
  followUpMinutes: number;
  showMedicationNameInNotifications: boolean;
  autoPlayVoice: boolean;
  hapticsEnabled: boolean;
  onTimeWindowMinutes: number;
  lateWindowMinutes: number;
  familyAlertsEnabled: boolean;
  includeMedicationNameInTexts: boolean;
  /** Numbers the caregiver enters for their own location. The app ships with none. */
  emergencyNumber?: string;
  clinicNumber?: string;
  awayPeriods: AwayPeriod[];
}

export interface OnboardingProgress {
  completed: boolean;
  step: number;
}

export interface AppData {
  schemaVersion: 1;
  caregiver: Caregiver | null;
  recipient: CareRecipient | null;
  medications: Medication[];
  schedules: DoseSchedule[];
  events: DoseEvent[];
  recordings: VoiceRecording[];
  contacts: FamilyContact[];
  bear: BearDevice | null;
  referral: Referral | null;
  consents: Consent[];
  activity: ActivityEntry[];
  settings: AppSettings;
  onboarding: OnboardingProgress;
  dismissedAlerts: string[];
  hasSamplePlan: boolean;
}

export interface MedicationDoseInput {
  scheduleId?: string;
  time: TimeOfDay;
  voiceRecordingId?: string;
}

export interface MedicationInput {
  id?: string;
  name: string;
  doseLabel: string;
  instructions?: string;
  repeatDays: Weekday[];
  doses: MedicationDoseInput[];
}

export interface ContactInput {
  id?: string;
  name: string;
  relationship: string;
  phone: string;
  notifyMissedDose: boolean;
  notifyBearIssues: boolean;
  consentConfirmed: boolean;
}

export type SessionKind = 'demo' | 'cloud';

export interface Session {
  kind: SessionKind;
  userId: string;
  email?: string;
  displayName?: string;
  startedAt: ISODateTime;
}
