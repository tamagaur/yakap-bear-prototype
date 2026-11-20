import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radii, spacing, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  header?: ReactNode;
  /** Stays pinned below the scrolling content, above the keyboard. */
  footer?: ReactNode;
  /** Adds room for the floating tab bar. */
  tabbed?: boolean;
  scroll?: boolean;
  /** Set to false while a gesture such as a signature is in progress. */
  scrollEnabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, header, footer, tabbed, scroll = true, scrollEnabled = true, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = tabbed ? TAB_BAR_CLEARANCE + insets.bottom : footer ? spacing.md : insets.bottom + spacing.xl;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { paddingTop: insets.top }]}
    >
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, { paddingBottom: bottomPadding }, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  backIcon?: 'arrow-left' | 'x';
  right?: ReactNode;
  /** Large, left-aligned title for main tab screens. */
  large?: boolean;
}

export function ScreenHeader({ title, onBack, showBack = true, backIcon = 'arrow-left', right, large }: ScreenHeaderProps) {
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  if (large) {
    return (
      <View style={styles.largeHeader}>
        <AppText variant="h1" numberOfLines={1} style={styles.headerTitle} accessibilityRole="header">
          {title}
        </AppText>
        {right ? <View style={styles.largeRight}>{right}</View> : null}
      </View>
    );
  }
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack ? (
          <PressableScale
            accessibilityLabel={backIcon === 'x' ? 'Close' : 'Go back'}
            onPress={goBack}
            hitSlop={8}
            style={styles.headerButton}
          >
            <View style={styles.backCircle}>
              <Icon name={backIcon} size={20} />
            </View>
          </PressableScale>
        ) : null}
      </View>
      <AppText variant="h3" numberOfLines={1} align="center" style={styles.headerTitle} accessibilityRole="header">
        {title}
      </AppText>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'plain',
  badge,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'card';
  badge?: number;
}) {
  return (
    <PressableScale
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      onPress={onPress}
      hitSlop={6}
      style={[styles.headerButton, tone === 'card' && styles.iconCard]}
    >
      <Icon name={icon} size={22} />
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.textOnPrimary} style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.md, flexGrow: 1 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    minHeight: 56,
  },
  largeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    minHeight: 60,
  },
  largeRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerSide: { width: 60, alignItems: 'flex-start', justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1 },
  headerButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.coralDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
