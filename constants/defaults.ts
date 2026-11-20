import type { AppData, AppSettings, Weekday } from '@/types/models';

export const MAX_RECORDING_MS = 30_000;
export const MAX_SAVED_RECORDINGS = 10;
export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const SUPPORT_EMAIL_PLACEHOLDER = 'Add your support contact before launch';

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  followUpEnabled: true,
  followUpMinutes: 30,
  showMedicationNameInNotifications: true,
  autoPlayVoice: true,
  hapticsEnabled: true,
  onTimeWindowMinutes: 30,
  lateWindowMinutes: 90,
  familyAlertsEnabled: true,
  includeMedicationNameInTexts: false,
  awayPeriods: [],
};

export function createEmptyData(): AppData {
  return {
    schemaVersion: 1,
    caregiver: null,
    recipient: null,
    medications: [],
    schedules: [],
    events: [],
    recordings: [],
    contacts: [],
    bear: null,
    referral: null,
    consents: [],
    activity: [],
    settings: { ...DEFAULT_SETTINGS, awayPeriods: [] },
    onboarding: { completed: false, step: 0 },
    dismissedAlerts: [],
    hasSamplePlan: false,
  };
}

export const RELATIONSHIP_OPTIONS = [
  'Grandmother',
  'Grandfather',
  'Mother',
  'Father',
  'Child',
  'Aunt',
  'Uncle',
  'Spouse',
  'Sibling',
  'Friend',
  'Other',
].map((value) => ({ value, label: value }));

export const CONTACT_RELATIONSHIP_OPTIONS = [
  'Daughter',
  'Son',
  'Granddaughter',
  'Grandson',
  'Sibling',
  'Spouse',
  'Niece or nephew',
  'Friend',
  'Neighbor',
  'Paid caregiver',
  'Other',
].map((value) => ({ value, label: value }));

export const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Manila', label: 'Manila (GMT+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10/+11)' },
];

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
  } catch {
    return 'Asia/Manila';
  }
}

export function getTimeZoneOptions() {
  const device = getDeviceTimeZone();
  if (TIME_ZONE_OPTIONS.some((option) => option.value === device)) return TIME_ZONE_OPTIONS;
  return [{ value: device, label: `${device.replace(/_/g, ' ')} (this phone)` }, ...TIME_ZONE_OPTIONS];
}

export function getTimeZoneLabel(value: string): string {
  return getTimeZoneOptions().find((option) => option.value === value)?.label ?? value.replace(/_/g, ' ');
}
