import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { colors, motion, radii, shadows, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** "flat" drops the shadow and border, for content that sits on a tinted area. */
  tone?: 'raised' | 'flat';
}

export function Card({ children, style, onPress, accessibilityLabel, accessibilityHint, tone = 'raised' }: CardProps) {
  const cardStyle = [styles.card, tone === 'raised' ? styles.raised : null, style];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        pressedScale={0.985}
        style={cardStyle}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

/** Fades content in once when it first mounts. */
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
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    // Always settle on fully visible, even if the animation is interrupted.
    animation.start(() => progress.setValue(1));
    return () => animation.stop();
  }, [delay, progress, reducedMotion]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 10, 0] });
  return <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

/**
 * Softly refreshes content when `swapKey` changes (for example, a new date)
 * without remounting it, so nothing ever gets stuck faded or blank.
 */
export function SwapIn({
  swapKey,
  children,
  style,
}: {
  swapKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reducedMotion) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.quad),
      // JS-driven so the final value always matches what React rendered.
      useNativeDriver: false,
    });
    animation.start(() => progress.setValue(1));
    return () => {
      animation.stop();
      progress.setValue(1);
    };
  }, [progress, reducedMotion, swapKey]);

  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  raised: {
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
});
