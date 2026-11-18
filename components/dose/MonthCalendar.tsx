import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { STATUS_META } from '@/components/ui/Bits';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { haptics } from '@/services/haptics';
import type { DoseStatus } from '@/types/models';
import { getDayMarker, getOccurrencesForDate, toDateKey, type DayMarker } from '@/utils/schedule';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LEGEND: DoseStatus[] = ['taken', 'late', 'missed', 'skipped', 'away'];

const MARKER_ICONS: Record<DoseStatus, IconName> = {
  taken: 'check',
  late: 'alert-triangle',
  missed: 'x',
  skipped: 'minus',
  away: 'map-pin',
  upcoming: 'clock',
};

function Marker({ marker }: { marker: DayMarker }) {
  if (marker === 'none') return <View style={styles.markerSpace} />;
  return (
    <View style={styles.markerSpace}>
      <Icon name={MARKER_ICONS[marker]} size={12} color={STATUS_META[marker].color} />
    </View>
  );
}

interface MonthCalendarProps {
  month: Date;
  selected: Date;
  now: Date;
  onSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  monthRate: number | null;
}

export function MonthCalendar({ month, selected, now, onSelect, onMonthChange, monthRate }: MonthCalendarProps) {
  const data = useCareData();

  const days = useMemo(() => {
    const interval = { start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) };
    return eachDayOfInterval(interval).map((date) => ({
      date,
      marker: isSameMonth(date, month) ? getDayMarker(getOccurrencesForDate(data, toDateKey(date), now)) : ('none' as DayMarker),
    }));
  }, [data, month, now]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <PressableScale accessibilityLabel="Previous month" onPress={() => onMonthChange(addMonths(month, -1))} style={styles.nav}>
          <Icon name="chevron-left" size={22} />
        </PressableScale>
        <AppText variant="h3" align="center" style={styles.title} accessibilityRole="header">
          {format(month, 'MMMM yyyy')}
        </AppText>
        <PressableScale accessibilityLabel="Next month" onPress={() => onMonthChange(addMonths(month, 1))} style={styles.nav}>
          <Icon name="chevron-right" size={22} />
        </PressableScale>
      </View>
      {monthRate !== null ? (
        <AppText variant="caption" color={colors.primaryDark} align="center">
          {monthRate}% of due doses confirmed this month
        </AppText>
      ) : null}

      <View style={styles.grid}>
        {WEEKDAYS.map((day, index) => (
          <View key={`${day}-${index}`} style={styles.cell}>
            <AppText variant="caption" color={colors.textMuted}>
              {day}
            </AppText>
          </View>
        ))}
        {days.map(({ date, marker }) => {
          const inMonth = isSameMonth(date, month);
          const isSelected = isSameDay(date, selected);
          const isToday = isSameDay(date, now);
          return (
            <View key={date.toISOString()} style={styles.cell}>
              {inMonth ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${format(date, 'MMMM d')}${marker === 'none' ? '' : `, ${STATUS_META[marker].label}`}`}
                  onPress={() => {
                    haptics.tap();
                    onSelect(date);
                  }}
                  style={[styles.day, isToday && styles.today, isSelected && styles.selected]}
                >
                  <AppText variant="smallBold" color={isSelected ? colors.primaryDark : colors.text}>
                    {format(date, 'd')}
                  </AppText>
                  <Marker marker={marker} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {LEGEND.map((status) => (
          <View key={status} style={styles.legendItem}>
            <Icon name={MARKER_ICONS[status]} size={13} color={STATUS_META[status].color} />
            <AppText variant="caption" color={colors.textMuted}>
              {STATUS_META[status].label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center' },
  nav: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 30 },
  day: {
    width: '94%',
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: { backgroundColor: colors.primarySoft },
  selected: { borderColor: colors.primary },
  markerSpace: { height: 14, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: spacing.sm, rowGap: 4, marginTop: spacing.xxs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
