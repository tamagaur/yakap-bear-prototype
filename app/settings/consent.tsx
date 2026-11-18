import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReferralPanel } from '@/components/onboarding/ReferralPanel';
import { SignaturePad } from '@/components/SignaturePad';
import { AppText } from '@/components/ui/AppText';
import { DemoTag, Divider, IconBadge, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Fields';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useCareStore } from '@/stores/careStore';

const SHARED = ['Dose times and status labels', 'Bear connection and battery status', 'Corrections and caregiver notes'];
const NEVER_SHARED = ['Your voice recordings or their audio', 'Private text messages between family', 'Anything from a microphone'];

function BulletList({ icon, title, items }: { icon: IconName; title: string; items: string[] }) {
  return (
    <View style={styles.bullets}>
      <View style={styles.bulletTitle}>
        <Icon name={icon} size={18} color={colors.primary} />
        <AppText variant="title">{title}</AppText>
      </View>
      {items.map((item) => (
        <AppText key={item} variant="small" color={colors.textMuted} style={styles.bulletItem}>
          {item}
        </AppText>
      ))}
    </View>
  );
}

export default function ConsentScreen() {
  const data = useCareData();
  const saveConsent = useCareStore((state) => state.saveConsent);
  const revokeConsent = useCareStore((state) => state.revokeConsent);
  const { confirm, toast } = useFeedback();

  const [authorized, setAuthorized] = useState(false);
  const [signature, setSignature] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [errors, setErrors] = useState<{ authorized?: string; signature?: string }>({});
  const [logOpen, setLogOpen] = useState(false);

  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const referral = data.referral;
  const active = data.consents.find((item) => item.status === 'active');
  const isDemo = referral?.status === 'demo';

  const updateSignature = useCallback((path: string) => {
    setSignature(path);
    setErrors((current) => ({ ...current, signature: undefined }));
  }, []);

  const submit = () => {
    const next = {
      authorized: authorized ? undefined : 'Please confirm your authorization.',
      signature: signature ? undefined : 'Please sign above.',
    };
    setErrors(next);
    if (next.authorized || next.signature || !referral) return;
    saveConsent({
      kind: 'clinic_sharing',
      clinicName: referral.clinicName,
      scopes: SHARED,
      signedBy: data.caregiver?.name ?? 'Caregiver',
      signaturePath: signature,
    });
    setAuthorized(false);
    setSignature('');
    toast(isDemo ? 'Demo consent saved on this phone.' : 'Consent updated.');
  };

  const revoke = async () => {
    const approved = await confirm({
      title: 'Revoke clinic access?',
      message: `${referral?.clinicName ?? 'The clinic'} will no longer be authorized to view ${recipient}'s dose activity.`,
      confirmLabel: 'Revoke access',
      destructive: true,
    });
    if (!approved) return;
    revokeConsent();
    toast('Clinic access revoked.');
  };

  return (
    <Screen header={<ScreenHeader title="Sharing and consent" />} scrollEnabled={!drawing}>
      <View style={styles.hero}>
        <IconBadge icon="heart" size={52} />
        <AppText variant="h2" align="center">
          You decide what the clinic can see
        </AppText>
        <AppText variant="small" color={colors.textMuted} align="center">
          Written consent is required before any clinician can view {recipient}'s dose activity.
        </AppText>
      </View>

      <Card style={styles.card}>
        <BulletList icon="check" title="What is shared" items={SHARED} />
        <Divider />
        <BulletList icon="shield" title="What is never shared" items={NEVER_SHARED} />
      </Card>

      {!referral ? (
        <>
          <Notice icon="info" title="No clinic is linked" message="Nothing is being shared. Add a referral to set up consent." />
          <ReferralPanel />
        </>
      ) : (
        <>
          <Card style={styles.clinic}>
            <IconBadge icon="stethoscope" tone="blue" size={42} />
            <View style={styles.flex}>
              <AppText variant="title">{referral.clinicName}</AppText>
              {referral.clinicianName ? (
                <AppText variant="small" color={colors.textMuted}>
                  {referral.clinicianName}
                </AppText>
              ) : null}
              {isDemo ? <DemoTag label="Demo only, not a real clinic" /> : null}
            </View>
            <Tag label={active ? 'Consent active' : 'No consent'} tone={active ? 'teal' : 'neutral'} icon={active ? 'check-circle' : 'minus-circle'} />
          </Card>

          {isDemo ? (
            <Notice
              icon="info"
              tone="honey"
              message="In the offline demo, consent is saved on this phone only. No information is sent to any clinic."
            />
          ) : null}

          {active ? (
            <AppText variant="small" color={colors.textMuted}>
              Signed by {active.signedBy} on {format(new Date(active.grantedAt), 'MMMM d, yyyy')}.
            </AppText>
          ) : null}

          <Checkbox
            label={`I authorize ${referral.clinicName} to view ${recipient}'s dose activity for care coordination.`}
            checked={authorized}
            onChange={(value) => {
              setAuthorized(value);
              setErrors((current) => ({ ...current, authorized: undefined }));
            }}
            error={errors.authorized}
          />
          <SignaturePad value={signature} onChange={updateSignature} onDrawingChange={setDrawing} />
          {errors.signature ? (
            <AppText variant="caption" color={colors.coralDeep}>
              {errors.signature}
            </AppText>
          ) : null}

          <Button label={active ? 'Update consent' : 'Give consent'} onPress={submit} />
          {active ? <Button label="Revoke clinic access" variant="danger" onPress={() => void revoke()} /> : null}
        </>
      )}

      <Card>
        <PressableScale
          accessibilityLabel="Who viewed the record"
          accessibilityState={{ expanded: logOpen }}
          onPress={() => setLogOpen((open) => !open)}
          style={styles.logHeader}
        >
          <Icon name="activity" size={20} color={colors.primary} />
          <AppText variant="title" style={styles.flex}>
            Who viewed the record
          </AppText>
          <Icon name={logOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </PressableScale>
        {logOpen ? (
          <AppText variant="small" color={colors.textMuted}>
            No one has viewed this record. Clinic access is not active in this version, so there is nothing to show.
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs },
  card: { gap: spacing.sm },
  bullets: { gap: 4 },
  bulletTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  bulletItem: { paddingLeft: 26 },
  clinic: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
});
