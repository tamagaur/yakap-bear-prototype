import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, motion, radii, shadows, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/services/haptics';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  schedule: { label: 'Schedule', icon: 'calendar' },
  voice: { label: 'Voice', icon: 'mic' },
  history: { label: 'History', icon: 'bar-chart-2' },
  settings: { label: 'Settings', icon: 'settings' },
};

function TabButton({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(active, {
      toValue: focused ? 1 : 0,
      duration: reducedMotion ? 0 : motion.base,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [active, focused, reducedMotion]);

  const pillScale = active.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const iconLift = active.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const tint = focused ? colors.primaryDark : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { opacity: active, transform: [{ scaleX: pillScale }] }]} />
        <Animated.View style={{ transform: [{ translateY: iconLift }] }}>
          <Icon name={icon} size={21} color={tint} />
        </Animated.View>
      </View>
      <AppText
        variant="caption"
        color={tint}
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        style={[styles.label, focused && styles.labelActive]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function FloatingTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View accessibilityRole="tablist" style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <TabButton
              key={route.key}
              label={tab.label}
              icon={tab.icon}
              focused={focused}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptics.tap();
                  navigateToTab(route.key);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md },
  bar: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.raised,
  },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: { width: 54, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  label: { fontSize: 11.5, lineHeight: 15 },
  labelActive: { fontFamily: 'DMSans_700Bold' },
});
