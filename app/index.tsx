import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { FadeIn } from '@/components/ui/Card';
import { colors, spacing } from '@/constants/theme';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';

const SPLASH_MS = 1300;

/** Animated splash, then routes to the right place for this session. */
export default function SplashGate() {
  const status = useSessionStore((state) => state.status);
  const onboarded = useCareStore((state) => state.data.onboarding.completed);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (splashDone && status === 'signedOut') return <Redirect href="/welcome" />;
  if (splashDone && status === 'signedIn') return <Redirect href={onboarded ? '/home' : '/onboarding'} />;

  return (
    <View style={styles.root}>
      <FadeIn style={styles.center}>
        <BearMascot size={170} waving />
        <AppText variant="display" color={colors.primaryDark}>
          Yakap Bear
        </AppText>
        <AppText color={colors.textMuted}>Care, in a familiar voice.</AppText>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.xl },
  center: { alignItems: 'center', gap: spacing.xs },
});
