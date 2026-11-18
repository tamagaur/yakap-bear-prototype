import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { DemoTag, Notice, StatusPill } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useBear } from '@/hooks/useServices';
import { haptics } from '@/services/haptics';
import { useCareStore } from '@/stores/careStore';
import type { DoseEventSource, DoseOccurrence } from '@/types/models';
import { formatTime } from '@/utils/schedule';

const HOLD_MS = 2000;

function PawHold({ onComplete }: { onComplete: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);

  const begin = () => {
    setHolding(true);
    haptics.soft();
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
  };

  const release = () => {
    setHolding(false);
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: false }).start();
  };

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold the Demo Bear's paw for two seconds to confirm this dose"
      onPressIn={begin}
      onPressOut={release}
      style={styles.paw}
    >
      <Animated.View style={[styles.pawFill, { width }]} />
      <Icon name="paw" size={22} color={colors.brownDark} />
      <AppText variant="smallBold" color={colors.brownDark}>
        {holding ? 'Keep holding…' : "Hold the bear's paw to confirm"}
      </AppText>
    </Pressable>
  );
}

interface DoseActionSheetProps {
  occurrence: DoseOccurrence | null;
  onClose: () => void;
  onRecorded?: (type: 'taken' | 'skipped') => void;
}

/** Confirms or skips one dose. Nothing is recorded until the caregiver acts here. */
export function DoseActionSheet({ occurrence, onClose, onRecorded }: DoseActionSheetProps) {
  const data = useCareData();
  const bear = useBear();
  const recordDose = useCareStore((state) => state.recordDose);
  const { celebrate, toast } = useFeedback();
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const lastOccurrence = useRef(occurrence);
  if (occurrence) lastOccurrence.current = occurrence;
  const dose = occurrence ?? lastOccurrence.current;

  useEffect(() => {
    if (occurrence) setConfirmingSkip(false);
  }, [occurrence]);

  if (!dose) return null;

  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const isEarly = dose.scheduledAt.getTime() - Date.now() > data.settings.onTimeWindowMinutes * 60_000;

  const confirmTaken = (source: DoseEventSource) => {
    recordDose(dose, 'taken', { source });
    onClose();
    onRecorded?.('taken');
    celebrate(`Thank you! ${recipient}'s dose is confirmed.`);
  };

  const skip = () => {
    recordDose(dose, 'skipped');
    haptics.warning();
    onClose();
    onRecorded?.('skipped');
    toast('Recorded as skipped.', 'info');
  };

  return (
    <BottomSheet visible={Boolean(occurrence)} onClose={onClose} title="Confirm this dose" subtitle={`For ${recipient}`}>
      <Card style={styles.summary}>
        <View style={styles.summaryText}>
          <AppText variant="h3">{dose.medicationName}</AppText>
          <AppText color={colors.textMuted}>
            {dose.doseLabel} · {formatTime(dose.time)}
          </AppText>
          {dose.instructions ? (
            <AppText variant="small" color={colors.textMuted}>
              {dose.instructions}
            </AppText>
          ) : null}
        </View>
        <StatusPill status={dose.status} />
      </Card>

      {isEarly ? (
        <Notice
          icon="clock"
          tone="honey"
          message={`This dose is scheduled for ${formatTime(dose.time)}. Confirm only if it has really been taken.`}
        />
      ) : null}

      {confirmingSkip ? (
        <View style={styles.actions}>
          <AppText variant="title">Record this dose as skipped?</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Skipped doses appear in History. For questions about a missed dose, please ask the prescriber or pharmacist.
          </AppText>
          <Button label="Yes, record as skipped" variant="danger" onPress={skip} />
          <Button label="Go back" variant="ghost" onPress={() => setConfirmingSkip(false)} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button label="Yes, it was taken" icon="check" variant="teal" onPress={() => confirmTaken('caregiver')} />
          {bear.connection === 'connected' ? (
            <View style={styles.demoBlock}>
              <PawHold onComplete={() => confirmTaken('demo_paw')} />
              <DemoTag label="Simulated Demo Bear" />
            </View>
          ) : null}
          <Button label="Skip this dose" variant="ghost" onPress={() => setConfirmingSkip(true)} />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  summaryText: { flex: 1, gap: 2 },
  actions: { gap: spacing.xs },
  demoBlock: { gap: 6, alignItems: 'center' },
  paw: {
    alignSelf: 'stretch',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.brownSoft,
    overflow: 'hidden',
  },
  pawFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.coral, opacity: 0.55 },
});
