import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, motion, radii, shadows, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/services/haptics';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ToastTone = 'success' | 'info' | 'error';

interface FeedbackValue {
  /** Resolves true only if the caregiver explicitly confirms. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
  /** A brief, gentle reaction from the bear after a dose is confirmed. */
  celebrate: (message: string) => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const TOAST_ICONS: Record<ToastTone, IconName> = { success: 'check-circle', info: 'info', error: 'alert-circle' };
const TOAST_COLORS: Record<ToastTone, string> = {
  success: colors.primary,
  info: colors.blue,
  error: colors.coralDeep,
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const [toastState, setToastState] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [celebration, setCelebration] = useState<{ message: string; key: number } | null>(null);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const closeDialog = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  };

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastState({ message, tone });
      Animated.timing(toastOpacity, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: motion.base, useNativeDriver: true }).start(() =>
          setToastState(null),
        );
      }, 3000);
    },
    [toastOpacity],
  );

  const celebrate = useCallback(
    (message: string) => {
      haptics.success();
      setCelebration({ message, key: Date.now() });
      celebrationOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(celebrationOpacity, { toValue: 1, duration: reducedMotion ? 0 : motion.base, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(celebrationOpacity, { toValue: 0, duration: reducedMotion ? 0 : motion.slow, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setCelebration(null);
      });
    },
    [celebrationOpacity, reducedMotion],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const value = useMemo(() => ({ confirm, toast, celebrate }), [celebrate, confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {celebration ? (
        <Animated.View pointerEvents="none" style={[styles.celebrationWrap, { opacity: celebrationOpacity }]}>
          <View style={styles.celebrationCard} accessibilityLiveRegion="polite">
            <CelebratingBear triggerKey={celebration.key} />
            <AppText variant="h3" align="center">
              {celebration.message}
            </AppText>
          </View>
        </Animated.View>
      ) : null}

      {toastState ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { top: insets.top + spacing.xs, opacity: toastOpacity }]}
        >
          <Icon name={TOAST_ICONS[toastState.tone]} size={20} color={TOAST_COLORS[toastState.tone]} />
          <AppText variant="smallBold" style={styles.toastText}>
            {toastState.message}
          </AppText>
        </Animated.View>
      ) : null}

      <Modal transparent visible={Boolean(dialog)} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => closeDialog(false)}>
        <View style={styles.dialogRoot}>
          <Pressable accessibilityLabel="Cancel" onPress={() => closeDialog(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.dialog} accessibilityViewIsModal>
            <AppText variant="h3" accessibilityRole="header">
              {dialog?.title}
            </AppText>
            <AppText color={colors.textMuted}>{dialog?.message}</AppText>
            <View style={styles.dialogActions}>
              <Button
                label={dialog?.confirmLabel ?? 'Confirm'}
                variant={dialog?.destructive ? 'danger' : 'teal'}
                onPress={() => closeDialog(true)}
              />
              <Button label={dialog?.cancelLabel ?? 'Cancel'} variant="ghost" onPress={() => closeDialog(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

function CelebratingBear({ triggerKey }: { triggerKey: number }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setKey(triggerKey), 120);
    return () => clearTimeout(timer);
  }, [triggerKey]);
  return <BearMascot size={120} mood="happy" celebrateKey={key} />;
}

export function useFeedback(): FeedbackValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}

/** Waits for a bottom sheet to finish closing before opening another dialog. */
export const afterSheetClose = (action: () => void) => setTimeout(action, 320);

const styles = StyleSheet.create({
  celebrationWrap: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247, 240, 229, 0.72)',
    zIndex: 40,
  },
  celebrationCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.raised,
  },
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.raised,
  },
  toastText: { flex: 1 },
  dialogRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.raised,
  },
  dialogActions: { gap: spacing.xxs, marginTop: spacing.sm },
});
