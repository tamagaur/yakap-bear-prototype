import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { StatusPill } from '@/components/ui/Bits';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radii, spacing } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import type { DoseOccurrence } from '@/types/models';
import { describeOccurrence } from '@/utils/doseText';

export function TimeChip({ date, active }: { date: Date; active?: boolean }) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <AppText variant="title" color={active ? colors.honeyDark : colors.primaryDark}>
        {format(date, 'h:mm')}
      </AppText>
      <AppText variant="caption" color={active ? colors.honeyDark : colors.primaryDark}>
        {format(date, 'a')}
      </AppText>
    </View>
  );
}

export function DoseRow({ occurrence, onPress }: { occurrence: DoseOccurrence; onPress?: () => void }) {
  const { settings } = useCareData();
  const detail = describeOccurrence(occurrence, settings);
  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      pressedScale={0.985}
      accessibilityLabel={`${occurrence.medicationName}, ${format(occurrence.scheduledAt, 'h:mm a')}. ${detail}`}
      style={styles.row}
    >
      <TimeChip date={occurrence.scheduledAt} active={occurrence.status === 'upcoming' || occurrence.status === 'late'} />
      <View style={styles.text}>
        <AppText variant="title">{occurrence.medicationName}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {detail}
        </AppText>
        <StatusPill status={occurrence.status} confirmedLate={occurrence.confirmedLate} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 64 },
  chip: {
    width: 62,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
  },
  chipActive: { backgroundColor: colors.honeySoft },
  text: { flex: 1, gap: 3 },
});
