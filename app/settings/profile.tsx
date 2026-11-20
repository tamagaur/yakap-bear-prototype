import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PhoneField, SelectField, TextField } from '@/components/ui/Fields';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { getDeviceTimeZone, getTimeZoneOptions, RELATIONSHIP_OPTIONS } from '@/constants/defaults';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useCareStore } from '@/stores/careStore';
import { formatPhPhone, isCompletePhPhone, isEmptyPhPhone } from '@/utils/phone';

type Errors = Partial<Record<'caregiverName' | 'phone' | 'preferredName' | 'relationship', string>>;

export default function ProfileScreen() {
  const data = useCareData();
  const saveProfile = useCareStore((state) => state.saveProfile);
  const { toast } = useFeedback();

  const [caregiverName, setCaregiverName] = useState(data.caregiver?.name ?? '');
  const [phone, setPhone] = useState(data.caregiver?.phone ?? '');
  const [preferredName, setPreferredName] = useState(data.recipient?.preferredName ?? '');
  const [relationship, setRelationship] = useState(data.recipient?.relationship ?? '');
  const [timeZone, setTimeZone] = useState(data.recipient?.timeZone ?? getDeviceTimeZone());
  const [notes, setNotes] = useState(data.recipient?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const clearError = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const save = () => {
    const next: Errors = {};
    if (!caregiverName.trim()) next.caregiverName = 'Please enter your name.';
    if (!isEmptyPhPhone(phone) && !isCompletePhPhone(phone)) next.phone = 'Enter a mobile number, like 0912 345 6789.';
    if (!preferredName.trim()) next.preferredName = 'Please enter their preferred name.';
    if (!relationship) next.relationship = 'Please choose a relationship.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    saveProfile(
      { name: caregiverName.trim(), phone: isEmptyPhPhone(phone) ? undefined : formatPhPhone(phone) },
      { preferredName: preferredName.trim(), relationship, timeZone, notes: notes.trim() || undefined },
    );
    toast('Profile saved.');
    router.back();
  };

  return (
    <Screen header={<ScreenHeader title="Edit profile" />} footer={<Button label="Save changes" onPress={save} />}>
      <AppText variant="h3">About you</AppText>
      <TextField label="Your name" value={caregiverName} onChangeText={(value) => { setCaregiverName(value); clearError('caregiverName'); }} error={errors.caregiverName} autoCapitalize="words" />
      <PhoneField label="Your mobile (optional)" value={phone} onChangeText={(value) => { setPhone(value); clearError('phone'); }} error={errors.phone} />

      <AppText variant="h3">The person you care for</AppText>
      <TextField label="Preferred name" value={preferredName} onChangeText={(value) => { setPreferredName(value); clearError('preferredName'); }} error={errors.preferredName} autoCapitalize="words" />
      <SelectField label="Relationship to you" value={relationship} options={RELATIONSHIP_OPTIONS} onChange={(value) => { setRelationship(value); clearError('relationship'); }} error={errors.relationship} />
      <SelectField label="Time zone" value={timeZone} options={getTimeZoneOptions()} onChange={setTimeZone} hint="Reminders follow this phone's clock." />
      <TextField label="Caregiver notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={200} />
    </Screen>
  );
}
