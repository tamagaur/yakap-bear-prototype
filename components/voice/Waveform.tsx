import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

const MAX_HEIGHT = 52;

/** Repeatable bar shape, so a saved message always looks the same. */
export function seededBars(seed: string, count = 34): number[] {
  let hash = 7;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return Array.from({ length: count }, (_, index) => {
    hash = (hash * 73 + index * 17) % 9973;
    return 0.22 + (hash % 100) / 130;
  });
}

export function Waveform({
  levels,
  active,
  progress,
}: {
  levels: number[];
  active?: boolean;
  /** 0 to 1. Bars before this point are highlighted during playback. */
  progress?: number;
}) {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {levels.map((level, index) => {
        const played = progress === undefined ? active : index / levels.length <= progress;
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: Math.max(5, Math.round(level * MAX_HEIGHT)),
                backgroundColor: played ? colors.primary : colors.borderStrong,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: MAX_HEIGHT + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 4, maxWidth: 4, flexShrink: 1, borderRadius: 2 },
});
