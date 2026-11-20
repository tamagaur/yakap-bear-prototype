import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { BackendNotice } from '@/components/ui/BackendNotice';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { DemoEntrySheet } from '@/components/ui/DemoEntrySheet';
import { TextField } from '@/components/ui/Fields';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { authService } from '@/services/auth/authService';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';
import { isValidEmail } from '@/utils/validation';

export default function LoginScreen() {
  const signIn = useSessionStore((state) => state.signIn);
  const { toast } = useFeedback();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const submit = async () => {
    const nextErrors = {
      email: isValidEmail(email) ? undefined : 'Please enter a valid email address.',
      password: password ? undefined : 'Please enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setBusy(true);
    try {
      await signIn(email, password);
      router.replace(useCareStore.getState().data.onboarding.completed ? '/home' : '/onboarding');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Sign-in failed. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader />}>
      <View style={styles.hero}>
        <BearMascot size={118} mood="happy" waving />
        <AppText variant="h1" align="center">
          Welcome back
        </AppText>
      </View>

      <BackendNotice />

      <TextField
        label="Email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        secure
        autoComplete="current-password"
        placeholder="Your password"
      />
      <Button
        compact
        variant="ghost"
        label="Forgot password?"
        onPress={() => router.push('/forgot-password')}
        containerStyle={styles.forgot}
      />

      <Button label="Sign in" onPress={() => void submit()} loading={busy} disabled={!authService.isConfigured} />
      <View style={styles.orRow}>
        <View style={styles.line} />
        <AppText variant="caption" color={colors.textMuted}>
          or
        </AppText>
        <View style={styles.line} />
      </View>
      <Button label="Try the demo" variant="secondary" onPress={() => setDemoOpen(true)} />
      <Button compact variant="ghost" label="New here? Create account" onPress={() => router.push('/signup')} />

      <DemoEntrySheet visible={demoOpen} onClose={() => setDemoOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xxs },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.xs },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
