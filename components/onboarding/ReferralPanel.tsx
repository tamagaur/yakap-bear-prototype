import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { colors, spacing } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { authService } from '@/services/auth/authService';
import { createDemoReferral, verifyReferralCode } from '@/services/referrals';
import { useCareStore } from '@/stores/careStore';

/** Links a clinic only after backend verification, and keeps the demo path clearly separate. */
export function ReferralPanel() {
  const { referral } = useCareData();
  const setReferral = useCareStore((state) => state.setReferral);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (code.trim().length < 4) return setMessage('Please enter the full code.');
    setBusy(true);
    setMessage(undefined);
    const result = await verifyReferralCode(code);
    setBusy(false);
    if (result.outcome === 'verified') setReferral(result.referral);
    if (result.outcome === 'invalid') setMessage('Code not recognized. Please check with the clinic.');
    if (result.outcome === 'offline') setMessage("Couldn't connect. Check your internet.");
    if (result.outcome === 'no_backend') {
      setMessage("Codes can't be verified in the demo.");
    }
  };

  if (referral) {
    const isDemo = referral.status === 'demo';
    return (
      <Card style={styles.linked}>
        <Notice
          icon={isDemo ? 'info' : 'shield'}
          tone={isDemo ? 'honey' : 'teal'}
          title={isDemo ? 'Demo referral' : 'Clinic verified'}
          message={
            isDemo
              ? 'Sample only. No clinic linked, nothing shared.'
              : `${referral.clinicName}${referral.clinicianName ? ` · ${referral.clinicianName}` : ''}`
          }
        />
        <AppText variant="small" color={colors.textMuted}>
          Code: {referral.code}
        </AppText>
        <Button compact variant="ghost" label="Remove referral" onPress={() => setReferral(null)} />
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="Referral code"
        value={code}
        onChangeText={(value) => {
          setCode(value.toUpperCase());
          setMessage(undefined);
        }}
        error={message}
        hint="From the clinic, if you have one."
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CLINIC-0000"
      />
      <Button
        label={authService.isConfigured ? 'Verify code' : 'Check code'}
        variant="secondary"
        onPress={() => void verify()}
        loading={busy}
      />
      {!authService.isConfigured ? (
        <Button compact variant="ghost" icon="play-circle" label="Use a demo code" onPress={() => setReferral(createDemoReferral())} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  linked: { gap: spacing.xs },
  demoCard: { gap: spacing.xs },
});
