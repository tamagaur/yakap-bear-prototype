import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, motion, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ visible, onClose, title, subtitle, children, footer }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reducedMotion ? 0 : motion.base,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [progress, reducedMotion, visible]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [Dimensions.get('window').height * 0.5, 0] });

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md, transform: [{ translateY }] }]}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <AppText variant="h3" accessibilityRole="header">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText variant="small" color={colors.textMuted}>
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <PressableScale accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                <Icon name="x" size={22} />
              </PressableScale>
            </View>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    gap: spacing.xs,
  },
  headerText: { flex: 1, gap: 2, paddingTop: spacing.xs },
  close: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.xs },
});
