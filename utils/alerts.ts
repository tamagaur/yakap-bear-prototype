import { addDays, format } from 'date-fns';

import type { AppData, CareRecipient, Caregiver, DoseOccurrence } from '@/types/models';
import { formatTime, getOccurrencesForDate, toDateKey } from '@/utils/schedule';

export interface CareAlert {
  id: string;
  occurrence: DoseOccurrence;
  title: string;
  body: string;
  severity: 'overdue' | 'unconfirmed';
}

/** Doses from today and yesterday that still have no confirmation and need a caregiver's eye. */
export function getCareAlerts(data: AppData, now: Date): CareAlert[] {
  if (!data.settings.familyAlertsEnabled) return [];
  const name = data.recipient?.preferredName ?? 'Your loved one';

  return [toDateKey(now), toDateKey(addDays(now, -1))]
    .flatMap((date) => getOccurrencesForDate(data, date, now))
    .filter((item) => item.status === 'late' || item.status === 'missed')
    .filter((item) => !data.dismissedAlerts.includes(item.key))
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .map((occurrence) => ({
      id: occurrence.key,
      occurrence,
      severity: occurrence.status === 'late' ? 'overdue' : 'unconfirmed',
      title: occurrence.status === 'late' ? `${name}'s dose is overdue` : `${name}'s dose was not confirmed`,
      body: `${occurrence.medicationName} · ${format(occurrence.scheduledAt, 'EEE')} ${formatTime(occurrence.time)}`,
    }));
}

/** Prepares the text the caregiver reviews in the phone's own SMS app before sending. */
export function buildAlertMessage(
  occurrence: DoseOccurrence,
  recipient: CareRecipient | null,
  caregiver: Caregiver | null,
  includeMedicationName: boolean,
): string {
  const name = recipient?.preferredName ?? 'our loved one';
  const sender = caregiver?.name ? `${caregiver.name} here` : 'Hello';
  const day = format(occurrence.scheduledAt, 'EEEE');
  const dose = includeMedicationName ? `${occurrence.medicationName} dose` : 'medicine reminder';
  return `${sender}. ${name}'s ${formatTime(occurrence.time)} ${dose} on ${day} has not been confirmed yet. Could you please check in with ${name}? Thank you.`;
}
