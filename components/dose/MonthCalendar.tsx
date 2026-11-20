import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { STATUS_META } from '@/components/ui/Bits';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { haptics } from '@/services/haptics';
import type { DoseStatus } from '@/types/models';
import { getDayMarker, getOccurrencesForDate, toDateKey, type DayMarker } from '@/utils/schedule';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LEGEND: DoseStatus[] = ['taken', 'late', 'missed', 'skipped', 'away'];

function Marker({ marker }: { marker: DayMarker }) {
  return (
    <View style={styles.markerSpace}>
      {marker === 'none' ? null : <View style={[styles.markerDot, { backgroundColor: STATUS_META[marker].color }]} />}
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
          <Icon name="chevron-left" size={20} />
        </PressableScale>
        <View style={styles.title}>
          <AppText variant="h3" align="center" accessibilityRole="header">
            {format(month, 'MMMM yyyy')}
          </AppText>
          {monthRate !== null ? (
            <AppText variant="caption" color={colors.primaryDark} align="center">
              {monthRate}% taken
            </AppText>
          ) : null}
        </View>
        <PressableScale accessibilityLabel="Next month" onPress={() => onMonthChange(addMonths(month, 1))} style={styles.nav}>
          <Icon name="chevron-right" size={20} />
        </PressableScale>
      </View>

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
                  style={styles.dayPress}
                >
                  <View style={[styles.day, isToday && styles.today, isSelected && styles.selected]}>
                    <AppText
                      variant="smallBold"
                      color={isSelected ? colors.textOnPrimary : isToday ? colors.primaryDark : colors.text}
                    >
                      {format(date, 'd')}
                    </AppText>
                  </View>
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
            <View style={[styles.legendDot, { backgroundColor: STATUS_META[status].color }]} />
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
  nav: {
    width: TOUCH_TARGET - 8,
    height: TOUCH_TARGET - 8,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  title: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 28 },
  dayPress: { alignItems: 'center', justifyContent: 'center', minHeight: 50, width: '100%', paddingTop: 2 },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: colors.primary },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  markerSpace: { height: 10, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.sm,
    rowGap: 4,
    marginTop: spacing.xxs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
