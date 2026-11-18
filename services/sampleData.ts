import { subDays } from 'date-fns';

import { ALL_DAYS, getDeviceTimeZone } from '@/constants/defaults';
import { DEMO_START_BATTERY } from '@/services/bear';
import { createDemoReferral } from '@/services/referrals';
import type { AppData, DoseEvent, DoseSchedule, FamilyContact, Medication } from '@/types/models';
import { createId } from '@/utils/ids';
import { combineDateTime, occurrenceKey, toDateKey } from '@/utils/schedule';

const HISTORY_DAYS = 13;

/**
 * An explicitly labeled example plan for presentations. Every record is flagged as a sample
 * and dates are built from today, so nothing here can be mistaken for a real care record.
 */
export function buildSamplePlan(base: AppData, now: Date): AppData {
  const startedAt = subDays(now, HISTORY_DAYS);
  const startDate = toDateKey(startedAt);
  const stamp = startedAt.toISOString();
  const caregiverName = base.caregiver?.name ?? 'Ana Santos';

  const makeMedication = (name: string, doseLabel: string): Medication => ({
    id: createId(),
    name,
    doseLabel,
    instructions: 'Sample only. Follow the instructions from the care team.',
    isSample: true,
    createdAt: stamp,
    updatedAt: stamp,
  });
  const morning = makeMedication('Morning dose (sample)', '2 tablets');
  const evening = makeMedication('Evening dose (sample)', '3 pills');

  const makeSchedule = (medication: Medication, time: string): DoseSchedule => ({
    id: createId(),
    medicationId: medication.id,
    time,
    repeatDays: [...ALL_DAYS],
    startDate,
    activeFrom: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  });
  const schedules = [makeSchedule(morning, '08:00'), makeSchedule(evening, '20:00')];

  const events: DoseEvent[] = [];
  for (let offset = HISTORY_DAYS; offset >= 1; offset -= 1) {
    const date = toDateKey(subDays(now, offset));
    schedules.forEach((schedule, index) => {
      // A repeating pattern gives the history screen a realistic mix of outcomes.
      if (index === 1 && offset % 6 === 0) return;
      const medication = index === 0 ? morning : evening;
      const skipped = index === 0 && offset === 9;
      const delayMinutes = offset % 5 === 0 ? 48 : 4;
      const takenAt = combineDateTime(date, schedule.time);
      takenAt.setMinutes(takenAt.getMinutes() + delayMinutes);
      events.push({
        id: createId(),
        occurrenceKey: occurrenceKey(schedule.id, date),
        scheduleId: schedule.id,
        medicationId: medication.id,
        medicationName: medication.name,
        doseLabel: medication.doseLabel,
        date,
        time: schedule.time,
        type: skipped ? 'skipped' : 'taken',
        takenAt: skipped ? undefined : takenAt.toISOString(),
        recordedAt: takenAt.toISOString(),
        recordedBy: `${caregiverName} (sample)`,
        source: 'sample',
        reason: skipped ? 'Sample entry' : undefined,
      });
    });
  }

  const contact: FamilyContact = {
    id: createId(),
    name: 'Mia Santos (sample)',
    relationship: 'Daughter',
    phone: '+63 917 555 0198',
    notifyMissedDose: true,
    notifyBearIssues: false,
    consentConfirmedAt: stamp,
    isSample: true,
    createdAt: stamp,
    updatedAt: stamp,
  };

  return {
    ...base,
    caregiver: base.caregiver ?? { id: createId(), name: 'Ana Santos', createdAt: now.toISOString() },
    recipient: base.recipient ?? {
      id: createId(),
      preferredName: 'Lola Rosa',
      relationship: 'Grandmother',
      timeZone: getDeviceTimeZone(),
    },
    medications: [...base.medications, morning, evening],
    schedules: [...base.schedules, ...schedules],
    events: [...base.events, ...events],
    contacts: [...base.contacts, contact],
    bear: base.bear ?? {
      id: createId(),
      serial: 'BEAR-0001',
      mode: 'demo',
      pairedAt: now.toISOString(),
      lastBattery: DEMO_START_BATTERY,
    },
    referral: base.referral ?? createDemoReferral(),
    activity: [
      {
        id: createId(),
        kind: 'medication_changed',
        message: 'Sample care plan loaded',
        at: now.toISOString(),
        isSample: true,
      },
      ...base.activity,
    ],
    onboarding: { completed: true, step: 0 },
    hasSamplePlan: true,
  };
}

/** Removes every sample record and leaves anything the caregiver created untouched. */
export function removeSamplePlan(data: AppData): AppData {
  const sampleMedicationIds = new Set(data.medications.filter((item) => item.isSample).map((item) => item.id));
  return {
    ...data,
    medications: data.medications.filter((item) => !item.isSample),
    schedules: data.schedules.filter((item) => !sampleMedicationIds.has(item.medicationId)),
    events: data.events.filter((item) => !sampleMedicationIds.has(item.medicationId)),
    contacts: data.contacts.filter((item) => !item.isSample),
    activity: data.activity.filter((item) => !item.isSample),
    referral: data.referral?.status === 'demo' ? null : data.referral,
    hasSamplePlan: false,
  };
}
