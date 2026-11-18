import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, motion, radii, TOUCH_TARGET } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/services/haptics';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const position = useRef(new Animated.Value(index)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(position, {
      toValue: index,
      duration: reducedMotion ? 0 : motion.base,
      useNativeDriver: true,
    }).start();
  }, [index, position, reducedMotion]);

  const segmentWidth = width / options.length;
  const translateX = Animated.multiply(position, segmentWidth || 1);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      style={styles.track}
    >
      {width > 0 ? (
        <Animated.View style={[styles.thumb, { width: segmentWidth, transform: [{ translateX }] }]} />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => {
              haptics.tap();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <AppText variant="smallBold" color={active ? colors.textOnPrimary : colors.textMuted}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: colors.creamDeep,
    borderRadius: radii.md,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  segment: { flex: 1, minHeight: TOUCH_TARGET - 4, alignItems: 'center', justifyContent: 'center' },
});
