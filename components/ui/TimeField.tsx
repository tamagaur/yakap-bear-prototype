import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Segmented } from '@/components/ui/Segmented';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import type { TimeOfDay } from '@/types/models';
import { formatTime } from '@/utils/schedule';

const pad = (value: number) => String(value).padStart(2, '0');

function toParts(time: TimeOfDay) {
  const [hours, minutes] = time.split(':').map(Number);
  return { hour: hours % 12 === 0 ? 12 : hours % 12, minute: minutes, period: hours >= 12 ? 'PM' : 'AM' } as const;
}

function fromParts(hour: number, minute: number, period: 'AM' | 'PM'): TimeOfDay {
  const base = hour % 12;
  return `${pad(period === 'PM' ? base + 12 : base)}:${pad(minute)}`;
}

function Stepper({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <View style={styles.stepper}>
      <PressableScale accessibilityLabel={`Increase ${label}`} onPress={() => onStep(1)} style={styles.stepButton}>
        <Icon name="chevron-up" size={26} color={colors.primaryDark} />
      </PressableScale>
      <AppText variant="display" accessibilityLabel={`${label} ${value}`}>
        {value}
      </AppText>
      <PressableScale accessibilityLabel={`Decrease ${label}`} onPress={() => onStep(-1)} style={styles.stepButton}>
        <Icon name="chevron-down" size={26} color={colors.primaryDark} />
      </PressableScale>
    </View>
  );
}

export function TimePickerSheet({
  visible,
  value,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: TimeOfDay;
  onClose: () => void;
  onConfirm: (time: TimeOfDay) => void;
}) {
  const initial = toParts(value);
  const [hour, setHour] = useState<number>(initial.hour);
  const [minute, setMinute] = useState<number>(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  useEffect(() => {
    if (!visible) return;
    const parts = toParts(value);
    setHour(parts.hour);
    setMinute(parts.minute);
    setPeriod(parts.period);
  }, [value, visible]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Choose a time"
      footer={<Button label="Set time" onPress={() => onConfirm(fromParts(hour, minute, period))} />}
    >
      <View style={styles.pickerRow}>
        <Stepper label="hour" value={String(hour)} onStep={(step) => setHour((hour + step + 11) % 12 + 1)} />
        <AppText variant="display">:</AppText>
        <Stepper label="minute" value={pad(minute)} onStep={(step) => setMinute((minute + step * 5 + 60) % 60)} />
      </View>
      <Segmented
        label="Morning or evening"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'AM', label: 'AM' },
          { value: 'PM', label: 'PM' },
        ]}
      />
      <View style={styles.fineRow}>
        <AppText variant="small" color={colors.textMuted}>
          Fine-tune minutes
        </AppText>
        <View style={styles.fineButtons}>
          <Button compact variant="secondary" label="-1 min" onPress={() => setMinute((minute + 59) % 60)} />
          <Button compact variant="secondary" label="+1 min" onPress={() => setMinute((minute + 1) % 60)} />
        </View>
      </View>
    </BottomSheet>
  );
}

export function TimeField({
  value,
  onChange,
  label = 'Dose time',
}: {
  value: TimeOfDay;
  onChange: (time: TimeOfDay) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityLabel={`${label}: ${formatTime(value)}. Change time`}
        onPress={() => setOpen(true)}
        pressedScale={0.98}
        style={styles.field}
      >
        <Icon name="clock" size={19} color={colors.primary} />
        <AppText variant="title">{formatTime(value)}</AppText>
      </PressableScale>
      <TimePickerSheet
        visible={open}
        value={value}
        onClose={() => setOpen(false)}
        onConfirm={(time) => {
          onChange(time);
          setOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  stepper: { alignItems: 'center', minWidth: 88 },
  stepButton: {
    width: TOUCH_TARGET + 8,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  fineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, flexWrap: 'wrap' },
  fineButtons: { flexDirection: 'row', gap: spacing.xs },
});
