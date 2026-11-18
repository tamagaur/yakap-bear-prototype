import type { SupabaseClient } from '@supabase/supabase-js';

import { createEmptyData } from '@/constants/defaults';
import type { CareRepository } from '@/repositories/types';
import type {
  ActivityEntry,
  AppData,
  BearDevice,
  CareRecipient,
  Consent,
  DoseEvent,
  DoseSchedule,
  FamilyContact,
  Medication,
  Referral,
  VoiceRecording,
} from '@/types/models';

type Row = Record<string, unknown>;

const clean = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === undefined ? null : value]));
const opt = <T>(value: unknown) => (value === null || value === undefined ? undefined : (value as T));

const toMedicationRow = (item: Medication, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  name: item.name,
  dose_label: item.doseLabel,
  instructions: item.instructions,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
  archived_at: item.archivedAt,
});
const fromMedicationRow = (row: Row): Medication => ({
  id: row.id as string,
  name: row.name as string,
  doseLabel: row.dose_label as string,
  instructions: opt(row.instructions),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  archivedAt: opt(row.archived_at),
});

const toScheduleRow = (item: DoseSchedule, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  medication_id: item.medicationId,
  time_of_day: item.time,
  repeat_days: item.repeatDays,
  start_date: item.startDate,
  end_date: item.endDate,
  active_from: item.activeFrom,
  voice_recording_id: item.voiceRecordingId,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const fromScheduleRow = (row: Row): DoseSchedule => ({
  id: row.id as string,
  medicationId: row.medication_id as string,
  time: (row.time_of_day as string).slice(0, 5),
  repeatDays: row.repeat_days as DoseSchedule['repeatDays'],
  startDate: row.start_date as string,
  endDate: opt(row.end_date),
  activeFrom: row.active_from as string,
  voiceRecordingId: opt(row.voice_recording_id),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const toEventRow = (item: DoseEvent, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  occurrence_key: item.occurrenceKey,
  schedule_id: item.scheduleId,
  medication_id: item.medicationId,
  medication_name: item.medicationName,
  dose_label: item.doseLabel,
  dose_date: item.date,
  time_of_day: item.time,
  event_type: item.type,
  taken_at: item.takenAt,
  recorded_at: item.recordedAt,
  recorded_by: item.recordedBy,
  source: item.source,
  reason: item.reason,
  corrects_event_id: item.correctsEventId,
});
const fromEventRow = (row: Row): DoseEvent => ({
  id: row.id as string,
  occurrenceKey: row.occurrence_key as string,
  scheduleId: row.schedule_id as string,
  medicationId: row.medication_id as string,
  medicationName: row.medication_name as string,
  doseLabel: row.dose_label as string,
  date: row.dose_date as string,
  time: (row.time_of_day as string).slice(0, 5),
  type: row.event_type as DoseEvent['type'],
  takenAt: opt(row.taken_at),
  recordedAt: row.recorded_at as string,
  recordedBy: row.recorded_by as string,
  source: row.source as DoseEvent['source'],
  reason: opt(row.reason),
  correctsEventId: opt(row.corrects_event_id),
});

const toRecordingRow = (item: VoiceRecording, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  name: item.name,
  file_name: item.fileName,
  duration_ms: item.durationMs,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const fromRecordingRow = (row: Row): VoiceRecording => ({
  id: row.id as string,
  name: row.name as string,
  fileName: row.file_name as string,
  durationMs: row.duration_ms as number,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const toContactRow = (item: FamilyContact, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  name: item.name,
  relationship: item.relationship,
  phone: item.phone,
  notify_missed_dose: item.notifyMissedDose,
  notify_bear_issues: item.notifyBearIssues,
  consent_confirmed_at: item.consentConfirmedAt,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
const fromContactRow = (row: Row): FamilyContact => ({
  id: row.id as string,
  name: row.name as string,
  relationship: row.relationship as string,
  phone: row.phone as string,
  notifyMissedDose: row.notify_missed_dose as boolean,
  notifyBearIssues: row.notify_bear_issues as boolean,
  consentConfirmedAt: opt(row.consent_confirmed_at),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const toConsentRow = (item: Consent, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  kind: item.kind,
  status: item.status,
  clinic_name: item.clinicName,
  scopes: item.scopes,
  signed_by: item.signedBy,
  signature_path: item.signaturePath,
  granted_at: item.grantedAt,
  revoked_at: item.revokedAt,
});
const fromConsentRow = (row: Row): Consent => ({
  id: row.id as string,
  kind: row.kind as Consent['kind'],
  status: row.status as Consent['status'],
  clinicName: row.clinic_name as string,
  scopes: row.scopes as string[],
  signedBy: row.signed_by as string,
  signaturePath: row.signature_path as string,
  grantedAt: row.granted_at as string,
  revokedAt: opt(row.revoked_at),
});

const toActivityRow = (item: ActivityEntry, recipientId: string): Row => ({
  id: item.id,
  care_recipient_id: recipientId,
  kind: item.kind,
  message: item.message,
  at: item.at,
});
const fromActivityRow = (row: Row): ActivityEntry => ({
  id: row.id as string,
  kind: row.kind as ActivityEntry['kind'],
  message: row.message as string,
  at: row.at as string,
});

/** Tables whose rows the caregiver can remove. Dose events are append-only and never deleted. */
const DELETABLE_TABLES = ['medications', 'dose_schedules', 'voice_recordings', 'family_contacts'] as const;

/**
 * Optional cloud storage. Row Level Security in supabase/migrations decides who can read
 * each row, so this class only ever runs with the signed-in user's own access token.
 */
export class SupabaseCareRepository implements CareRepository {
  readonly kind = 'cloud' as const;
  private lastSynced = new Map<string, string>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async load(): Promise<AppData | null> {
    const { data: profile, error } = await this.client
      .from('caregiver_profiles')
      .select('*')
      .eq('id', this.userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return null;

    const { data: recipientRow, error: recipientError } = await this.client
      .from('care_recipients')
      .select('*')
      .eq('owner_id', this.userId)
      .maybeSingle();
    if (recipientError) throw recipientError;

    const empty = createEmptyData();
    const stored = (profile.app_state ?? {}) as Partial<AppData>;
    const caregiver = {
      id: this.userId,
      name: profile.display_name as string,
      email: opt<string>(profile.email),
      phone: opt<string>(profile.phone),
      createdAt: profile.created_at as string,
    };
    const base: AppData = {
      ...empty,
      caregiver,
      settings: { ...empty.settings, ...stored.settings },
      onboarding: stored.onboarding ?? empty.onboarding,
      dismissedAlerts: stored.dismissedAlerts ?? [],
    };
    if (!recipientRow) return base;

    const recipientId = recipientRow.id as string;
    const select = async (table: string) => {
      const result = await this.client.from(table).select('*').eq('care_recipient_id', recipientId);
      if (result.error) throw result.error;
      return (result.data ?? []) as Row[];
    };
    const [medications, schedules, events, recordings, contacts, consents, activity, bears, referrals] =
      await Promise.all([
        select('medications'),
        select('dose_schedules'),
        select('dose_events'),
        select('voice_recordings'),
        select('family_contacts'),
        select('consents'),
        select('care_activity'),
        select('bear_devices'),
        select('referrals'),
      ]);

    const recipient: CareRecipient = {
      id: recipientId,
      preferredName: recipientRow.preferred_name as string,
      relationship: recipientRow.relationship as string,
      timeZone: recipientRow.time_zone as string,
      notes: opt(recipientRow.notes),
    };
    const bearRow = bears[0];
    const bear: BearDevice | null = bearRow
      ? {
          id: bearRow.id as string,
          serial: bearRow.serial as string,
          mode: bearRow.mode as BearDevice['mode'],
          pairedAt: bearRow.paired_at as string,
          lastBattery: bearRow.last_battery as number,
        }
      : null;
    const referralRow = referrals[0];
    const referral: Referral | null = referralRow
      ? {
          id: referralRow.id as string,
          code: referralRow.code as string,
          status: referralRow.status as Referral['status'],
          clinicName: referralRow.clinic_name as string,
          clinicianName: opt(referralRow.clinician_name),
          linkedAt: referralRow.linked_at as string,
        }
      : null;

    return {
      ...base,
      recipient,
      medications: medications.map(fromMedicationRow),
      schedules: schedules.map(fromScheduleRow),
      events: events.map(fromEventRow),
      recordings: recordings.map(fromRecordingRow),
      contacts: contacts.map(fromContactRow),
      consents: consents.map(fromConsentRow),
      activity: activity.map(fromActivityRow).sort((a, b) => b.at.localeCompare(a.at)),
      bear,
      referral,
    };
  }

  private async upsertChanged(table: string, rows: Row[]) {
    const changed = rows.filter((row) => this.lastSynced.get(`${table}:${row.id}`) !== JSON.stringify(row));
    if (changed.length === 0) return;
    const { error } = await this.client.from(table).upsert(changed.map(clean));
    if (error) throw error;
    changed.forEach((row) => this.lastSynced.set(`${table}:${row.id}`, JSON.stringify(row)));
  }

  private async deleteRemoved(table: (typeof DELETABLE_TABLES)[number], rows: Row[]) {
    const keep = new Set(rows.map((row) => row.id as string));
    const removed = [...this.lastSynced.keys()]
      .filter((key) => key.startsWith(`${table}:`))
      .map((key) => key.slice(table.length + 1))
      .filter((id) => !keep.has(id));
    if (removed.length === 0) return;
    const { error } = await this.client.from(table).delete().in('id', removed);
    if (error) throw error;
    removed.forEach((id) => this.lastSynced.delete(`${table}:${id}`));
  }

  async save(data: AppData): Promise<void> {
    if (!data.caregiver) return;
    await this.upsertChanged('caregiver_profiles', [
      {
        id: this.userId,
        display_name: data.caregiver.name,
        email: data.caregiver.email,
        phone: data.caregiver.phone,
        app_state: {
          settings: data.settings,
          onboarding: data.onboarding,
          dismissedAlerts: data.dismissedAlerts,
        },
      },
    ]);
    if (!data.recipient) return;
    const recipientId = data.recipient.id;
    await this.upsertChanged('care_recipients', [
      {
        id: recipientId,
        owner_id: this.userId,
        preferred_name: data.recipient.preferredName,
        relationship: data.recipient.relationship,
        time_zone: data.recipient.timeZone,
        notes: data.recipient.notes,
      },
    ]);

    const medications = data.medications.filter((item) => !item.isSample).map((item) => toMedicationRow(item, recipientId));
    const recordings = data.recordings.map((item) => toRecordingRow(item, recipientId));
    const medicationIds = new Set(medications.map((row) => row.id));
    const schedules = data.schedules
      .filter((item) => medicationIds.has(item.medicationId))
      .map((item) => toScheduleRow(item, recipientId));
    const contacts = data.contacts.filter((item) => !item.isSample).map((item) => toContactRow(item, recipientId));

    await this.upsertChanged('medications', medications);
    await this.upsertChanged('voice_recordings', recordings);
    await this.upsertChanged('dose_schedules', schedules);
    await this.upsertChanged('family_contacts', contacts);
    await this.upsertChanged(
      'dose_events',
      data.events.filter((item) => item.source !== 'sample').map((item) => toEventRow(item, recipientId)),
    );
    await this.upsertChanged('consents', data.consents.map((item) => toConsentRow(item, recipientId)));
    await this.upsertChanged(
      'care_activity',
      data.activity.filter((item) => !item.isSample).map((item) => toActivityRow(item, recipientId)),
    );

    await this.deleteRemoved('dose_schedules', schedules);
    await this.deleteRemoved('medications', medications);
    await this.deleteRemoved('voice_recordings', recordings);
    await this.deleteRemoved('family_contacts', contacts);
  }

  async clear(): Promise<void> {
    const { error } = await this.client.from('care_recipients').delete().eq('owner_id', this.userId);
    if (error) throw error;
    this.lastSynced.clear();
  }
}
