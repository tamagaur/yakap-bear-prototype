import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/constants/theme';
import { ALL_DAYS } from '@/constants/defaults';
import { haptics } from '@/services/haptics';
import type { Weekday } from '@/types/models';

const DAYS: { value: Weekday; short: string; long: string }[] = [
  { value: 1, short: 'M', long: 'Monday' },
  { value: 2, short: 'T', long: 'Tuesday' },
  { value: 3, short: 'W', long: 'Wednesday' },
  { value: 4, short: 'T', long: 'Thursday' },
  { value: 5, short: 'F', long: 'Friday' },
  { value: 6, short: 'S', long: 'Saturday' },
  { value: 0, short: 'S', long: 'Sunday' },
];

export function DayPicker({ value, onChange, error }: { value: Weekday[]; onChange: (days: Weekday[]) => void; error?: string }) {
  const toggle = (day: Weekday) => {
    haptics.tap();
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day]);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="smallBold">Repeat on</AppText>
      <View style={styles.days}>
        {DAYS.map((day) => {
          const active = value.includes(day.value);
          return (
            <Pressable
              key={day.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={day.long}
              onPress={() => toggle(day.value)}
              style={[styles.day, active && styles.dayActive]}
            >
              <AppText variant="smallBold" color={active ? colors.textOnPrimary : colors.textMuted}>
                {day.short}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.presets}>
        <Button compact variant="secondary" label="Every day" onPress={() => onChange([...ALL_DAYS])} />
        <Button compact variant="secondary" label="Weekdays" onPress={() => onChange([1, 2, 3, 4, 5])} />
      </View>
      {error ? (
        <AppText variant="caption" color={colors.coralDeep}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 48,
    minHeight: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presets: { flexDirection: 'row', gap: spacing.xs },
});
