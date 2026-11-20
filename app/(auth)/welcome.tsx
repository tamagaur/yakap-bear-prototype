import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/Card';
import { DemoEntrySheet } from '@/components/ui/DemoEntrySheet';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  // Large enough to be the star, small enough to never push the buttons off screen.
  const bearSize = Math.min(width * 0.62, height * 0.32, 260);

  return (
    <Screen contentStyle={styles.content}>
      <FadeIn style={styles.hero}>
        <View style={[styles.halo, { width: bearSize * 1.25, height: bearSize * 1.25, borderRadius: bearSize }]}>
          <BearMascot size={bearSize} mood="happy" waving />
        </View>
        <AppText variant="display" align="center" color={colors.primaryDark}>
          Yakap Bear
        </AppText>
        <AppText variant="bodyMedium" align="center" color={colors.textMuted}>
          Care, in a familiar voice.
        </AppText>
      </FadeIn>

      <FadeIn delay={140} style={styles.actions}>
        <Button label="Try the demo" icon="play-circle" onPress={() => setDemoOpen(true)} />
        <Button label="Sign in" variant="secondary" onPress={() => router.push('/login')} />
        <Button label="Create account" variant="ghost" onPress={() => router.push('/signup')} />
      </FadeIn>

      <DemoEntrySheet visible={demoOpen} onClose={() => setDemoOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', paddingTop: spacing.xl },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  halo: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E6D2',
    marginBottom: spacing.md,
  },
  actions: { gap: spacing.xs },
});
