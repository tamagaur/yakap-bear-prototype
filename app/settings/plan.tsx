import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { EmptyState, IconBadge, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useCareStore } from '@/stores/careStore';
import { describeRepeatDays, formatTime, toDateKey } from '@/utils/schedule';

export default function PlanScreen() {
  const data = useCareData();
  const clearSamplePlan = useCareStore((state) => state.clearSamplePlan);
  const { confirm, toast } = useFeedback();
  const today = toDateKey(new Date());
  const medications = data.medications.filter((item) => !item.archivedAt);

  const removeSample = async () => {
    const approved = await confirm({
      title: 'Remove the sample plan?',
      message: 'Sample doses, history, and contacts will be deleted. Anything you added yourself stays.',
      confirmLabel: 'Remove sample plan',
      destructive: true,
    });
    if (!approved) return;
    clearSamplePlan();
    toast('Sample plan removed.');
  };

  return (
    <Screen header={<ScreenHeader title="Medication plan" />}>
      {data.hasSamplePlan ? (
        <Notice icon="book-open" tone="honey" title="Sample care plan" message="Example data for demonstration only.">
          <Button compact variant="secondary" label="Remove sample plan" onPress={() => void removeSample()} />
        </Notice>
      ) : null}

      {medications.length === 0 ? (
        <EmptyState
          title="No medications yet"
          message="Add a medication and its dose times to begin."
          actionLabel="Add a medication"
          onAction={() => router.push('/medication/edit')}
        />
      ) : (
        medications.map((medication) => {
          const schedules = data.schedules
            .filter((item) => item.medicationId === medication.id && (!item.endDate || item.endDate >= today))
            .sort((a, b) => a.time.localeCompare(b.time));
          return (
            <Card
              key={medication.id}
              onPress={() => router.push({ pathname: '/medication/edit', params: { id: medication.id } })}
              accessibilityLabel={`Edit ${medication.name}`}
              style={styles.card}
            >
              <IconBadge icon="clipboard" size={42} />
              <View style={styles.flex}>
                <AppText variant="title">{medication.name}</AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {medication.doseLabel}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {schedules.map((item) => formatTime(item.time)).join(', ')}
                  {schedules[0] ? ` · ${describeRepeatDays(schedules[0].repeatDays)}` : ''}
                </AppText>
                {medication.isSample ? <Tag label="Sample" tone="honey" /> : null}
              </View>
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            </Card>
          );
        })
      )}

      {medications.length > 0 ? <Button label="Add a medication" icon="plus" onPress={() => router.push('/medication/edit')} /> : null}

      <Notice icon="shield" tone="honey" message="Medication schedules should follow professional instructions. Yakap Bear never recommends or adjusts doses." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
