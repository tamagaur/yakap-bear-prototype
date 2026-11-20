import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { BearMascot, type BearMood } from '@/components/bear/BearMascot';
import { BearPairingPanel } from '@/components/onboarding/BearPairingPanel';
import { ReferralPanel } from '@/components/onboarding/ReferralPanel';
import { ContactsStep, DosesStep, useWhoForm, VoiceStep } from '@/components/onboarding/steps';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, motion, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { requestNotificationPermission } from '@/services/notifications';
import { useCareStore } from '@/stores/careStore';

const TOTAL_STEPS = 6;

function StepBody({ stepKey, children }: { stepKey: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: reducedMotion ? 0 : motion.slow, useNativeDriver: true }).start();
  }, [progress, reducedMotion, stepKey]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 24, 0] });
  return <Animated.View style={[styles.body, { opacity: progress, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View
      pointerEvents="none"
      style={styles.dots}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < step && styles.dotDone,
            index === step && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

function StepHeading({ mood, title, subtitle }: { mood?: BearMood; title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <View style={styles.headingText}>
        <AppText variant="h1" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText color={colors.textMuted}>{subtitle}</AppText> : null}
      </View>
      {mood ? <BearMascot size={78} mood={mood} /> : null}
    </View>
  );
}

function FinishView({ name, onDone }: { name: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Screen contentStyle={styles.finish}>
      <FadeIn style={styles.finishInner}>
        <BearMascot size={220} mood="celebrating" />
        <AppText variant="display" align="center">
          {name === 'Your' ? 'All set!' : `${name}'s bear is ready!`}
        </AppText>
        <AppText color={colors.textMuted} align="center">
          Allow notifications so reminders reach you on time.
        </AppText>
      </FadeIn>
      <Button
        label="Let's go"
        iconRight="arrow-right"
        loading={busy}
        onPress={() => {
          setBusy(true);
          requestNotificationPermission()
            .catch(() => undefined)
            .finally(onDone);
        }}
      />
    </Screen>
  );
}

export default function OnboardingScreen() {
  const savedStep = useCareStore((state) => state.data.onboarding.step);
  const setOnboardingStep = useCareStore((state) => state.setOnboardingStep);
  const completeOnboarding = useCareStore((state) => state.completeOnboarding);
  const recipient = useCareStore((state) => state.data.recipient?.preferredName);
  const who = useWhoForm();

  const [step, setStep] = useState(Math.min(savedStep, TOTAL_STEPS - 1));
  const [finished, setFinished] = useState(false);
  const [hasUnsavedTake, setHasUnsavedTake] = useState(false);
  const { confirm } = useFeedback();
  const name = recipient ?? 'Your';

  const goTo = (next: number) => {
    setStep(next);
    setOnboardingStep(next);
  };

  const advance = async () => {
    if (step === 0 && !who.submit()) return;
    if (step === 4 && hasUnsavedTake) {
      const leave = await confirm({
        title: 'Leave without saving?',
        message: 'Your new recording has not been saved yet.',
        confirmLabel: 'Discard recording',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!leave) return;
      setHasUnsavedTake(false);
    }
    if (step === TOTAL_STEPS - 1) {
      setFinished(true);
      return;
    }
    goTo(step + 1);
  };

  if (finished) {
    return (
      <FinishView
        name={name}
        onDone={() => {
          completeOnboarding();
          router.replace('/home');
        }}
      />
    );
  }

  const possessive = name === 'Your' ? 'your' : `${name}'s`;
  const content: { mood?: BearMood; title: string; subtitle?: string; body: ReactNode }[] = [
    { mood: 'happy', title: 'Who are we caring for?', body: who.fields },
    { mood: 'idle', title: 'Got a clinic code?', subtitle: 'Optional', body: <ReferralPanel /> },
    { title: `Meet ${possessive} bear`, body: <BearPairingPanel /> },
    { mood: 'happy', title: 'Medication schedule', subtitle: 'Add each medicine as prescribed.', body: <DosesStep /> },
    { title: 'Record a loving message', body: <VoiceStep onUnsavedChange={setHasUnsavedTake} /> },
    { mood: 'excited', title: 'Family contacts', subtitle: 'Optional', body: <ContactsStep /> },
  ];
  const current = content[step];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Screen
      header={
        <View>
          <ScreenHeader
            showBack={step > 0}
            onBack={() => goTo(step - 1)}
            right={
              step > 0 ? (
                <PressableScale accessibilityLabel="Skip this step" onPress={() => void advance()} hitSlop={10}>
                  <AppText variant="smallBold" color={colors.primaryDark}>
                    Skip
                  </AppText>
                </PressableScale>
              ) : null
            }
          />
          <StepDots step={step} total={TOTAL_STEPS} />
        </View>
      }
      footer={<Button label={isLast ? 'Finish' : 'Continue'} iconRight="chevron-right" onPress={() => void advance()} />}
    >
      <StepBody stepKey={step}>
        <StepHeading mood={current.mood} title={current.title} subtitle={current.subtitle} />
        {current.body}
      </StepBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    top: 0,
    left: 72,
    right: 72,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.borderStrong },
  dotDone: { backgroundColor: colors.primary, opacity: 0.45 },
  dotActive: { width: 26, backgroundColor: colors.primary },
  body: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  headingText: { flex: 1, gap: spacing.xxs },
  finish: { justifyContent: 'space-between', paddingTop: spacing.xxxl },
  finishInner: { alignItems: 'center', gap: spacing.sm },
});
