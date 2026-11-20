import { isSameDay } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState, IconBadge } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { afterSheetClose, useFeedback } from '@/contexts/FeedbackContext';
import { useCareData, useTodaySnapshot } from '@/hooks/useCareData';
import { useNow } from '@/hooks/useNow';
import { openSmsComposer } from '@/services/sms';
import { useCareStore } from '@/stores/careStore';
import type { DoseOccurrence, FamilyContact } from '@/types/models';
import { buildAlertMessage, type CareAlert } from '@/utils/alerts';

export default function AlertsScreen() {
  const data = useCareData();
  const now = useNow();
  const { alerts } = useTodaySnapshot(now);
  const dismissAlert = useCareStore((state) => state.dismissAlert);
  const logActivity = useCareStore((state) => state.logActivity);
  const { toast } = useFeedback();

  const [textingAlert, setTextingAlert] = useState<CareAlert | null>(null);
  const [activeDose, setActiveDose] = useState<DoseOccurrence | null>(null);

  const eligible = data.contacts.filter((contact) => contact.notifyMissedDose && contact.consentConfirmedAt);

  const sendText = (alert: CareAlert, contact: FamilyContact) => {
    setTextingAlert(null);
    const message = buildAlertMessage(
      alert.occurrence,
      data.recipient,
      data.caregiver,
      data.settings.includeMedicationNameInTexts,
    );
    // The messages app can only open once this sheet has fully closed.
    afterSheetClose(async () => {
      const result = await openSmsComposer([contact.phone], message);
      if (result === 'unavailable') {
        toast('This device cannot open a text message.', 'error');
      } else if (result === 'opened') {
        logActivity('sms_opened', `Text prepared for ${contact.name}. Delivery is not tracked.`);
        toast("Messages opened. We can't see if it was sent.", 'info');
      }
    });
  };

  return (
    <Screen header={<ScreenHeader title="Care alerts" />}>

      {alerts.length === 0 ? (
        <EmptyState mood="happy" title="All calm" message="Nothing needs your attention." />
      ) : (
        alerts.map((alert) => (
          <Card key={alert.id} style={styles.card}>
            <View style={styles.top}>
              <IconBadge icon="bell" tone={alert.severity === 'overdue' ? 'honey' : 'coral'} size={40} />
              <View style={styles.flex}>
                <AppText variant="title">{alert.title}</AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {alert.body}
                </AppText>
              </View>
            </View>
            {isSameDay(alert.occurrence.scheduledAt, now) ? (
              <Button compact variant="teal" icon="check" label="Mark as taken" onPress={() => setActiveDose(alert.occurrence)} />
            ) : (
              <Button
                compact
                variant="teal"
                icon="edit-2"
                label="Review"
                onPress={() => router.push({ pathname: '/history', params: { date: alert.occurrence.date } })}
              />
            )}
            <Button compact variant="secondary" icon="message-circle" label="Text family" onPress={() => setTextingAlert(alert)} />
            <Button compact variant="ghost" label="Dismiss" onPress={() => dismissAlert(alert.id)} />
          </Card>
        ))
      )}

      <BottomSheet
        visible={Boolean(textingAlert)}
        onClose={() => setTextingAlert(null)}
        title="Text who?"
        subtitle="You review it before sending. Nothing is sent automatically."
      >
        {eligible.length === 0 ? (
          <>
            <AppText color={colors.textMuted}>
              Add a contact who agreed to receive updates.
            </AppText>
            <Button
              label="Open family"
              onPress={() => {
                setTextingAlert(null);
                afterSheetClose(() => router.push('/settings/care-circle'));
              }}
            />
          </>
        ) : (
          eligible.map((contact) => (
            <Button
              key={contact.id}
              variant="secondary"
              icon="message-circle"
              label={`${contact.name} · ${contact.relationship}`}
              onPress={() => textingAlert && sendText(textingAlert, contact)}
            />
          ))
        )}
      </BottomSheet>

      <DoseActionSheet occurrence={activeDose} onClose={() => setActiveDose(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing.xs },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.xxs },
});
