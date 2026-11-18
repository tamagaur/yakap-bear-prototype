import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { BearPairingPanel } from '@/components/onboarding/BearPairingPanel';
import { ReferralPanel } from '@/components/onboarding/ReferralPanel';
import { ContactsStep, DosesStep, useWhoForm, VoiceStep } from '@/components/onboarding/steps';
import { AppText } from '@/components/ui/AppText';
import { IconBadge, ProgressBar } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/Card';
import { type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, motion, spacing } from '@/constants/theme';
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

function StepHeading({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <IconBadge icon={icon} size={48} />
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      <AppText color={colors.textMuted}>{subtitle}</AppText>
    </View>
  );
}

function FinishView({ name, onDone }: { name: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Screen contentStyle={styles.finish}>
      <FadeIn style={styles.finishInner}>
        <BearMascot size={220} mood="happy" waving floating />
        <AppText variant="display" align="center">
          {name}'s bear is ready
        </AppText>
        <AppText color={colors.textMuted} align="center">
          Thank you for caring so warmly. Next, allow notifications so reminders can reach this phone at dose time.
        </AppText>
      </FadeIn>
      <Button
        label="Go to my home screen"
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

  const content: { icon: IconName; title: string; subtitle: string; body: ReactNode }[] = [
    { icon: 'user', title: 'Who will use the bear?', subtitle: 'Tell us about the person you care for.', body: who.fields },
    {
      icon: 'link',
      title: 'Connect your referral',
      subtitle: `Enter the code from ${name === 'Your' ? 'the' : `${name}'s`} care team, if you have one.`,
      body: <ReferralPanel />,
    },
    { icon: 'paw', title: `Pair ${name === 'Your' ? 'your' : `${name}'s`} bear`, subtitle: 'Meet the Demo Bear and see how pairing works.', body: <BearPairingPanel /> },
    { icon: 'plus', title: 'Add dose times', subtitle: `We'll help the bear remind ${name === 'Your' ? 'them' : name} at the right time.`, body: <DosesStep /> },
    { icon: 'heart', title: 'Record your first reminder', subtitle: 'A familiar voice makes each reminder feel warmer.', body: <VoiceStep onUnsavedChange={setHasUnsavedTake} /> },
    { icon: 'message-square', title: 'Add family contacts', subtitle: 'Choose who you may want to text if a dose is not confirmed.', body: <ContactsStep /> },
  ];
  const current = content[step];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Screen
      header={
        <View>
          <ScreenHeader
            title={`Step ${step + 1} of ${TOTAL_STEPS}`}
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
          <View style={styles.progress}>
            <ProgressBar value={(step + 1) / TOTAL_STEPS} label="Setup progress" />
          </View>
        </View>
      }
      footer={<Button label={isLast ? 'Finish setup' : 'Continue'} iconRight="chevron-right" onPress={() => void advance()} />}
    >
      <StepBody stepKey={step}>
        <StepHeading icon={current.icon} title={current.title} subtitle={current.subtitle} />
        {current.body}
      </StepBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  body: { gap: spacing.lg },
  heading: { gap: spacing.xxs },
  finish: { justifyContent: 'space-between', paddingTop: spacing.xxxl },
  finishInner: { alignItems: 'center', gap: spacing.sm },
});
