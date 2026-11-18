import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
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
  history: { label: 'History', icon: 'clock' },
  settings: { label: 'Settings', icon: 'settings' },
};

export function FloatingTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const position = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: state.index,
      duration: reducedMotion ? 0 : motion.base,
      useNativeDriver: true,
    }).start();
  }, [position, reducedMotion, state.index]);

  const tabWidth = barWidth / state.routes.length;
  const translateX = Animated.multiply(position, tabWidth || 1);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View
        accessibilityRole="tablist"
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width - spacing.xs * 2)}
        style={styles.bar}
      >
        {barWidth > 0 ? (
          <Animated.View style={[styles.highlight, { width: tabWidth, transform: [{ translateX }] }]} />
        ) : null}
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          const tint = focused ? colors.primaryDark : colors.textMuted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptics.tap();
                  navigateToTab(route.key);
                }
              }}
              style={styles.tab}
            >
              <Icon name={tab.icon} size={22} color={tint} />
              <AppText variant="caption" color={tint} numberOfLines={1} maxFontSizeMultiplier={1.15} style={styles.label}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.sm },
  bar: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.raised,
  },
  highlight: {
    position: 'absolute',
    top: spacing.xs,
    bottom: spacing.xs,
    left: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 12, lineHeight: 16 },
});
