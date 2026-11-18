import type { ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useRef } from 'react';

import { PressableScale } from '@/components/ui/PressableScale';
import { colors, motion, radii, shadows, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({ children, style, onPress, accessibilityLabel, accessibilityHint }: CardProps) {
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        pressedScale={0.985}
        style={[styles.card, style]}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 0 : motion.slow,
      delay: reducedMotion ? 0 : delay,
      useNativeDriver: true,
    }).start();
  }, [delay, progress, reducedMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 10, 0] });
  return <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.soft,
  },
});
