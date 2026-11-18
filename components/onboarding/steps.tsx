import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ContactFormSheet } from '@/components/ContactFormSheet';
import { AppText } from '@/components/ui/AppText';
import { Divider, ListRow, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Fields';
import { VoiceRecorderCard } from '@/components/voice/VoiceRecorderCard';
import { getDeviceTimeZone, getTimeZoneOptions, RELATIONSHIP_OPTIONS } from '@/constants/defaults';
import { colors, spacing } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { useSessionStore } from '@/stores/sessionStore';
import { useCareStore } from '@/stores/careStore';
import type { FamilyContact } from '@/types/models';
import { describeRepeatDays, formatTime, toDateKey } from '@/utils/schedule';

export interface WhoFormHandle {
  values: { caregiverName: string; preferredName: string; relationship: string; timeZone: string; notes: string };
}

type WhoErrors = Partial<Record<'caregiverName' | 'preferredName' | 'relationship', string>>;

export function useWhoForm() {
  const data = useCareData();
  const session = useSessionStore((state) => state.session);
  const saveProfile = useCareStore((state) => state.saveProfile);
  const [caregiverName, setCaregiverName] = useState(data.caregiver?.name ?? session?.displayName ?? '');
  const [preferredName, setPreferredName] = useState(data.recipient?.preferredName ?? '');
  const [relationship, setRelationship] = useState(data.recipient?.relationship ?? '');
  const [timeZone, setTimeZone] = useState(data.recipient?.timeZone ?? getDeviceTimeZone());
  const [notes, setNotes] = useState(data.recipient?.notes ?? '');
  const [errors, setErrors] = useState<WhoErrors>({});

  const clearError = (field: keyof WhoErrors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = () => {
    const nextErrors: WhoErrors = {};
    if (!caregiverName.trim()) nextErrors.caregiverName = 'Please enter your name.';
    if (!preferredName.trim()) nextErrors.preferredName = 'Please enter the name they like to be called.';
    if (!relationship) nextErrors.relationship = 'Please choose a relationship.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return false;
    saveProfile(
      { name: caregiverName.trim(), phone: data.caregiver?.phone },
      { preferredName: preferredName.trim(), relationship, timeZone, notes: notes.trim() || undefined },
    );
    return true;
  };

  const fields = (
    <View style={styles.form}>
      <TextField label="Your name" value={caregiverName} onChangeText={(value) => { setCaregiverName(value); clearError('caregiverName'); }} error={errors.caregiverName} placeholder="Ana Santos" autoCapitalize="words" />
      <TextField label="Their preferred name" value={preferredName} onChangeText={(value) => { setPreferredName(value); clearError('preferredName'); }} error={errors.preferredName} placeholder="Lola Rosa" autoCapitalize="words" />
      <SelectField label="Relationship to you" value={relationship} options={RELATIONSHIP_OPTIONS} onChange={(value) => { setRelationship(value); clearError('relationship'); }} error={errors.relationship} />
      <SelectField
        label="Time zone"
        value={timeZone}
        options={getTimeZoneOptions()}
        onChange={setTimeZone}
        hint="Reminders follow this phone's clock."
      />
      <TextField label="Caregiver notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything helpful to remember" multiline maxLength={200} />
    </View>
  );

  return { fields, submit };
}

export function DosesStep() {
  const data = useCareData();
  const today = toDateKey(new Date());
  const medications = data.medications.filter((item) => !item.archivedAt);

  return (
    <View style={styles.form}>
      {medications.length > 0 ? (
        <Card style={styles.list}>
          {medications.map((medication, index) => {
            const schedules = data.schedules
              .filter((item) => item.medicationId === medication.id && (!item.endDate || item.endDate >= today))
              .sort((a, b) => a.time.localeCompare(b.time));
            return (
              <View key={medication.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  icon="clock"
                  title={medication.name}
                  subtitle={`${medication.doseLabel} · ${schedules.map((item) => formatTime(item.time)).join(', ')} · ${
                    schedules[0] ? describeRepeatDays(schedules[0].repeatDays) : ''
                  }`}
                  onPress={() => router.push({ pathname: '/medication/edit', params: { id: medication.id } })}
                />
              </View>
            );
          })}
        </Card>
      ) : (
        <Notice icon="clipboard" message="Add each medication exactly as it was prescribed." />
      )}
      <Button
        label={medications.length > 0 ? 'Add another medication' : 'Add a medication'}
        variant="secondary"
        icon="plus"
        onPress={() => router.push('/medication/edit')}
      />
    </View>
  );
}

export function VoiceStep({ onUnsavedChange }: { onUnsavedChange: (hasUnsavedTake: boolean) => void }) {
  const data = useCareData();
  return (
    <View style={styles.form}>
      <VoiceRecorderCard onUnsavedChange={onUnsavedChange} />
      {data.recordings.length > 0 ? (
        <Card style={styles.saved}>
          <Tag label="Saved" tone="teal" icon="check-circle" />
          {data.recordings.map((recording) => (
            <AppText key={recording.id} variant="bodyMedium">
              {recording.name}
            </AppText>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export function ContactsStep() {
  const data = useCareData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyContact | null>(null);

  return (
    <View style={styles.form}>
      {data.contacts.length > 0 ? (
        <Card style={styles.list}>
          {data.contacts.map((contact, index) => (
            <View key={contact.id}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                icon="user"
                title={contact.name}
                subtitle={`${contact.phone} · ${contact.relationship}`}
                onPress={() => {
                  setEditing(contact);
                  setSheetOpen(true);
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <Button
        label="Add a contact"
        variant="secondary"
        icon="plus"
        onPress={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
      />
      <AppText variant="small" color={colors.textMuted} align="center">
        Contacts are only used when you choose to text them about an unconfirmed dose or a bear issue.
      </AppText>
      <ContactFormSheet visible={sheetOpen} contact={editing} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  list: { paddingVertical: spacing.xxs },
  saved: { gap: spacing.xs },
});
