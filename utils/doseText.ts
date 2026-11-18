import { addMinutes, format } from 'date-fns';

import type { AppSettings, DoseEvent, DoseOccurrence } from '@/types/models';

const clock = (date: Date) => format(date, 'h:mm a');

export function describeWindow(occurrence: DoseOccurrence, settings: Pick<AppSettings, 'onTimeWindowMinutes'>): string {
  const start = addMinutes(occurrence.scheduledAt, -settings.onTimeWindowMinutes);
  const end = addMinutes(occurrence.scheduledAt, settings.onTimeWindowMinutes);
  return `${format(start, 'h:mm')}–${clock(end)}`;
}

export function lateUntil(occurrence: DoseOccurrence, settings: Pick<AppSettings, 'lateWindowMinutes'>): string {
  return clock(addMinutes(occurrence.scheduledAt, settings.lateWindowMinutes));
}

export function describeEvent(event: DoseEvent): string {
  const recorded = new Date(event.recordedAt);
  const taken = event.takenAt ? new Date(event.takenAt) : recorded;

  switch (event.source) {
    case 'sample':
      return event.type === 'taken' ? `Sample record, taken at ${clock(taken)}` : 'Sample record, marked skipped';
    case 'demo_paw':
      return `Demo Bear paw hold at ${clock(taken)}`;
    case 'correction': {
      const outcome =
        event.type === 'taken'
          ? `taken at ${clock(taken)}`
          : event.type === 'skipped'
            ? 'skipped'
            : 'not confirmed';
      return `Corrected to ${outcome} by ${event.recordedBy} on ${format(recorded, 'MMM d, h:mm a')}`;
    }
    default:
      return event.type === 'taken'
        ? `Confirmed by ${event.recordedBy} at ${clock(taken)}`
        : `Marked skipped by ${event.recordedBy} at ${clock(recorded)}`;
  }
}

/** One-line detail shown beneath a dose in lists. */
export function describeOccurrence(occurrence: DoseOccurrence, settings: AppSettings): string {
  const { doseLabel, status, latestEvent } = occurrence;
  switch (status) {
    case 'taken':
    case 'skipped':
      return latestEvent ? `${doseLabel} · ${describeEvent(latestEvent)}` : doseLabel;
    case 'late':
      return `${doseLabel} · Please confirm by ${lateUntil(occurrence, settings)}`;
    case 'missed':
      return `${doseLabel} · No confirmation recorded`;
    case 'away':
      return `${doseLabel} · During Away mode`;
    default:
      return `${doseLabel} · On time ${describeWindow(occurrence, settings)}`;
  }
}

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
