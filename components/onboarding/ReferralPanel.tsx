import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { DemoTag, Notice } from '@/components/ui/Bits';
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
    if (code.trim().length < 4) return setMessage('Please enter the full referral code.');
    setBusy(true);
    setMessage(undefined);
    const result = await verifyReferralCode(code);
    setBusy(false);
    if (result.outcome === 'verified') setReferral(result.referral);
    if (result.outcome === 'invalid') setMessage('That code was not recognized. Please check it with the clinic.');
    if (result.outcome === 'offline') setMessage('We could not reach the server. Please check your connection.');
    if (result.outcome === 'no_backend') {
      setMessage('Codes cannot be verified in the offline demo, so no clinic has been linked.');
    }
  };

  if (referral) {
    const isDemo = referral.status === 'demo';
    return (
      <Card style={styles.linked}>
        <Notice
          icon={isDemo ? 'info' : 'shield'}
          tone={isDemo ? 'honey' : 'teal'}
          title={isDemo ? 'Demo referral only' : 'Clinic verified'}
          message={
            isDemo
              ? 'This is a sample path for demonstration. No real clinic is linked and nothing is shared.'
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
        hint="Optional. Ask the clinic if you were given one."
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
        <Card style={styles.demoCard}>
          <DemoTag label="Offline demo" />
          <AppText variant="title">Try the demo referral</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Shows how a linked clinic would look. It does not connect to any real clinic.
          </AppText>
          <Button compact variant="primary" label="Use demo referral" onPress={() => setReferral(createDemoReferral())} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  linked: { gap: spacing.xs },
  demoCard: { gap: spacing.xs },
});
