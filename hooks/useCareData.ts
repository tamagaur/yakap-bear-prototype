import { useMemo } from 'react';

import { useCareStore } from '@/stores/careStore';
import type { DoseOccurrence } from '@/types/models';
import { getCareAlerts } from '@/utils/alerts';
import { isAwayActive } from '@/utils/notificationPlan';
import {
  formatTime,
  getNextDose,
  getOccurrencesForDate,
  getWeekSummary,
  summarize,
  toDateKey,
} from '@/utils/schedule';

export const useCareData = () => useCareStore((state) => state.data);

export function useRecipientName(fallback = 'your loved one'): string {
  return useCareStore((state) => state.data.recipient?.preferredName) ?? fallback;
}

export function useDayOccurrences(date: string, now: Date): DoseOccurrence[] {
  const data = useCareData();
  return useMemo(() => getOccurrencesForDate(data, date, now), [data, date, now]);
}

export function useTodaySnapshot(now: Date) {
  const data = useCareData();
  return useMemo(() => {
    const today = getOccurrencesForDate(data, toDateKey(now), now);
    return {
      today,
      summary: summarize(today),
      nextDose: getNextDose(data, now),
      alerts: getCareAlerts(data, now),
      week: getWeekSummary(data, now),
      away: isAwayActive(data),
    };
  }, [data, now]);
}

export interface DoseOption {
  scheduleId: string;
  title: string;
  subtitle: string;
  voiceRecordingId?: string;
}

/** Every dose time that is still active, for assigning voice reminders. */
export function useActiveDoseOptions(): DoseOption[] {
  const data = useCareData();
  return useMemo(() => {
    const today = toDateKey(new Date());
    return data.schedules
      .filter((schedule) => !schedule.endDate || schedule.endDate >= today)
      .flatMap((schedule) => {
        const medication = data.medications.find((item) => item.id === schedule.medicationId);
        if (!medication || medication.archivedAt) return [];
        return [
          {
            scheduleId: schedule.id,
            title: `${medication.name} · ${formatTime(schedule.time)}`,
            subtitle: medication.doseLabel,
            voiceRecordingId: schedule.voiceRecordingId,
            time: schedule.time,
          },
        ];
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [data]);
}
