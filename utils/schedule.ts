import {
  addDays,
  addMinutes,
  eachDayOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns';

import type {
  AppSettings,
  AwayPeriod,
  DateKey,
  DoseEvent,
  DoseOccurrence,
  DoseSchedule,
  DoseStatus,
  Medication,
  TimeOfDay,
  Weekday,
} from '@/types/models';

export const WEEK_STARTS_ON = 1 as const;

export interface ScheduleData {
  medications: Medication[];
  schedules: DoseSchedule[];
  events: DoseEvent[];
  settings: Pick<AppSettings, 'onTimeWindowMinutes' | 'lateWindowMinutes' | 'awayPeriods'>;
}

export const toDateKey = (date: Date): DateKey => format(date, 'yyyy-MM-dd');
export const fromDateKey = (key: DateKey): Date => parse(key, 'yyyy-MM-dd', new Date());
export const occurrenceKey = (scheduleId: string, date: DateKey): string => `${scheduleId}__${date}`;

export function parseOccurrenceKey(key: string): { scheduleId: string; date: DateKey } | null {
  const separator = key.lastIndexOf('__');
  if (separator <= 0) return null;
  return { scheduleId: key.slice(0, separator), date: key.slice(separator + 2) };
}

export function combineDateTime(date: DateKey, time: TimeOfDay): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const day = fromDateKey(date);
  day.setHours(hours, minutes, 0, 0);
  return day;
}

export function formatTime(time: TimeOfDay): string {
  return format(combineDateTime('2000-01-01', time), 'h:mm a');
}

export function isValidTime(time: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

export function isScheduledOn(schedule: DoseSchedule, date: DateKey): boolean {
  if (date < schedule.startDate) return false;
  if (schedule.endDate && date > schedule.endDate) return false;
  const weekday = fromDateKey(date).getDay() as Weekday;
  return schedule.repeatDays.includes(weekday);
}

function wasAwayAt(moment: Date, periods: AwayPeriod[], now: Date): boolean {
  return periods.some((period) => {
    const start = new Date(period.startedAt);
    const end = period.endedAt ? new Date(period.endedAt) : now;
    return !isBefore(moment, start) && !isAfter(moment, end);
  });
}

export function latestEventOf(events: DoseEvent[]): DoseEvent | undefined {
  return [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1);
}

/**
 * Status comes only from recorded events and the clock. A dose counts as taken only
 * when its latest event says so. A reminder playing never changes a dose's status.
 */
export function deriveStatus(
  scheduledAt: Date,
  events: DoseEvent[],
  now: Date,
  settings: ScheduleData['settings'],
): { status: DoseStatus; confirmedLate: boolean } {
  const onTimeUntil = addMinutes(scheduledAt, settings.onTimeWindowMinutes);
  const latest = latestEventOf(events);

  if (latest?.type === 'taken') {
    const takenAt = new Date(latest.takenAt ?? latest.recordedAt);
    return { status: 'taken', confirmedLate: isAfter(takenAt, onTimeUntil) };
  }
  if (latest?.type === 'skipped') return { status: 'skipped', confirmedLate: false };

  if (isBefore(now, onTimeUntil)) return { status: 'upcoming', confirmedLate: false };
  if (wasAwayAt(scheduledAt, settings.awayPeriods, now)) return { status: 'away', confirmedLate: false };
  if (isBefore(now, addMinutes(scheduledAt, settings.lateWindowMinutes))) {
    return { status: 'late', confirmedLate: false };
  }
  return { status: 'missed', confirmedLate: false };
}

export function getOccurrencesForDate(data: ScheduleData, date: DateKey, now: Date): DoseOccurrence[] {
  const medicationsById = new Map(data.medications.map((medication) => [medication.id, medication]));
  const occurrences: DoseOccurrence[] = [];

  for (const schedule of data.schedules) {
    if (!isScheduledOn(schedule, date)) continue;
    const medication = medicationsById.get(schedule.medicationId);
    if (!medication) continue;

    const scheduledAt = combineDateTime(date, schedule.time);
    const graceEnd = addMinutes(scheduledAt, data.settings.onTimeWindowMinutes);
    if (isBefore(graceEnd, new Date(schedule.activeFrom))) continue;

    const key = occurrenceKey(schedule.id, date);
    const events = data.events.filter((event) => event.occurrenceKey === key);
    const latestEvent = latestEventOf(events);
    const { status, confirmedLate } = deriveStatus(scheduledAt, events, now, data.settings);

    occurrences.push({
      key,
      scheduleId: schedule.id,
      medicationId: schedule.medicationId,
      date,
      time: schedule.time,
      scheduledAt,
      medicationName: latestEvent?.medicationName ?? medication.name,
      doseLabel: latestEvent?.doseLabel ?? medication.doseLabel,
      instructions: medication.instructions,
      voiceRecordingId: schedule.voiceRecordingId,
      status,
      confirmedLate,
      events: [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
      latestEvent,
      isSample: Boolean(medication.isSample),
    });
  }

  return occurrences.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

export function getOccurrenceByKey(data: ScheduleData, key: string, now: Date): DoseOccurrence | null {
  const parsed = parseOccurrenceKey(key);
  if (!parsed) return null;
  return getOccurrencesForDate(data, parsed.date, now).find((item) => item.key === key) ?? null;
}

/** The dose that needs attention next: an overdue dose today, otherwise the soonest upcoming one. */
export function getNextDose(data: ScheduleData, now: Date, lookaheadDays = 8): DoseOccurrence | null {
  for (let offset = 0; offset < lookaheadDays; offset += 1) {
    const date = toDateKey(addDays(now, offset));
    const candidates = getOccurrencesForDate(data, date, now).filter(
      (item) => item.status === 'late' || item.status === 'upcoming',
    );
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

export interface AdherenceSummary {
  /** Doses that have come due, excluding Away mode and doses still upcoming. */
  due: number;
  confirmed: number;
  confirmedLate: number;
  overdue: number;
  missed: number;
  skipped: number;
  away: number;
  upcoming: number;
  /** Whole percent, or null when nothing has come due yet. */
  rate: number | null;
}

export function summarize(occurrences: DoseOccurrence[]): AdherenceSummary {
  const count = (status: DoseStatus) => occurrences.filter((item) => item.status === status).length;
  const confirmed = count('taken');
  const overdue = count('late');
  const missed = count('missed');
  const skipped = count('skipped');
  const due = confirmed + overdue + missed + skipped;
  return {
    due,
    confirmed,
    confirmedLate: occurrences.filter((item) => item.status === 'taken' && item.confirmedLate).length,
    overdue,
    missed,
    skipped,
    away: count('away'),
    upcoming: count('upcoming'),
    rate: due === 0 ? null : Math.round((confirmed / due) * 100),
  };
}

export function getOccurrencesInRange(data: ScheduleData, start: Date, end: Date, now: Date): DoseOccurrence[] {
  if (isAfter(startOfDay(start), startOfDay(end))) return [];
  return eachDayOfInterval({ start, end }).flatMap((day) => getOccurrencesForDate(data, toDateKey(day), now));
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }),
  };
}

export function getWeekSummary(data: ScheduleData, now: Date): AdherenceSummary {
  const { start, end } = getWeekRange(now);
  return summarize(getOccurrencesInRange(data, start, end, now));
}

export type DayMarker = 'none' | DoseStatus;

/** Reduces a day to the single marker that most needs a caregiver's attention. */
export function getDayMarker(occurrences: DoseOccurrence[]): DayMarker {
  if (occurrences.length === 0) return 'none';
  const order: DoseStatus[] = ['missed', 'late', 'skipped', 'away', 'upcoming', 'taken'];
  return order.find((status) => occurrences.some((item) => item.status === status)) ?? 'none';
}

export function describeRepeatDays(days: Weekday[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return sorted.map((day) => labels[day]).join(', ');
}

export function describeCountdown(target: Date, now: Date): string {
  const totalMinutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (totalMinutes <= 0) return 'Due now';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const part = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;
  if (days > 0) return `In ${part(days, 'day')}${hours > 0 ? ` ${part(hours, 'hour')}` : ''}`;
  if (hours > 0) return `In ${part(hours, 'hour')}${minutes > 0 ? ` ${part(minutes, 'minute')}` : ''}`;
  return `In ${part(minutes, 'minute')}`;
}

export function describeDay(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, addDays(now, 1))) return 'Tomorrow';
  if (isSameDay(date, addDays(now, -1))) return 'Yesterday';
  return format(date, 'EEEE');
}

export function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
