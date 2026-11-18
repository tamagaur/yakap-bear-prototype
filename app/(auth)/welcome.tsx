import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { BrandMark } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/Card';
import { DemoEntrySheet } from '@/components/ui/DemoEntrySheet';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <Screen contentStyle={styles.content}>
      <FadeIn style={styles.hero}>
        <BrandMark />
        <BearMascot size={210} waving floating style={styles.bear} />
        <AppText variant="eyebrow" color={colors.primaryDark} align="center">
          Care, in a familiar voice
        </AppText>
        <AppText variant="display" align="center">
          Medicine reminders that feel like family
        </AppText>
        <AppText color={colors.textMuted} align="center">
          Record a loved one's voice, keep doses on track, and stay close even when you can't be there.
        </AppText>
      </FadeIn>

      <FadeIn delay={120} style={styles.actions}>
        <Button label="Open demo care plan" icon="play-circle" onPress={() => setDemoOpen(true)} />
        <Button label="Sign in" variant="secondary" onPress={() => router.push('/login')} />
        <Button label="Create an account" variant="ghost" onPress={() => router.push('/signup')} />
      </FadeIn>

      <DemoEntrySheet visible={demoOpen} onClose={() => setDemoOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', paddingTop: spacing.md },
  hero: { alignItems: 'center', gap: spacing.xs },
  bear: { marginVertical: spacing.sm },
  actions: { gap: spacing.xs },
});
