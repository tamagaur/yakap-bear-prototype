import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/ui/AppText';
import { BackendNotice } from '@/components/ui/BackendNotice';
import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { DemoEntrySheet } from '@/components/ui/DemoEntrySheet';
import { TextField } from '@/components/ui/Fields';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { authService } from '@/services/auth/authService';
import { useSessionStore } from '@/stores/sessionStore';
import { isValidEmail, validatePassword } from '@/utils/validation';

export default function SignUpScreen() {
  const signUp = useSessionStore((state) => state.signUp);
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const submit = async () => {
    const nextErrors = {
      name: name.trim() ? undefined : 'Please enter your name.',
      email: isValidEmail(email) ? undefined : 'Please enter a valid email address.',
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.email || nextErrors.password) return;

    setBusy(true);
    try {
      const { needsEmailConfirmation } = await signUp(name, email, password);
      if (needsEmailConfirmation) setAwaitingEmail(true);
      else router.replace('/onboarding');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Sign-up failed. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader />}>
      <AppText variant="h1">Create your account</AppText>
      <AppText color={colors.textMuted}>Keep your family's care plan in one warm, familiar place.</AppText>

      <BackendNotice />
      {awaitingEmail ? (
        <Notice
          icon="mail"
          title="Check your email"
          message="Open the confirmation link we sent, then come back and sign in."
        />
      ) : null}

      <TextField label="Your name" value={name} onChangeText={(value) => { setName(value); setErrors((current) => ({ ...current, name: undefined })); }} error={errors.name} autoComplete="name" placeholder="Ana Santos" />
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
        hint="Use at least 8 characters."
        secure
        autoComplete="new-password"
        placeholder="Create a password"
      />
      <Button label="Create account" onPress={() => void submit()} loading={busy} disabled={!authService.isConfigured} />
      <Button label="Open demo care plan" variant="secondary" onPress={() => setDemoOpen(true)} />
      <DemoEntrySheet visible={demoOpen} onClose={() => setDemoOpen(false)} />
    </Screen>
  );
}
