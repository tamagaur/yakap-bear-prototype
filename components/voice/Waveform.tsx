import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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

const clampLevel = (level: number) => Math.max(0.1, Math.min(1, level));

function Bar({
  level,
  color,
  wave,
  offset,
  height,
}: {
  level: number;
  color: string;
  wave: Animated.Value | null;
  offset: number;
  height: number;
}) {
  const scale = useRef(new Animated.Value(clampLevel(level))).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: clampLevel(level),
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [level, scale]);

  // While idle, a soft travelling ripple keeps the bars feeling alive.
  const ripple = wave
    ? wave.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [0, 0.25, 0.5, 0.75, 1].map((point) => 0.82 + 0.18 * Math.sin(2 * Math.PI * (point + offset))),
      })
    : 1;
  const scaleY = Animated.multiply(scale, ripple);

  return <Animated.View style={[styles.bar, { height, backgroundColor: color, transform: [{ scaleY }] }]} />;
}

export function Waveform({
  levels,
  active,
  progress,
  idle,
  height = MAX_HEIGHT,
}: {
  levels: number[];
  active?: boolean;
  /** 0 to 1. Bars before this point are highlighted during playback. */
  progress?: number;
  /** Plays a gentle ripple when nothing is recording or playing. */
  idle?: boolean;
  height?: number;
}) {
  const reducedMotion = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  const rippling = Boolean(idle) && !active && !reducedMotion;

  useEffect(() => {
    if (!rippling) return;
    const loop = Animated.loop(
      Animated.timing(wave, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => {
      loop.stop();
      wave.setValue(0);
    };
  }, [rippling, wave]);

  return (
    <View
      style={[styles.row, { height: height + 4 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {levels.map((level, index) => {
        const played = progress === undefined ? active : index / levels.length <= progress;
        return (
          <Bar
            key={index}
            level={level}
            height={height}
            color={played ? colors.primary : colors.borderStrong}
            wave={rippling ? wave : null}
            offset={index / 12}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 4, maxWidth: 4, flexShrink: 1, borderRadius: 2 },
});
