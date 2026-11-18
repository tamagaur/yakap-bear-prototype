import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { DemoTag, IconBadge } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareStore } from '@/stores/careStore';
import { useSessionStore } from '@/stores/sessionStore';

/** Lets the presenter start clean or open the clearly labeled sample plan. */
export function DemoEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const enterDemo = useSessionStore((state) => state.enterDemo);
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const open = async (withSample: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await enterDemo();
      const care = useCareStore.getState();
      if (withSample && !care.data.hasSamplePlan) care.loadSamplePlan();
      onClose();
      router.replace(useCareStore.getState().data.onboarding.completed ? '/home' : '/onboarding');
    } catch {
      toast('The demo could not start. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Open the offline demo"
      subtitle="Everything stays on this phone. No account is created."
    >
      <Card onPress={() => void open(false)} accessibilityLabel="Set up my own care plan" style={styles.option}>
        <IconBadge icon="edit-3" />
        <View style={styles.text}>
          <AppText variant="title">Set up my own care plan</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Walk through the six setup steps.
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
      <Card onPress={() => void open(true)} accessibilityLabel="Open the sample care plan" style={styles.option}>
        <IconBadge icon="book-open" tone="honey" />
        <View style={styles.text}>
          <AppText variant="title">Open the sample care plan</AppText>
          <AppText variant="small" color={colors.textMuted}>
            Example doses and history for presentations.
          </AppText>
          <DemoTag label="Sample data" />
        </View>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: 3 },
});
