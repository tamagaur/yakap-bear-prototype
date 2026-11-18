import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Divider, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, ToggleRow } from '@/components/ui/Fields';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import {
  openDeviceSettings,
  requestNotificationPermission,
  sendTestNotification,
  syncDoseNotifications,
  type NotificationSyncResult,
} from '@/services/notifications';
import { useCareStore } from '@/stores/careStore';

const minuteOptions = (values: number[]) => values.map((value) => ({ value: String(value), label: `${value} minutes` }));

export default function RemindersScreen() {
  const data = useCareData();
  const updateSettings = useCareStore((state) => state.updateSettings);
  const { toast } = useFeedback();
  const { settings } = data;
  const [sync, setSync] = useState<NotificationSyncResult | null>(null);

  const refresh = useCallback(() => {
    syncDoseNotifications(useCareStore.getState().data)
      .then(setSync)
      .catch(() => setSync(null));
  }, []);

  useFocusEffect(refresh);

  const allow = async () => {
    const permission = await requestNotificationPermission();
    if (permission === 'denied') {
      toast('Notifications are off. You can turn them on in your phone settings.', 'info');
    }
    refresh();
  };

  const test = async () => {
    const permission = await sendTestNotification();
    if (permission === 'granted') toast('A test reminder will arrive in about 5 seconds.', 'info');
    else toast('Please allow notifications first.', 'error');
  };

  const permission = sync?.permission ?? 'undetermined';

  return (
    <Screen header={<ScreenHeader title="Reminder preferences" />}>
      <Card style={styles.block}>
        <View style={styles.statusRow}>
          <AppText variant="h3" style={styles.flex}>
            Phone notifications
          </AppText>
          <Tag
            label={permission === 'granted' ? 'Allowed' : permission === 'unsupported' ? 'Unavailable' : 'Not allowed'}
            tone={permission === 'granted' ? 'teal' : 'coral'}
            icon={permission === 'granted' ? 'check-circle' : 'alert-circle'}
          />
        </View>
        {permission === 'granted' ? (
          <>
            <AppText variant="small" color={colors.textMuted}>
              {sync && sync.scheduled > 0 && sync.lastReminderAt
                ? `${sync.scheduled} reminders are set through ${format(sync.lastReminderAt, 'MMM d')}. Open the app at least every two weeks to keep them going.`
                : 'No reminders are waiting right now.'}
            </AppText>
            <Button compact variant="secondary" icon="bell" label="Send a test reminder" onPress={() => void test()} />
          </>
        ) : permission === 'unsupported' ? (
          <Notice icon="info" message="Notifications work on a phone through Expo Go, but not in a web browser." />
        ) : permission === 'denied' ? (
          <>
            <Notice icon="bell-off" tone="coral" message="Reminders cannot reach this phone. Doses still appear in the app." />
            <Button compact variant="secondary" label="Open phone settings" onPress={() => void openDeviceSettings()} />
          </>
        ) : (
          <Button compact variant="teal" label="Allow notifications" onPress={() => void allow()} />
        )}
      </Card>

      <Card style={styles.block}>
        <ToggleRow
          label="Dose reminders"
          description="Notify this phone at each dose time."
          value={settings.notificationsEnabled}
          onChange={(notificationsEnabled) => updateSettings({ notificationsEnabled })}
        />
        <Divider />
        <ToggleRow
          label="Follow-up reminder"
          description="Remind again if a dose is still unconfirmed."
          value={settings.followUpEnabled}
          onChange={(followUpEnabled) => updateSettings({ followUpEnabled })}
        />
        {settings.followUpEnabled ? (
          <SelectField
            label="Follow up after"
            value={String(settings.followUpMinutes)}
            options={minuteOptions([15, 30, 45, 60])}
            onChange={(value) => updateSettings({ followUpMinutes: Number(value) })}
          />
        ) : null}
        <Divider />
        <ToggleRow
          label="Show medication names"
          description="Turn off to keep names private on the lock screen."
          value={settings.showMedicationNameInNotifications}
          onChange={(showMedicationNameInNotifications) => updateSettings({ showMedicationNameInNotifications })}
        />
        <Divider />
        <ToggleRow
          label="Play voice automatically"
          description="Play the assigned message when a reminder opens."
          value={settings.autoPlayVoice}
          onChange={(autoPlayVoice) => updateSettings({ autoPlayVoice })}
        />
        <Divider />
        <ToggleRow
          label="Gentle vibrations"
          description="Soft haptic feedback when you tap."
          value={settings.hapticsEnabled}
          onChange={(hapticsEnabled) => updateSettings({ hapticsEnabled })}
        />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3">Dose timing labels</AppText>
        <AppText variant="small" color={colors.textMuted}>
          These only control how doses are labeled in the app. They do not change the prescribed schedule.
        </AppText>
        <SelectField
          label="On time within"
          value={String(settings.onTimeWindowMinutes)}
          options={minuteOptions([15, 30, 45, 60])}
          onChange={(value) => {
            const onTimeWindowMinutes = Number(value);
            updateSettings({
              onTimeWindowMinutes,
              lateWindowMinutes: Math.max(settings.lateWindowMinutes, onTimeWindowMinutes + 30),
            });
          }}
        />
        <SelectField
          label="Late until"
          value={String(settings.lateWindowMinutes)}
          options={minuteOptions([60, 90, 120, 180].filter((value) => value > settings.onTimeWindowMinutes))}
          onChange={(value) => updateSettings({ lateWindowMinutes: Number(value) })}
        />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3">Smart family alerts</AppText>
        <ToggleRow
          label="In-app alerts"
          description="Show unconfirmed doses on Home and in Care alerts."
          value={settings.familyAlertsEnabled}
          onChange={(familyAlertsEnabled) => updateSettings({ familyAlertsEnabled })}
        />
        <Divider />
        <ToggleRow
          label="Medication name in texts"
          description="Off by default, to protect privacy."
          value={settings.includeMedicationNameInTexts}
          onChange={(includeMedicationNameInTexts) => updateSettings({ includeMedicationNameInTexts })}
        />
        <Notice
          icon="info"
          tone="honey"
          message="Texts open in your messages app for you to send. Automatic family alerts would need a backend service and are not active."
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
