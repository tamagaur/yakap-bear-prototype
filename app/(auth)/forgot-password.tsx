import { useState } from 'react';

import { AppText } from '@/components/ui/AppText';
import { BackendNotice } from '@/components/ui/BackendNotice';
import { IconBadge, Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Fields';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { authService } from '@/services/auth/authService';
import { isValidEmail } from '@/utils/validation';

export default function ForgotPasswordScreen() {
  const { toast } = useFeedback();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    setError(undefined);
    setBusy(true);
    try {
      await authService.sendPasswordReset(email);
      setSent(true);
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : 'Please try again in a moment.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader />}>
      <IconBadge icon="key" />
      <AppText variant="h1">Reset your password</AppText>
      <AppText color={colors.textMuted}>We'll email you a reset link.</AppText>

      <BackendNotice />
      {sent ? (
        <Notice
          icon="mail"
          title="Request sent"
          message="If an account uses this email, a reset link will arrive shortly."
        />
      ) : null}

      <TextField
        label="Email address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(undefined);
        }}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Button label="Send reset link" onPress={() => void submit()} loading={busy} disabled={!authService.isConfigured} />
    </Screen>
  );
}
