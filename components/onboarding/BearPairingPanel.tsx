import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { AppText } from '@/components/ui/AppText';
import { InfoLink, InfoPoint, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { useBear } from '@/hooks/useServices';
import { bearService, DEMO_START_BATTERY } from '@/services/bear';
import { useCareStore } from '@/stores/careStore';
import type { BearConnectionState } from '@/types/models';
import { createId } from '@/utils/ids';

const SERIAL = 'BEAR-0001';
const STEPS: { state: BearConnectionState; label: string }[] = [
  { state: 'searching', label: 'Searching' },
  { state: 'pairing', label: 'Pairing' },
  { state: 'connected', label: 'Connected' },
];

export function BearPairingPanel() {
  const data = useCareData();
  const bear = useBear();
  const pairBear = useCareStore((state) => state.pairBear);

  const isConnected = bear.connection === 'connected';
  const isBusy = bear.connection === 'searching' || bear.connection === 'pairing';
  const activeIndex = STEPS.findIndex((step) => step.state === bear.connection);

  const startPairing = async () => {
    await bearService.connect(SERIAL);
    if (bearService.getSnapshot().connection !== 'connected') return;
    if (!useCareStore.getState().data.bear) {
      pairBear({
        id: createId(),
        serial: SERIAL,
        mode: 'demo',
        pairedAt: new Date().toISOString(),
        lastBattery: DEMO_START_BATTERY,
      });
    }
  };

  const testPlayback = () => void bearService.previewReminder(data.recordings[0] ?? null);

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <BearMascot size={150} mood={isConnected ? 'excited' : 'idle'} waving={isBusy} />
        <AppText variant="h3">{SERIAL}</AppText>
        <DemoBearInfo active={isConnected} />

        <View style={styles.steps}>
          {STEPS.map((step, index) => {
            const done = activeIndex >= index;
            return (
              <View key={step.state} style={styles.step}>
                <Icon name={done ? 'check-circle' : 'circle'} size={18} color={done ? colors.primary : colors.borderStrong} />
                <AppText variant="caption" color={done ? colors.primaryDark : colors.textMuted}>
                  {step.label}
                </AppText>
              </View>
            );
          })}
        </View>

        {isConnected ? (
          <>
            <View>
              <Tag label={`${bear.battery ?? DEMO_START_BATTERY}% battery`} tone="teal" icon="battery-charging" />
            </View>
            <Button
              compact
              variant="secondary"
              icon="volume-2"
              label={bear.playback === 'idle' ? 'Test sound' : 'Playing…'}
              disabled={bear.playback !== 'idle'}
              onPress={testPlayback}
              containerStyle={styles.fullWidth}
            />
          </>
        ) : (
          <>
            {isBusy && bear.message ? (
              <AppText variant="small" color={colors.primaryDark} align="center" accessibilityLiveRegion="polite">
                {bear.message}
              </AppText>
            ) : null}
            <Button
              label="Pair Demo Bear"
              icon="link"
              loading={isBusy}
              onPress={() => void startPairing()}
              containerStyle={styles.fullWidth}
            />
          </>
        )}
      </Card>
    </View>
  );
}

/** Compact "Demo Bear" label. Tapping it explains what is simulated. */
export function DemoBearInfo({ active }: { active: boolean }) {
  return (
    <InfoLink label={active ? 'Demo Bear active' : 'Demo Bear'} title="About the Demo Bear" tone={active ? 'teal' : 'honey'}>
      <InfoPoint icon="cpu" tone="honey" text="No physical bear is connected." />
      <InfoPoint icon="battery" tone="honey" text="Connection and battery are simulated." />
      <InfoPoint icon="volume-2" text="Sound plays through this phone." />
    </InfoLink>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  steps: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginVertical: spacing.xs },
  step: { alignItems: 'center', gap: 4, flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
});
