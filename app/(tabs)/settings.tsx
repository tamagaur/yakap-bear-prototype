import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BearFace } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { DemoTag, Divider, ListRow, Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/Fields';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useBear } from '@/hooks/useServices';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';
import { isAwayActive } from '@/utils/notificationPlan';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="eyebrow" color={colors.textMuted} accessibilityRole="header">
        {title}
      </AppText>
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export default function SettingsScreen() {
  const data = useCareData();
  const bear = useBear();
  const session = useSessionStore((state) => state.session);
  const signOut = useSessionStore((state) => state.signOut);
  const setAwayMode = useCareStore((state) => state.setAwayMode);
  const { confirm, toast } = useFeedback();

  const away = isAwayActive(data);
  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const go = (href: Href) => () => router.push(href);

  const toggleAway = async (next: boolean) => {
    if (next) {
      const approved = await confirm({
        title: 'Pause phone reminders?',
        message: `Reminders on this phone will pause while you travel. ${recipient}'s schedule stays the same, and doses during this time are marked Away.`,
        confirmLabel: 'Turn on Away mode',
      });
      if (!approved) return;
    }
    setAwayMode(next);
    toast(next ? 'Away mode is on. Phone reminders are paused.' : 'Away mode is off. Reminders have resumed.');
  };

  const handleSignOut = async () => {
    const approved = await confirm({
      title: session?.kind === 'demo' ? 'Leave the demo?' : 'Sign out?',
      message: session?.kind === 'demo' ? 'Your demo data stays on this phone for next time.' : 'You can sign back in at any time.',
      confirmLabel: session?.kind === 'demo' ? 'Leave demo' : 'Sign out',
    });
    if (!approved) return;
    await signOut();
    router.replace('/welcome');
  };

  return (
    <Screen tabbed header={<ScreenHeader title="Settings" showBack={false} />}>
      <PressableScale
        accessibilityLabel={`Edit profile for ${data.caregiver?.name ?? 'caregiver'}`}
        onPress={go('/settings/profile')}
        pressedScale={0.985}
        style={styles.profile}
      >
        <View style={styles.avatar}>
          <AppText variant="title" color={colors.textOnPrimary}>
            {initialsOf(data.caregiver?.name ?? 'YB')}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{data.caregiver?.name ?? 'Your profile'}</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Family caregiver for {recipient}
          </AppText>
        </View>
        <Icon name="edit-2" size={20} color={colors.primaryDark} />
      </PressableScale>

      {session?.kind === 'demo' ? (
        <Notice
          icon="smartphone"
          tone="honey"
          title="Offline demo"
          message="Your data is saved only on this phone. No account or cloud service is connected."
        />
      ) : null}

      <Group title="Care">
        <ListRow
          icon="users"
          title="Family care circle"
          subtitle={`${data.contacts.length} trusted contact${data.contacts.length === 1 ? '' : 's'}`}
          onPress={go('/settings/care-circle')}
        />
        <Divider />
        <ListRow
          icon="file-text"
          title="Sharing and consent"
          subtitle={data.consents.some((item) => item.status === 'active') ? 'Clinic consent on file' : 'Nothing is being shared'}
          onPress={go('/settings/consent')}
        />
        <Divider />
        <View style={styles.awayRow}>
          <ToggleRow
            label="Away mode"
            description={away ? 'On. Phone reminders are paused.' : 'Pause phone reminders while traveling.'}
            value={away}
            onChange={(next) => void toggleAway(next)}
          />
          <Button compact variant="ghost" label="Learn how Away mode works" onPress={go('/settings/away')} containerStyle={styles.learn} />
        </View>
      </Group>

      <Group title="Bear and plan">
        <ListRow
          leading={<BearFace size={40} />}
          title={data.bear?.serial ?? 'Set up Demo Bear'}
          subtitle={
            bear.connection === 'connected' ? `Simulated · ${bear.battery ?? 0}% battery` : 'Not connected'
          }
          right={<DemoTag />}
          onPress={go('/settings/bear')}
        />
        <Divider />
        <ListRow
          icon="clipboard"
          title="Medication plan"
          subtitle={`${data.medications.filter((item) => !item.archivedAt).length} active`}
          onPress={go('/settings/plan')}
        />
        <Divider />
        <ListRow icon="bell" title="Reminder preferences" subtitle="Notifications, timing, and alerts" onPress={go('/settings/reminders')} />
      </Group>

      <Group title="Help">
        <ListRow icon="help-circle" title="Support" subtitle="Guides and common questions" onPress={go('/settings/support')} />
        <Divider />
        <ListRow icon="phone" iconTone="coral" title="Urgent help" subtitle="Emergency numbers and safety information" onPress={go('/settings/urgent')} />
        <Divider />
        <ListRow icon="info" title="App information" subtitle="Version, privacy, and feature status" onPress={go('/settings/about')} />
      </Group>

      <Button label={session?.kind === 'demo' ? 'Leave demo' : 'Sign out'} variant="secondary" icon="log-out" onPress={() => void handleSignOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.brownSoft,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  group: { gap: spacing.xs },
  groupCard: { paddingVertical: spacing.xxs },
  awayRow: { paddingVertical: spacing.xs },
  learn: { alignSelf: 'flex-start', marginLeft: -spacing.md },
});
