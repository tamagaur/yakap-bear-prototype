import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Checkbox } from '@/components/ui/Fields';
import { colors, spacing } from '@/constants/theme';
import type { DoseOption } from '@/hooks/useCareData';

export function DoseAssignList({
  options,
  selected,
  onChange,
}: {
  options: DoseOption[];
  selected: string[];
  onChange: (scheduleIds: string[]) => void;
}) {
  if (options.length === 0) {
    return (
      <AppText variant="small" color={colors.textMuted}>
        Add a medication first.
      </AppText>
    );
  }
  return (
    <View style={styles.list}>
      {options.map((option) => (
        <Checkbox
          key={option.scheduleId}
          label={option.title}
          description={option.subtitle}
          checked={selected.includes(option.scheduleId)}
          onChange={(checked) =>
            onChange(checked ? [...selected, option.scheduleId] : selected.filter((id) => id !== option.scheduleId))
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.xxs } });
