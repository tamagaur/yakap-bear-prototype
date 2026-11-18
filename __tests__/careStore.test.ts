import { createEmptyData } from '@/constants/defaults';
import type { CareRepository } from '@/repositories/types';
import { useCareStore } from '@/stores/careStore';
import type { AppData, MedicationInput } from '@/types/models';
import { getOccurrencesForDate, toDateKey } from '@/utils/schedule';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/services/audio/voiceFiles', () => ({
  deleteAllVoiceFiles: jest.fn(),
  deleteVoiceFile: jest.fn(),
  resolveVoiceUri: jest.fn(() => null),
}));
jest.mock('@/services/audio/voicePlayback', () => ({
  voicePlayback: { stop: jest.fn(), getSnapshot: () => ({ recordingId: null }), subscribe: () => () => undefined },
}));
jest.mock('@/services/bear', () => ({ bearService: { restore: jest.fn() }, DEMO_START_BATTERY: 82 }));
jest.mock('@/services/notifications', () => ({
  syncDoseNotifications: jest.fn(() => Promise.resolve()),
  cancelAllDoseNotifications: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/services/haptics', () => ({ setHapticsEnabled: jest.fn(), haptics: {} }));

class MemoryRepository implements CareRepository {
  readonly kind = 'local' as const;
  saved: AppData | null = null;
  async load() {
    return this.saved;
  }
  async save(data: AppData) {
    this.saved = JSON.parse(JSON.stringify(data)) as AppData;
  }
  async clear() {
    this.saved = null;
  }
}

const NOW = new Date('2026-05-20T10:00:00');
const today = toDateKey(NOW);

const input: MedicationInput = {
  name: 'Morning medicine',
  doseLabel: '2 tablets',
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  doses: [{ time: '20:00' }],
};

const store = () => useCareStore.getState();

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await store().hydrate(new MemoryRepository());
  useCareStore.setState({ data: createEmptyData() });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('medications', () => {
  it('adds a medication with its schedule', () => {
    store().saveMedication(input);
    expect(store().data.medications).toHaveLength(1);
    expect(store().data.schedules[0]).toMatchObject({ time: '20:00', startDate: today });
  });

  it('edits a time in place when no history exists', () => {
    const id = store().saveMedication(input);
    const scheduleId = store().data.schedules[0].id;
    store().saveMedication({ ...input, id, doses: [{ scheduleId, time: '21:00' }] });
    const active = store().data.schedules.filter((item) => !item.endDate);
    expect(active).toHaveLength(1);
    expect(active[0].time).toBe('21:00');
  });

  it('keeps past history when a time changes after doses were logged', () => {
    const id = store().saveMedication(input);
    const original = store().data.schedules[0];
    useCareStore.setState((state) => ({
      data: {
        ...state.data,
        schedules: [{ ...original, startDate: '2026-05-10', activeFrom: new Date('2026-05-10T00:00:00').toISOString() }],
      },
    }));
    const [past] = getOccurrencesForDate(store().data, '2026-05-15', NOW);
    store().recordDose(past, 'taken');

    store().saveMedication({ ...input, id, doses: [{ scheduleId: original.id, time: '21:00' }] });

    const [history] = getOccurrencesForDate(store().data, '2026-05-15', NOW);
    expect(history.time).toBe('20:00');
    expect(history.status).toBe('taken');
    const [upcoming] = getOccurrencesForDate(store().data, today, NOW);
    expect(upcoming.time).toBe('21:00');
  });

  it('archives a deleted medication so logged doses remain in history', () => {
    const id = store().saveMedication(input);
    const original = store().data.schedules[0];
    useCareStore.setState((state) => ({
      data: {
        ...state.data,
        schedules: [{ ...original, startDate: '2026-05-10', activeFrom: new Date('2026-05-10T00:00:00').toISOString() }],
      },
    }));
    const [past] = getOccurrencesForDate(store().data, '2026-05-15', NOW);
    store().recordDose(past, 'taken');

    store().deleteMedication(id);

    expect(store().data.medications[0].archivedAt).toBeDefined();
    expect(getOccurrencesForDate(store().data, '2026-05-15', NOW)[0].status).toBe('taken');
    expect(getOccurrencesForDate(store().data, today, NOW)).toHaveLength(0);
  });

  it('removes a brand-new medication completely', () => {
    const id = store().saveMedication(input);
    store().deleteMedication(id);
    expect(store().data.medications).toHaveLength(0);
    expect(store().data.schedules).toHaveLength(0);
  });
});

describe('dose confirmation', () => {
  it('records a taken event and updates the status immediately', () => {
    store().saveMedication(input);
    const [dose] = getOccurrencesForDate(store().data, today, NOW);
    expect(dose.status).toBe('upcoming');
    store().recordDose(dose, 'taken');
    expect(getOccurrencesForDate(store().data, today, NOW)[0].status).toBe('taken');
    expect(store().data.activity[0].kind).toBe('dose_taken');
  });

  it('keeps the original entry when a log is corrected', () => {
    store().saveMedication(input);
    const [dose] = getOccurrencesForDate(store().data, today, NOW);
    store().recordDose(dose, 'taken');
    const [taken] = getOccurrencesForDate(store().data, today, NOW);
    jest.advanceTimersByTime(1000);
    store().correctDose(taken, { type: 'skipped', reason: 'Entered by mistake' });

    const [corrected] = getOccurrencesForDate(store().data, today, NOW);
    expect(corrected.status).toBe('skipped');
    expect(corrected.events).toHaveLength(2);
    expect(corrected.events[1]).toMatchObject({
      source: 'correction',
      reason: 'Entered by mistake',
      correctsEventId: corrected.events[0].id,
    });
  });
});

describe('persistence', () => {
  it('writes changes to the repository and restores them on the next launch', async () => {
    const repository = new MemoryRepository();
    await store().hydrate(repository);
    store().saveMedication(input);
    await store().flush();

    useCareStore.setState({ data: createEmptyData() });
    await store().hydrate(repository);
    expect(store().data.medications[0].name).toBe('Morning medicine');
  });
});

describe('voice recordings', () => {
  it('clears dose assignments when a recording is deleted', () => {
    store().saveMedication(input);
    const scheduleId = store().data.schedules[0].id;
    const stamp = NOW.toISOString();
    store().addRecording(
      { id: 'rec-1', name: 'Hi Lola', fileName: 'rec-1.m4a', durationMs: 5000, createdAt: stamp, updatedAt: stamp },
      [scheduleId],
    );
    expect(store().data.schedules[0].voiceRecordingId).toBe('rec-1');
    store().deleteRecording('rec-1');
    expect(store().data.schedules[0].voiceRecordingId).toBeUndefined();
    expect(store().data.recordings).toHaveLength(0);
  });
});

describe('away mode', () => {
  it('opens and closes an away period without touching the schedule', () => {
    store().saveMedication(input);
    const before = JSON.stringify(store().data.schedules);
    store().setAwayMode(true);
    expect(store().data.settings.awayPeriods[0].endedAt).toBeUndefined();
    store().setAwayMode(false);
    expect(store().data.settings.awayPeriods[0].endedAt).toBeDefined();
    expect(JSON.stringify(store().data.schedules)).toBe(before);
  });
});
