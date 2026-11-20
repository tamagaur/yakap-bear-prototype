import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BearFace } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { Divider, InfoLink, InfoPoint, ListRow, StatusChip } from '@/components/ui/Bits';
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
      <AppText variant="eyebrow" color={colors.textMuted} accessibilityRole="header" style={styles.groupTitle}>
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
  const activeMeds = data.medications.filter((item) => !item.archivedAt).length;
  const isDemo = session?.kind === 'demo';

  const toggleAway = async (next: boolean) => {
    if (next) {
      const approved = await confirm({
        title: 'Pause phone reminders?',
        message: `${recipient}'s schedule stays the same. Doses during this time are marked Away.`,
        confirmLabel: 'Turn on',
      });
      if (!approved) return;
    }
    setAwayMode(next);
    toast(next ? 'Away mode on.' : 'Away mode off. Reminders resumed.');
  };

  const handleSignOut = async () => {
    const approved = await confirm({
      title: isDemo ? 'Leave the demo?' : 'Sign out?',
      message: isDemo ? 'Your demo data stays on this phone.' : 'You can sign back in anytime.',
      confirmLabel: isDemo ? 'Leave demo' : 'Sign out',
    });
    if (!approved) return;
    await signOut();
    router.replace('/welcome');
  };

  return (
    <Screen tabbed header={<ScreenHeader large title="Settings" />}>
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
        <View style={styles.profileText}>
          <AppText variant="title" numberOfLines={1}>
            {data.caregiver?.name ?? 'Your profile'}
          </AppText>
          <AppText variant="small" color={colors.textMuted} numberOfLines={1}>
            Caring for {recipient}
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </PressableScale>

      {isDemo ? (
        <InfoLink label="Offline demo" title="Offline demo" icon="smartphone">
          <InfoPoint icon="smartphone" tone="honey" text="Your data is saved only on this phone." />
          <InfoPoint icon="cloud-off" text="No account or cloud service is connected." />
        </InfoLink>
      ) : null}

      <Group title="Care">
        <ListRow
          icon="users"
          title="Family"
          subtitle={`${data.contacts.length} contact${data.contacts.length === 1 ? '' : 's'}`}
          onPress={go('/settings/care-circle')}
        />
        <Divider />
        <ListRow
          icon="file-text"
          title="Sharing & consent"
          subtitle={data.consents.some((item) => item.status === 'active') ? 'Clinic consent on file' : 'Not sharing'}
          onPress={go('/settings/consent')}
        />
        <Divider />
        <View style={styles.awayRow}>
          <View style={styles.awayIcon}>
            <Icon name="map-pin" size={20} color={colors.brownDark} />
          </View>
          <View style={styles.flex}>
            <ToggleRow
              label="Away mode"
              description={away ? 'Reminders paused' : 'Pause while traveling'}
              value={away}
              onChange={(next) => void toggleAway(next)}
            />
          </View>
        </View>
        <Button compact variant="ghost" label="How Away mode works" onPress={go('/settings/away')} containerStyle={styles.learn} />
      </Group>

      <Group title="Bear & plan">
        <ListRow
          leading={<BearFace size={40} />}
          title={data.bear?.serial ?? 'Set up Demo Bear'}
          right={
            data.bear ? (
              <StatusChip
                label={bear.connection === 'connected' ? `${bear.battery ?? 0}%` : 'Offline'}
                tone={bear.connection === 'connected' ? 'teal' : 'neutral'}
              />
            ) : null
          }
          subtitle="Demo Bear"
          onPress={go('/settings/bear')}
        />
        <Divider />
        <ListRow icon="clipboard" title="Medication plan" subtitle={`${activeMeds} active`} onPress={go('/settings/plan')} />
        <Divider />
        <ListRow icon="bell" title="Reminders" subtitle="Timing and alerts" onPress={go('/settings/reminders')} />
      </Group>

      <Group title="Help">
        <ListRow icon="help-circle" title="Support" onPress={go('/settings/support')} />
        <Divider />
        <ListRow icon="phone" iconTone="coral" title="Urgent help" subtitle="Emergency numbers" onPress={go('/settings/urgent')} />
        <Divider />
        <ListRow icon="info" title="About" subtitle="Version and privacy" onPress={go('/settings/about')} />
      </Group>

      <Button label={isDemo ? 'Leave demo' : 'Sign out'} variant="secondary" icon="log-out" onPress={() => void handleSignOut()} />
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
  profileText: { flex: 1, gap: 2 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  group: { gap: spacing.xs },
  groupTitle: { marginLeft: spacing.xxs },
  groupCard: { paddingVertical: spacing.xxs },
  awayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  awayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brownSoft,
  },
  learn: { alignSelf: 'flex-start', marginLeft: 40 },
});
