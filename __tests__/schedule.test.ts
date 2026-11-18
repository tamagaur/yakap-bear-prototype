import { DEFAULT_SETTINGS, createEmptyData } from '@/constants/defaults';
import type { AppData, DoseEvent, DoseSchedule, Medication } from '@/types/models';
import { buildAlertMessage, getCareAlerts } from '@/utils/alerts';
import { planNotifications } from '@/utils/notificationPlan';
import {
  deriveStatus,
  getNextDose,
  getOccurrencesForDate,
  getWeekSummary,
  occurrenceKey,
  parseOccurrenceKey,
  summarize,
} from '@/utils/schedule';
import { isValidPhone, validateMedication } from '@/utils/validation';

const DATE = '2026-05-20';
const at = (time: string, date = DATE) => new Date(`${date}T${time}:00`);

const medication: Medication = {
  id: 'med-1',
  name: 'Morning medicine',
  doseLabel: '2 tablets',
  createdAt: at('00:00', '2026-05-01').toISOString(),
  updatedAt: at('00:00', '2026-05-01').toISOString(),
};

const schedule: DoseSchedule = {
  id: 'sched-1',
  medicationId: 'med-1',
  time: '08:00',
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-05-01',
  activeFrom: at('00:00', '2026-05-01').toISOString(),
  createdAt: at('00:00', '2026-05-01').toISOString(),
  updatedAt: at('00:00', '2026-05-01').toISOString(),
};

const makeEvent = (patch: Partial<DoseEvent>): DoseEvent => ({
  id: 'event-1',
  occurrenceKey: occurrenceKey('sched-1', DATE),
  scheduleId: 'sched-1',
  medicationId: 'med-1',
  medicationName: 'Morning medicine',
  doseLabel: '2 tablets',
  date: DATE,
  time: '08:00',
  type: 'taken',
  takenAt: at('08:04').toISOString(),
  recordedAt: at('08:04').toISOString(),
  recordedBy: 'Ana',
  source: 'caregiver',
  ...patch,
});

const makeData = (patch: Partial<AppData> = {}): AppData => ({
  ...createEmptyData(),
  medications: [medication],
  schedules: [schedule],
  ...patch,
});

const statusAt = (time: string, events: DoseEvent[] = []) =>
  deriveStatus(at('08:00'), events, at(time), DEFAULT_SETTINGS).status;

describe('dose status', () => {
  it('moves from upcoming to late to unconfirmed as time passes', () => {
    expect(statusAt('07:00')).toBe('upcoming');
    expect(statusAt('08:29')).toBe('upcoming');
    expect(statusAt('08:31')).toBe('late');
    expect(statusAt('09:29')).toBe('late');
    expect(statusAt('09:31')).toBe('missed');
  });

  it('counts a dose as taken only with a recorded confirmation', () => {
    expect(statusAt('12:00')).toBe('missed');
    expect(statusAt('12:00', [makeEvent({})])).toBe('taken');
  });

  it('flags confirmations recorded after the on-time window', () => {
    const lateEvent = makeEvent({ takenAt: at('09:10').toISOString(), recordedAt: at('09:10').toISOString() });
    expect(deriveStatus(at('08:00'), [lateEvent], at('12:00'), DEFAULT_SETTINGS).confirmedLate).toBe(true);
  });

  it('uses the latest event, so corrections override earlier entries', () => {
    const correction = makeEvent({
      id: 'event-2',
      type: 'unconfirmed',
      takenAt: undefined,
      source: 'correction',
      recordedAt: at('11:00').toISOString(),
    });
    expect(statusAt('12:00', [makeEvent({}), correction])).toBe('missed');
  });

  it('labels unconfirmed doses during Away mode as away', () => {
    const settings = { ...DEFAULT_SETTINGS, awayPeriods: [{ id: 'a', startedAt: at('07:00').toISOString() }] };
    expect(deriveStatus(at('08:00'), [], at('12:00'), settings).status).toBe('away');
  });
});

describe('occurrences', () => {
  it('respects repeat days and date limits', () => {
    const weekdaysOnly = { ...schedule, repeatDays: [1] as DoseSchedule['repeatDays'] };
    const data = makeData({ schedules: [weekdaysOnly] });
    expect(getOccurrencesForDate(data, DATE, at('07:00'))).toHaveLength(0); // A Wednesday.
    expect(getOccurrencesForDate(data, '2026-05-18', at('07:00'))).toHaveLength(1); // A Monday.

    const ended = makeData({ schedules: [{ ...schedule, endDate: '2026-05-19' }] });
    expect(getOccurrencesForDate(ended, DATE, at('07:00'))).toHaveLength(0);
  });

  it('does not create a dose for a time that passed before the schedule was added', () => {
    const addedAtNoon = { ...schedule, startDate: DATE, activeFrom: at('12:00').toISOString() };
    expect(getOccurrencesForDate(makeData({ schedules: [addedAtNoon] }), DATE, at('13:00'))).toHaveLength(0);
  });

  it('round-trips occurrence keys', () => {
    expect(parseOccurrenceKey(occurrenceKey('sched-1', DATE))).toEqual({ scheduleId: 'sched-1', date: DATE });
  });

  it('finds the next dose, skipping confirmed ones', () => {
    const data = makeData({ events: [makeEvent({})] });
    expect(getNextDose(data, at('08:10'))?.date).toBe('2026-05-21');
  });
});

describe('adherence', () => {
  it('calculates totals from stored records only', () => {
    const data = makeData({ events: [makeEvent({})] });
    const today = summarize(getOccurrencesForDate(data, DATE, at('12:00')));
    expect(today).toMatchObject({ due: 1, confirmed: 1, rate: 100 });

    // Monday and Tuesday have no events, so only Wednesday is confirmed this week.
    const week = getWeekSummary(data, at('12:00'));
    expect(week).toMatchObject({ due: 3, confirmed: 1, missed: 2 });
  });
});

describe('notification plan', () => {
  it('schedules nothing for confirmed doses or during Away mode', () => {
    const data = makeData({ events: [makeEvent({})] });
    const plan = planNotifications(data, at('07:00'));
    expect(plan.some((item) => item.occurrenceKey === occurrenceKey('sched-1', DATE))).toBe(false);

    const away = makeData();
    away.settings = { ...away.settings, awayPeriods: [{ id: 'a', startedAt: at('06:00').toISOString() }] };
    expect(planNotifications(away, at('07:00'))).toHaveLength(0);
  });

  it('stays within the iOS pending notification limit', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      ...schedule,
      id: `s-${index}`,
      time: `${String(index + 8).padStart(2, '0')}:00`,
    }));
    expect(planNotifications(makeData({ schedules: many }), at('07:00')).length).toBeLessThanOrEqual(60);
  });

  it('can hide medication names on the lock screen', () => {
    const data = makeData();
    data.settings = { ...data.settings, showMedicationNameInNotifications: false };
    const plan = planNotifications(data, at('07:00'));
    expect(plan.every((item) => !`${item.title} ${item.body}`.includes('Morning medicine'))).toBe(true);
  });
});

describe('family alerts', () => {
  it('raises an alert for an unconfirmed dose and clears it when dismissed', () => {
    const data = makeData();
    const alerts = getCareAlerts(data, at('12:00'));
    expect(alerts.length).toBeGreaterThan(0);
    expect(getCareAlerts({ ...data, dismissedAlerts: alerts.map((alert) => alert.id) }, at('12:00'))).toHaveLength(0);
  });

  it('leaves the medication name out of texts unless allowed', () => {
    const [occurrence] = getOccurrencesForDate(makeData(), DATE, at('12:00'));
    expect(buildAlertMessage(occurrence, null, null, false)).not.toContain('Morning medicine');
    expect(buildAlertMessage(occurrence, null, null, true)).toContain('Morning medicine');
  });
});

describe('validation', () => {
  const valid = { name: 'Medicine', doseLabel: '1 tablet', repeatDays: [1], doses: [{ time: '08:00' }] } as never;

  it('accepts a complete medication', () => {
    expect(validateMedication(valid)).toEqual({});
  });

  it('rejects missing fields, invalid times, and duplicates', () => {
    const errors = validateMedication({ name: ' ', doseLabel: '', repeatDays: [], doses: [] });
    expect(Object.keys(errors).sort()).toEqual(['doseLabel', 'doses', 'name', 'repeatDays']);
    expect(validateMedication({ ...(valid as object), doses: [{ time: '25:99' }] } as never).doses).toBeDefined();
    expect(validateMedication({ ...(valid as object), doses: [{ time: '08:00' }, { time: '08:00' }] } as never).doses).toBeDefined();
  });

  it('checks phone numbers', () => {
    expect(isValidPhone('+63 917 555 0198')).toBe(true);
    expect(isValidPhone('hello')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
  });
});
