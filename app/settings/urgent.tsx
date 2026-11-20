import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconBadge, Notice } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import type { IconName } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useCareStore } from '@/stores/careStore';
import { displayPhone } from '@/utils/phone';

type NumberKey = 'emergencyNumber' | 'clinicNumber';

function NumberCard({
  icon,
  title,
  number,
  onCall,
  onEdit,
}: {
  icon: IconName;
  title: string;
  number?: string;
  onCall: () => void;
  onEdit: () => void;
}) {
  return (
    <Card style={styles.card}>
      <IconBadge icon={icon} tone="coral" size={42} />
      <View style={styles.flex}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="small" color={colors.textMuted}>
          {number ?? 'Add the number for your area'}
        </AppText>
      </View>
      {number ? (
        <View style={styles.actions}>
          <Button compact variant="teal" label="Call" onPress={onCall} />
          <Button compact variant="ghost" label="Edit" onPress={onEdit} />
        </View>
      ) : (
        <Button compact variant="secondary" label="Add" onPress={onEdit} />
      )}
    </Card>
  );
}

export default function UrgentHelpScreen() {
  const data = useCareData();
  const updateSettings = useCareStore((state) => state.updateSettings);
  const { toast } = useFeedback();
  const [editing, setEditing] = useState<NumberKey | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();

  const recipient = data.recipient?.preferredName ?? 'your loved one';

  const call = (number: string) => {
    Linking.openURL(`tel:${number.replace(/\s/g, '')}`).catch(() => toast('This device cannot place calls.', 'error'));
  };

  const openEditor = (key: NumberKey) => {
    setDraft(data.settings[key] ?? '');
    setError(undefined);
    setEditing(key);
  };

  const save = () => {
    if (!editing) return;
    const value = draft.trim();
    if (value && !/^[+\d][\d\s()-]{1,19}$/.test(value)) return setError('Please enter a valid phone number.');
    updateSettings({ [editing]: value || undefined });
    setEditing(null);
  };

  return (
    <Screen header={<ScreenHeader title="Urgent help" />}>
      <View style={styles.hero}>
        <IconBadge icon="alert-circle" tone="coral" size={52} />
        <AppText variant="h2" align="center">
          Yakap Bear is not an emergency service
        </AppText>
        <AppText variant="small" color={colors.textMuted} align="center">
          It helps families share reminders and dose logs. It cannot assess symptoms, monitor emergencies, or provide medical care.
        </AppText>
      </View>

      <Notice
        icon="alert-triangle"
        tone="honey"
        message="If someone may be in immediate danger, contact your local emergency services now."
      />

      <NumberCard
        icon="phone-call"
        title="Emergency services"
        number={data.settings.emergencyNumber}
        onCall={() => call(data.settings.emergencyNumber as string)}
        onEdit={() => openEditor('emergencyNumber')}
      />
      <NumberCard
        icon="stethoscope"
        title={`${recipient}'s clinic or doctor`}
        number={data.settings.clinicNumber}
        onCall={() => call(data.settings.clinicNumber as string)}
        onEdit={() => openEditor('clinicNumber')}
      />

      {data.contacts.map((contact) => (
        <NumberCard
          key={contact.id}
          icon="user"
          title={`${contact.name} · ${contact.relationship}`}
          number={displayPhone(contact.phone)}
          onCall={() => call(contact.phone)}
          onEdit={() => router.push('/settings/care-circle')}
        />
      ))}

      <Notice
        icon="shield"
        title="For medication questions"
        message={`Contact ${recipient}'s prescriber or pharmacist. Do not change a dose because of an alert in this app.`}
      />

      <BottomSheet
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'emergencyNumber' ? 'Emergency number' : 'Clinic or doctor number'}
        subtitle="Saved on this phone. Please double-check that it is correct for your area."
        footer={<Button label="Save number" onPress={save} />}
      >
        <TextField
          label="Phone number"
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setError(undefined);
          }}
          error={error}
          keyboardType="phone-pad"
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { alignItems: 'center' },
});
