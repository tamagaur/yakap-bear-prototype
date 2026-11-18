import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { authService } from '@/services/auth/authService';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';

const WORKS_NOW = [
  'Medication schedules and adherence history',
  'Real voice recording and playback on this phone',
  'Local reminders through phone notifications',
  'Prepared texts through your messages app',
  'Offline storage on this phone',
];

const NEEDS_MORE = [
  'Physical bear connection (needs hardware)',
  'Automatic family alerts and push (needs a backend)',
  'Clinic data sharing (needs a verified backend)',
];

function FeatureList({ title, icon, color, items }: { title: string; icon: IconName; color: string; items: string[] }) {
  return (
    <Card style={styles.list}>
      <AppText variant="h3">{title}</AppText>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <Icon name={icon} size={18} color={color} />
          <AppText variant="small" style={styles.flex}>
            {item}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

export default function AboutScreen() {
  const eraseAllData = useCareStore((state) => state.eraseAllData);
  const signOut = useSessionStore((state) => state.signOut);
  const session = useSessionStore((state) => state.session);
  const { confirm, toast } = useFeedback();

  const erase = async () => {
    const approved = await confirm({
      title: 'Erase all data on this phone?',
      message: 'Medications, history, contacts, and voice recordings will be permanently deleted.',
      confirmLabel: 'Erase everything',
      destructive: true,
    });
    if (!approved) return;
    await eraseAllData();
    await signOut();
    toast('All data was erased.');
    router.replace('/welcome');
  };

  return (
    <Screen header={<ScreenHeader title="App information" />}>
      <View style={styles.hero}>
        <BearMascot size={120} waving />
        <AppText variant="h2">Yakap Bear</AppText>
        <AppText color={colors.textMuted}>Care, in a familiar voice.</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Version {Constants.expoConfig?.version ?? '1.0.0'} · {session?.kind === 'cloud' ? 'Account' : 'Offline demo'}
          {authService.isConfigured ? '' : ' · No backend connected'}
        </AppText>
      </View>

      <FeatureList title="Works in this version" icon="check-circle" color={colors.primary} items={WORKS_NOW} />
      <FeatureList title="Not active yet" icon="clock" color={colors.honeyDark} items={NEEDS_MORE} />

      <Notice
        icon="shield"
        title="Privacy"
        message="Care data and recordings are kept in this app's private storage on your phone. Nothing is shared unless you choose to share it."
      />
      <Notice
        icon="alert-triangle"
        tone="honey"
        title="Medical disclaimer"
        message="Yakap Bear is a reminder aid. It does not diagnose, give medical advice, monitor emergencies, or guarantee that medication was taken."
      />

      <Button label="Erase all data on this phone" variant="danger" icon="trash-2" onPress={() => void erase()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xxs },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
