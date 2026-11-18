import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { Divider, Notice, Tag } from '@/components/ui/Bits';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/Fields';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useCareStore } from '@/stores/careStore';
import { isAwayActive } from '@/utils/notificationPlan';

const CHANGES: { icon: IconName; text: string }[] = [
  { icon: 'bell-off', text: 'Dose reminders on this phone are paused.' },
  { icon: 'map-pin', text: 'Unconfirmed doses are labeled Away in History.' },
  { icon: 'calendar', text: 'The medication schedule itself never changes.' },
  { icon: 'check-circle', text: 'You can still confirm any dose in the app.' },
];

export default function AwayModeScreen() {
  const data = useCareData();
  const setAwayMode = useCareStore((state) => state.setAwayMode);
  const { confirm, toast } = useFeedback();

  const away = isAwayActive(data);
  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const pastPeriods = [...data.settings.awayPeriods].reverse().slice(0, 5);

  const toggle = async (next: boolean) => {
    if (next) {
      const approved = await confirm({
        title: 'Pause phone reminders?',
        message: `Please make sure someone else is helping ${recipient} with doses while reminders are paused.`,
        confirmLabel: 'Turn on Away mode',
      });
      if (!approved) return;
    }
    setAwayMode(next);
    toast(next ? 'Away mode is on.' : 'Away mode is off. Reminders have resumed.');
  };

  return (
    <Screen header={<ScreenHeader title="Away mode" />}>
      <View style={styles.hero}>
        <BearMascot size={130} mood={away ? 'sleepy' : 'idle'} />
        <Tag label={away ? 'Away mode is on' : 'Away mode is off'} tone={away ? 'brown' : 'teal'} icon={away ? 'map-pin' : 'check-circle'} />
      </View>

      <Card>
        <ToggleRow
          label="Away mode"
          description="For when you are traveling and someone else is helping."
          value={away}
          onChange={(next) => void toggle(next)}
        />
      </Card>

      <Card style={styles.list}>
        <AppText variant="title">What changes</AppText>
        {CHANGES.map((item) => (
          <View key={item.text} style={styles.row}>
            <Icon name={item.icon} size={19} color={colors.primary} />
            <AppText variant="small" style={styles.flex}>
              {item.text}
            </AppText>
          </View>
        ))}
      </Card>

      <Notice icon="alert-triangle" tone="honey" message="Away mode does not change prescribed doses. Ask the care team before changing any medication routine." />

      {pastPeriods.length > 0 ? (
        <Card style={styles.list}>
          <AppText variant="title">Recent Away periods</AppText>
          {pastPeriods.map((period, index) => (
            <View key={period.id} style={styles.period}>
              {index > 0 ? <Divider /> : null}
              <AppText variant="small" color={colors.textMuted}>
                {format(new Date(period.startedAt), 'MMM d, h:mm a')} to{' '}
                {period.endedAt ? format(new Date(period.endedAt), 'MMM d, h:mm a') : 'now'}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  period: { gap: spacing.xs },
});
