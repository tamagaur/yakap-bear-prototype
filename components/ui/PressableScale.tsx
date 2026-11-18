import { useRef } from 'react';
import { Animated, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { motion } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/services/haptics';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Outer wrapper style, used for layout such as flex or width. */
  containerStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
  haptic?: boolean;
}

export function PressableScale({
  style,
  containerStyle,
  pressedScale = 0.97,
  haptic = true,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityRole = 'button',
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  const animate = (toValue: number) => {
    if (reducedMotion) return;
    Animated.timing(scale, { toValue, duration: motion.fast, useNativeDriver: true }).start();
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (haptic) haptics.tap();
    onPress?.(event);
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={(event) => {
          animate(pressedScale);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(1);
          onPressOut?.(event);
        }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
