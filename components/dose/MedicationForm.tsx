import { addMinutes } from 'date-fns';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DayPicker } from '@/components/dose/DayPicker';
import { AppText } from '@/components/ui/AppText';
import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField, type SelectOption } from '@/components/ui/Fields';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { TimeField } from '@/components/ui/TimeField';
import { ALL_DAYS } from '@/constants/defaults';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import type { MedicationDoseInput, MedicationInput } from '@/types/models';
import { combineDateTime, formatTime, toDateKey } from '@/utils/schedule';
import { validateMedication, type FieldErrors, type MedicationField } from '@/utils/validation';

const NO_VOICE = 'none';

function buildInitial(medicationId: string | undefined, data: ReturnType<typeof useCareData>): MedicationInput {
  const today = toDateKey(new Date());
  const medication = data.medications.find((item) => item.id === medicationId);
  if (!medication) {
    return { name: '', doseLabel: '', instructions: '', repeatDays: [...ALL_DAYS], doses: [{ time: '08:00' }] };
  }
  const schedules = data.schedules
    .filter((item) => item.medicationId === medication.id && (!item.endDate || item.endDate >= today))
    .sort((a, b) => a.time.localeCompare(b.time));
  return {
    id: medication.id,
    name: medication.name,
    doseLabel: medication.doseLabel,
    instructions: medication.instructions ?? '',
    repeatDays: schedules[0]?.repeatDays ?? [...ALL_DAYS],
    doses: schedules.map((item) => ({ scheduleId: item.id, time: item.time, voiceRecordingId: item.voiceRecordingId })),
  };
}

function suggestNextTime(doses: MedicationDoseInput[]): string {
  const taken = new Set(doses.map((dose) => dose.time));
  return ['08:00', '12:00', '18:00', '20:00', '21:00', '06:00'].find((time) => !taken.has(time)) ?? '09:00';
}

export function MedicationForm({
  medicationId,
  onSaved,
  onDelete,
}: {
  medicationId?: string;
  onSaved: (input: MedicationInput) => void;
  onDelete?: () => void;
}) {
  const data = useCareData();
  const [form, setForm] = useState<MedicationInput>(() => buildInitial(medicationId, data));
  const [errors, setErrors] = useState<FieldErrors<MedicationField>>({});

  const voiceOptions = useMemo<SelectOption[]>(
    () => [
      { value: NO_VOICE, label: 'None' },
      ...data.recordings.map((recording) => ({ value: recording.id, label: recording.name })),
    ],
    [data.recordings],
  );

  const patch = (next: Partial<MedicationInput>) => {
    setForm((current) => ({ ...current, ...next }));
    setErrors((current) => {
      const remaining = { ...current };
      (Object.keys(next) as MedicationField[]).forEach((field) => delete remaining[field]);
      return remaining;
    });
  };
  const patchDose = (index: number, next: Partial<MedicationDoseInput>) =>
    patch({ doses: form.doses.map((dose, position) => (position === index ? { ...dose, ...next } : dose)) });

  const submit = () => {
    const nextErrors = validateMedication(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSaved(form);
  };

  const now = new Date();
  const startsTomorrow = form.doses.some(
    (dose) =>
      !dose.scheduleId &&
      addMinutes(combineDateTime(toDateKey(now), dose.time), data.settings.onTimeWindowMinutes).getTime() < now.getTime(),
  );

  return (
    <View style={styles.form}>
      <TextField
        label="Medication name"
        value={form.name}
        onChangeText={(name) => patch({ name })}
        error={errors.name}
        placeholder="As on the prescription"
        autoCapitalize="words"
        maxLength={60}
      />
      <TextField
        label="Dose"
        value={form.doseLabel}
        onChangeText={(doseLabel) => patch({ doseLabel })}
        error={errors.doseLabel}
        hint="Exactly as prescribed."
        placeholder="e.g. 2 tablets"
        maxLength={40}
      />

      <View style={styles.section}>
        <AppText variant="smallBold">Times</AppText>
        {form.doses.map((dose, index) => (
          <Card key={dose.scheduleId ?? `new-${index}`} style={styles.doseCard}>
            <View style={styles.doseTop}>
              <View style={styles.flex}>
                <TimeField value={dose.time} onChange={(time) => patchDose(index, { time })} />
              </View>
              {form.doses.length > 1 ? (
                <PressableScale
                  accessibilityLabel={`Remove the ${formatTime(dose.time)} dose`}
                  onPress={() => patch({ doses: form.doses.filter((_, position) => position !== index) })}
                  style={styles.remove}
                >
                  <Icon name="trash-2" size={20} color={colors.coralDeep} />
                </PressableScale>
              ) : null}
            </View>
            <SelectField
              label="Voice message"
              value={dose.voiceRecordingId ?? NO_VOICE}
              options={voiceOptions}
              onChange={(value) => patchDose(index, { voiceRecordingId: value === NO_VOICE ? undefined : value })}
              hint={data.recordings.length === 0 ? 'Record one in the Voice tab.' : undefined}
            />
          </Card>
        ))}
        {errors.doses ? (
          <AppText variant="caption" color={colors.coralDeep}>
            {errors.doses}
          </AppText>
        ) : null}
        <Button
          compact
          variant="secondary"
          icon="plus"
          label="Add time"
          onPress={() => patch({ doses: [...form.doses, { time: suggestNextTime(form.doses) }] })}
        />
        {startsTomorrow ? (
          <Notice icon="info" message="Times already past today start tomorrow." />
        ) : null}
      </View>

      <DayPicker value={form.repeatDays} onChange={(repeatDays) => patch({ repeatDays })} error={errors.repeatDays} />

      <TextField
        label="Instructions (optional)"
        value={form.instructions}
        onChangeText={(instructions) => patch({ instructions })}
        placeholder="e.g. After breakfast"
        multiline
        maxLength={160}
      />

      <AppText variant="caption" color={colors.textMuted} align="center">
        Follow your prescriber or pharmacist&apos;s instructions.
      </AppText>

      <Button label={medicationId ? 'Save changes' : 'Save'} icon="check" onPress={submit} />
      {onDelete ? <Button label="Delete medication" variant="danger" icon="trash-2" onPress={onDelete} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  flex: { flex: 1 },
  section: { gap: spacing.xs },
  doseCard: { gap: spacing.sm, padding: spacing.sm },
  doseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  remove: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralSoft,
  },
});
