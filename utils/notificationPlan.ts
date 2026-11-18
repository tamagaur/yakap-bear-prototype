import { addDays, addMinutes, isAfter } from 'date-fns';

import type { AppData } from '@/types/models';
import { formatTime, getOccurrencesForDate, toDateKey } from '@/utils/schedule';

export const NOTIFICATION_LOOKAHEAD_DAYS = 14;
/** iOS keeps at most 64 pending notifications, so the plan stays safely below that. */
export const MAX_PENDING_NOTIFICATIONS = 60;
const FOLLOW_UP_HORIZON_HOURS = 48;

export interface PlannedNotification {
  kind: 'dose' | 'follow_up';
  occurrenceKey: string;
  at: Date;
  title: string;
  body: string;
}

export function isAwayActive(data: Pick<AppData, 'settings'>): boolean {
  return data.settings.awayPeriods.some((period) => !period.endedAt);
}

/**
 * Builds a rolling window of one-time reminders. One-time triggers let a follow-up be
 * dropped as soon as that dose is confirmed, which a repeating trigger cannot do.
 */
export function planNotifications(data: AppData, now: Date): PlannedNotification[] {
  if (!data.settings.notificationsEnabled || isAwayActive(data)) return [];

  const name = data.recipient?.preferredName ?? 'your loved one';
  const showName = data.settings.showMedicationNameInNotifications;
  const followUpHorizon = addMinutes(now, FOLLOW_UP_HORIZON_HOURS * 60);
  const reminders: PlannedNotification[] = [];
  const followUps: PlannedNotification[] = [];

  for (let offset = 0; offset < NOTIFICATION_LOOKAHEAD_DAYS; offset += 1) {
    for (const item of getOccurrencesForDate(data, toDateKey(addDays(now, offset)), now)) {
      if (item.status !== 'upcoming' && item.status !== 'late') continue;
      const subject = showName ? item.medicationName : 'medicine';

      if (isAfter(item.scheduledAt, now)) {
        reminders.push({
          kind: 'dose',
          occurrenceKey: item.key,
          at: item.scheduledAt,
          title: `Time for ${name}'s ${subject}`,
          body: `${showName ? `${item.doseLabel} · ` : ''}${formatTime(item.time)}. Tap to hear the voice reminder.`,
        });
      }

      const followUpAt = addMinutes(item.scheduledAt, data.settings.followUpMinutes);
      if (data.settings.followUpEnabled && isAfter(followUpAt, now) && !isAfter(followUpAt, followUpHorizon)) {
        followUps.push({
          kind: 'follow_up',
          occurrenceKey: item.key,
          at: followUpAt,
          title: `Has ${name} taken the ${formatTime(item.time)} dose?`,
          body: 'Tap to confirm it in Yakap Bear.',
        });
      }
    }
  }

  const keptFollowUps = followUps.slice(0, Math.floor(MAX_PENDING_NOTIFICATIONS / 4));
  const keptReminders = reminders.slice(0, MAX_PENDING_NOTIFICATIONS - keptFollowUps.length);
  return [...keptReminders, ...keptFollowUps].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** A stable fingerprint, so notifications are rebuilt only when the plan actually changes. */
export function planSignature(plan: PlannedNotification[]): string {
  return plan.map((item) => `${item.kind}|${item.occurrenceKey}|${item.at.getTime()}|${item.title}|${item.body}`).join('\n');
}
