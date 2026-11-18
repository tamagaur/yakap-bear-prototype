import { addDays, subDays } from 'date-fns';
import { create } from 'zustand';

import { createEmptyData } from '@/constants/defaults';
import type { CareRepository } from '@/repositories/types';
import { deleteAllVoiceFiles, deleteVoiceFile } from '@/services/audio/voiceFiles';
import { voicePlayback } from '@/services/audio/voicePlayback';
import { bearService } from '@/services/bear';
import { setHapticsEnabled } from '@/services/haptics';
import { cancelAllDoseNotifications, syncDoseNotifications } from '@/services/notifications';
import { buildSamplePlan, removeSamplePlan } from '@/services/sampleData';
import type {
  ActivityEntry,
  ActivityKind,
  AppData,
  AppSettings,
  BearDevice,
  CareRecipient,
  Caregiver,
  Consent,
  ContactInput,
  DoseEvent,
  DoseEventSource,
  DoseOccurrence,
  DoseSchedule,
  FamilyContact,
  MedicationInput,
  Referral,
  VoiceRecording,
} from '@/types/models';
import { createId } from '@/utils/ids';
import { isAwayActive } from '@/utils/notificationPlan';
import { toDateKey } from '@/utils/schedule';

const MAX_ACTIVITY = 200;
const PERSIST_DELAY_MS = 200;
const NOTIFICATION_SYNC_DELAY_MS = 600;
const WRITE_ERROR = 'Your latest change could not be saved on this phone. Please check available storage.';

interface CareState {
  data: AppData;
  hydrated: boolean;
  storageError: string | null;

  hydrate: (repository: CareRepository) => Promise<void>;
  flush: () => Promise<void>;
  clearStorageError: () => void;

  saveProfile: (caregiver: Pick<Caregiver, 'name' | 'phone'>, recipient: Omit<CareRecipient, 'id'>) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  loadSamplePlan: () => void;
  clearSamplePlan: () => void;
  eraseAllData: () => Promise<void>;

  saveMedication: (input: MedicationInput) => string;
  deleteMedication: (id: string) => void;

  recordDose: (
    occurrence: DoseOccurrence,
    type: 'taken' | 'skipped',
    options?: { source?: DoseEventSource; reason?: string },
  ) => DoseEvent;
  correctDose: (
    occurrence: DoseOccurrence,
    correction: { type: DoseEvent['type']; takenAt?: Date; reason: string },
  ) => void;
  dismissAlert: (occurrenceKey: string) => void;

  addRecording: (recording: VoiceRecording, scheduleIds: string[]) => void;
  renameRecording: (id: string, name: string) => void;
  deleteRecording: (id: string) => void;
  assignRecording: (id: string, scheduleIds: string[]) => void;

  saveContact: (input: ContactInput) => void;
  deleteContact: (id: string) => void;

  pairBear: (device: BearDevice) => void;
  unpairBear: () => void;
  setBearBattery: (battery: number) => void;
  setReferral: (referral: Referral | null) => void;
  saveConsent: (consent: Omit<Consent, 'id' | 'status' | 'grantedAt'>) => void;
  revokeConsent: () => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
  setAwayMode: (active: boolean) => void;
  logActivity: (kind: ActivityKind, message: string) => void;
}

let repository: CareRepository | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const entry = (kind: ActivityKind, message: string): ActivityEntry => ({
  id: createId(),
  kind,
  message,
  at: new Date().toISOString(),
});

const withActivity = (data: AppData, kind: ActivityKind, message: string): AppData => ({
  ...data,
  activity: [entry(kind, message), ...data.activity].slice(0, MAX_ACTIVITY),
});

const sameDays = (a: number[], b: number[]) => [...a].sort().join() === [...b].sort().join();

/** Ends a schedule while keeping every day that already has history attached to it. */
function endSchedule(schedule: DoseSchedule, events: DoseEvent[], now: Date): DoseSchedule | null {
  const today = toDateKey(now);
  const hasHistory = events.some((event) => event.scheduleId === schedule.id);
  if (schedule.startDate >= today && !hasHistory) return null;
  const loggedToday = events.some((event) => event.scheduleId === schedule.id && event.date === today);
  const endDate = loggedToday ? today : toDateKey(subDays(now, 1));
  return { ...schedule, endDate: endDate < schedule.startDate ? schedule.startDate : endDate, updatedAt: now.toISOString() };
}

export const useCareStore = create<CareState>((set, get) => {
  const persist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void get().flush();
    }, PERSIST_DELAY_MS);
  };

  const scheduleNotificationSync = () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      syncDoseNotifications(get().data).catch(() => undefined);
    }, NOTIFICATION_SYNC_DELAY_MS);
  };

  const commit = (updater: (data: AppData) => AppData) => {
    set((state) => ({ data: updater(state.data) }));
    persist();
    scheduleNotificationSync();
  };

  const actorName = () => get().data.caregiver?.name ?? 'Caregiver';

  return {
    data: createEmptyData(),
    hydrated: false,
    storageError: null,

    hydrate: async (nextRepository) => {
      repository = nextRepository;
      set({ hydrated: false, storageError: null });
      let data = createEmptyData();
      let storageError: string | null = null;
      try {
        data = (await nextRepository.load()) ?? createEmptyData();
      } catch {
        storageError = 'We could not read your saved care plan. You can keep using the app, but earlier data may be missing.';
      }
      setHapticsEnabled(data.settings.hapticsEnabled);
      bearService.restore(data.bear);
      set({ data, hydrated: true, storageError });
      scheduleNotificationSync();
    },

    flush: async () => {
      if (!repository) return;
      try {
        await repository.save(get().data);
        if (get().storageError === WRITE_ERROR) set({ storageError: null });
      } catch {
        set({ storageError: WRITE_ERROR });
      }
    },

    clearStorageError: () => set({ storageError: null }),

    saveProfile: (caregiver, recipient) =>
      commit((data) => ({
        ...data,
        caregiver: {
          id: data.caregiver?.id ?? createId(),
          createdAt: data.caregiver?.createdAt ?? new Date().toISOString(),
          email: data.caregiver?.email,
          ...caregiver,
        },
        recipient: { id: data.recipient?.id ?? createId(), ...recipient },
      })),

    setOnboardingStep: (step) => commit((data) => ({ ...data, onboarding: { ...data.onboarding, step } })),
    completeOnboarding: () => commit((data) => ({ ...data, onboarding: { completed: true, step: 0 } })),

    loadSamplePlan: () => {
      commit((data) => buildSamplePlan(data, new Date()));
      bearService.restore(get().data.bear);
    },
    clearSamplePlan: () => commit(removeSamplePlan),

    eraseAllData: async () => {
      voicePlayback.stop();
      bearService.restore(null);
      deleteAllVoiceFiles();
      await cancelAllDoseNotifications().catch(() => undefined);
      await repository?.clear().catch(() => undefined);
      set({ data: createEmptyData(), storageError: null });
    },

    saveMedication: (input) => {
      const now = new Date();
      const stamp = now.toISOString();
      const today = toDateKey(now);
      const medicationId = input.id ?? createId();

      commit((data) => {
        const existing = data.medications.find((item) => item.id === medicationId);
        const medication = {
          id: medicationId,
          name: input.name.trim(),
          doseLabel: input.doseLabel.trim(),
          instructions: input.instructions?.trim() || undefined,
          isSample: existing?.isSample,
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
        };

        const others = data.schedules.filter((item) => item.medicationId !== medicationId);
        const current = data.schedules.filter((item) => item.medicationId === medicationId);
        const active = current.filter((item) => !item.endDate || item.endDate >= today);
        const finished = current.filter((item) => item.endDate && item.endDate < today);
        const nextSchedules: DoseSchedule[] = [...finished];

        const createSchedule = (time: string, voiceRecordingId: string | undefined, startDate: string): DoseSchedule => ({
          id: createId(),
          medicationId,
          time,
          repeatDays: [...input.repeatDays],
          startDate,
          activeFrom: stamp,
          voiceRecordingId,
          createdAt: stamp,
          updatedAt: stamp,
        });

        const handled = new Set<string>();
        for (const dose of input.doses) {
          const match = dose.scheduleId ? active.find((item) => item.id === dose.scheduleId) : undefined;
          if (!match) {
            nextSchedules.push(createSchedule(dose.time, dose.voiceRecordingId, today));
            continue;
          }
          handled.add(match.id);
          if (match.time === dose.time && sameDays(match.repeatDays, input.repeatDays)) {
            nextSchedules.push({ ...match, voiceRecordingId: dose.voiceRecordingId, updatedAt: stamp });
            continue;
          }
          // A changed time starts a new schedule so past days keep the time they were logged at.
          const ended = endSchedule(match, data.events, now);
          if (ended) nextSchedules.push(ended);
          const loggedToday = data.events.some((event) => event.scheduleId === match.id && event.date === today);
          nextSchedules.push(
            createSchedule(dose.time, dose.voiceRecordingId, loggedToday ? toDateKey(addDays(now, 1)) : today),
          );
        }

        for (const schedule of active) {
          if (handled.has(schedule.id)) continue;
          const ended = endSchedule(schedule, data.events, now);
          if (ended) nextSchedules.push(ended);
        }

        const medications = existing
          ? data.medications.map((item) => (item.id === medicationId ? medication : item))
          : [...data.medications, medication];

        return withActivity(
          { ...data, medications, schedules: [...others, ...nextSchedules] },
          'medication_changed',
          `${medication.name} was ${existing ? 'updated' : 'added'} by ${actorName()}`,
        );
      });
      return medicationId;
    },

    deleteMedication: (id) => {
      const now = new Date();
      commit((data) => {
        const medication = data.medications.find((item) => item.id === id);
        if (!medication) return data;
        const schedules = data.schedules.flatMap((schedule) => {
          if (schedule.medicationId !== id) return [schedule];
          const ended = endSchedule(schedule, data.events, now);
          return ended ? [ended] : [];
        });
        // Past days stay in History, so the medication is archived while any schedule remains.
        const keepArchived = schedules.some((schedule) => schedule.medicationId === id);
        const medications = keepArchived
          ? data.medications.map((item) => (item.id === id ? { ...item, archivedAt: now.toISOString() } : item))
          : data.medications.filter((item) => item.id !== id);
        return withActivity({ ...data, medications, schedules }, 'medication_changed', `${medication.name} was removed from the plan`);
      });
    },

    recordDose: (occurrence, type, options) => {
      const now = new Date();
      const event: DoseEvent = {
        id: createId(),
        occurrenceKey: occurrence.key,
        scheduleId: occurrence.scheduleId,
        medicationId: occurrence.medicationId,
        medicationName: occurrence.medicationName,
        doseLabel: occurrence.doseLabel,
        date: occurrence.date,
        time: occurrence.time,
        type,
        takenAt: type === 'taken' ? now.toISOString() : undefined,
        recordedAt: now.toISOString(),
        recordedBy: actorName(),
        source: options?.source ?? 'caregiver',
        reason: options?.reason,
      };
      const name = get().data.recipient?.preferredName ?? 'Your loved one';
      commit((data) =>
        withActivity(
          { ...data, events: [...data.events, event] },
          type === 'taken' ? 'dose_taken' : 'dose_skipped',
          type === 'taken'
            ? `${actorName()} confirmed ${name}'s ${occurrence.medicationName}`
            : `${actorName()} recorded ${name}'s ${occurrence.medicationName} as skipped`,
        ),
      );
      return event;
    },

    correctDose: (occurrence, correction) => {
      const now = new Date().toISOString();
      const event: DoseEvent = {
        id: createId(),
        occurrenceKey: occurrence.key,
        scheduleId: occurrence.scheduleId,
        medicationId: occurrence.medicationId,
        medicationName: occurrence.medicationName,
        doseLabel: occurrence.doseLabel,
        date: occurrence.date,
        time: occurrence.time,
        type: correction.type,
        takenAt: correction.type === 'taken' ? (correction.takenAt ?? new Date()).toISOString() : undefined,
        recordedAt: now,
        recordedBy: actorName(),
        source: 'correction',
        reason: correction.reason.trim(),
        correctsEventId: occurrence.latestEvent?.id,
      };
      commit((data) =>
        withActivity(
          { ...data, events: [...data.events, event] },
          'dose_corrected',
          `${actorName()} corrected the log for ${occurrence.medicationName}`,
        ),
      );
    },

    dismissAlert: (occurrenceKey) =>
      commit((data) => ({ ...data, dismissedAlerts: [...new Set([...data.dismissedAlerts, occurrenceKey])].slice(-100) })),

    addRecording: (recording, scheduleIds) =>
      commit((data) =>
        withActivity(
          {
            ...data,
            recordings: [recording, ...data.recordings],
            schedules: data.schedules.map((item) =>
              scheduleIds.includes(item.id) ? { ...item, voiceRecordingId: recording.id } : item,
            ),
          },
          'voice_saved',
          `${actorName()} saved a voice reminder`,
        ),
      ),

    renameRecording: (id, name) =>
      commit((data) => ({
        ...data,
        recordings: data.recordings.map((item) =>
          item.id === id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item,
        ),
      })),

    deleteRecording: (id) => {
      const recording = get().data.recordings.find((item) => item.id === id);
      if (voicePlayback.getSnapshot().recordingId === id) voicePlayback.stop();
      if (recording) deleteVoiceFile(recording.fileName);
      commit((data) => ({
        ...data,
        recordings: data.recordings.filter((item) => item.id !== id),
        schedules: data.schedules.map((item) =>
          item.voiceRecordingId === id ? { ...item, voiceRecordingId: undefined } : item,
        ),
      }));
    },

    assignRecording: (id, scheduleIds) =>
      commit((data) => ({
        ...data,
        schedules: data.schedules.map((item) => {
          if (scheduleIds.includes(item.id)) return { ...item, voiceRecordingId: id };
          return item.voiceRecordingId === id ? { ...item, voiceRecordingId: undefined } : item;
        }),
      })),

    saveContact: (input) => {
      const stamp = new Date().toISOString();
      commit((data) => {
        const existing = data.contacts.find((item) => item.id === input.id);
        const contact: FamilyContact = {
          id: existing?.id ?? createId(),
          name: input.name.trim(),
          relationship: input.relationship,
          phone: input.phone.trim(),
          notifyMissedDose: input.notifyMissedDose,
          notifyBearIssues: input.notifyBearIssues,
          consentConfirmedAt: input.consentConfirmed ? (existing?.consentConfirmedAt ?? stamp) : undefined,
          isSample: existing?.isSample,
          createdAt: existing?.createdAt ?? stamp,
          updatedAt: stamp,
        };
        if (existing) {
          return { ...data, contacts: data.contacts.map((item) => (item.id === existing.id ? contact : item)) };
        }
        return withActivity(
          { ...data, contacts: [...data.contacts, contact] },
          'contact_added',
          `${contact.name} joined the care circle`,
        );
      });
    },

    deleteContact: (id) => commit((data) => ({ ...data, contacts: data.contacts.filter((item) => item.id !== id) })),

    pairBear: (device) =>
      commit((data) => withActivity({ ...data, bear: device }, 'bear_changed', `${device.serial} was paired as a Demo Bear`)),

    unpairBear: () => {
      bearService.restore(null);
      commit((data) => withActivity({ ...data, bear: null }, 'bear_changed', 'The Demo Bear was removed'));
    },

    setBearBattery: (battery) =>
      commit((data) => (data.bear ? { ...data, bear: { ...data.bear, lastBattery: battery } } : data)),

    setReferral: (referral) => commit((data) => ({ ...data, referral })),

    saveConsent: (consent) =>
      commit((data) => {
        const now = new Date().toISOString();
        const consents = data.consents.map((item): Consent =>
          item.status === 'active' ? { ...item, status: 'revoked', revokedAt: now } : item,
        );
        return withActivity(
          { ...data, consents: [{ ...consent, id: createId(), status: 'active', grantedAt: now }, ...consents] },
          'consent_changed',
          `${consent.signedBy} updated sharing consent`,
        );
      }),

    revokeConsent: () =>
      commit((data) => {
        const now = new Date().toISOString();
        return withActivity(
          {
            ...data,
            consents: data.consents.map((item): Consent =>
              item.status === 'active' ? { ...item, status: 'revoked', revokedAt: now } : item,
            ),
          },
          'consent_changed',
          `${actorName()} revoked clinic sharing`,
        );
      }),

    updateSettings: (patch) => {
      if (patch.hapticsEnabled !== undefined) setHapticsEnabled(patch.hapticsEnabled);
      commit((data) => ({ ...data, settings: { ...data.settings, ...patch } }));
    },

    setAwayMode: (active) => {
      const now = new Date().toISOString();
      commit((data) => {
        if (active === isAwayActive(data)) return data;
        const awayPeriods = active
          ? [...data.settings.awayPeriods, { id: createId(), startedAt: now }]
          : data.settings.awayPeriods.map((period) => (period.endedAt ? period : { ...period, endedAt: now }));
        return withActivity(
          { ...data, settings: { ...data.settings, awayPeriods } },
          'away_changed',
          active ? `${actorName()} turned on Away mode` : `${actorName()} turned off Away mode`,
        );
      });
    },

    logActivity: (kind, message) => commit((data) => withActivity(data, kind, message)),
  };
});
