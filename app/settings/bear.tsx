import { format } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { BearPairingPanel } from '@/components/onboarding/BearPairingPanel';
import { AppText } from '@/components/ui/AppText';
import { DemoTag, Divider, Notice, Tag } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Fields';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useCareData } from '@/hooks/useCareData';
import { useBear } from '@/hooks/useServices';
import { bearService } from '@/services/bear';
import { useCareStore } from '@/stores/careStore';
import type { BearPlaybackState } from '@/types/models';

const SEQUENCE: { state: BearPlaybackState; label: string; icon: IconName }[] = [
  { state: 'chime', label: 'Soft chime', icon: 'bell' },
  { state: 'playing', label: 'Voice message', icon: 'volume-2' },
  { state: 'awaiting_confirmation', label: 'Wait for confirmation', icon: 'check-circle' },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText variant="small" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="smallBold">{value}</AppText>
    </View>
  );
}

export default function BearScreen() {
  const data = useCareData();
  const bear = useBear();
  const unpairBear = useCareStore((state) => state.unpairBear);
  const setBearBattery = useCareStore((state) => state.setBearBattery);
  const { confirm, toast } = useFeedback();
  const [recordingId, setRecordingId] = useState(data.recordings[0]?.id ?? 'none');

  const isConnected = bear.connection === 'connected';
  const isPlaying = bear.playback !== 'idle';
  const recording = data.recordings.find((item) => item.id === recordingId) ?? null;

  const setBattery = (battery: number) => {
    bearService.setDemoBattery(battery);
    setBearBattery(battery);
    toast(`Simulated battery set to ${battery}%.`, 'info');
  };

  const remove = async () => {
    const approved = await confirm({
      title: 'Remove the Demo Bear?',
      message: 'You can pair it again at any time. Your voice messages stay saved.',
      confirmLabel: 'Remove Demo Bear',
      destructive: true,
    });
    if (!approved) return;
    await bearService.disconnect();
    unpairBear();
    toast('Demo Bear removed.');
  };

  if (!data.bear) {
    return (
      <Screen header={<ScreenHeader title="Demo Bear" />}>
        <BearPairingPanel />
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Demo Bear" />}>
      <Card style={styles.hero}>
        <BearMascot
          size={170}
          mood={bear.playback === 'awaiting_confirmation' ? 'happy' : bear.playback === 'playing' ? 'listening' : 'idle'}
          waving={bear.playback === 'chime' || bear.playback === 'playing'}
          floating={isConnected}
        />
        <AppText variant="h2">{data.bear.serial}</AppText>
        <DemoTag label="Simulated Demo Bear" />
      </Card>

      <Card style={styles.block}>
        <InfoRow label="Connection" value={isConnected ? 'Connected (simulated)' : 'Disconnected'} />
        <Divider />
        <InfoRow label="Battery" value={bear.battery !== null ? `${bear.battery}% (simulated)` : 'Unavailable'} />
        <Divider />
        <InfoRow label="Paired" value={format(new Date(data.bear.pairedAt), 'MMM d, yyyy')} />
        {isConnected ? (
          <Button compact variant="secondary" icon="x-circle" label="Disconnect" onPress={() => void bearService.disconnect()} />
        ) : (
          <Button compact variant="teal" icon="link" label={bear.message ?? 'Reconnect'} disabled={bear.connection !== 'disconnected'} onPress={() => void bearService.connect(data.bear?.serial ?? 'BEAR-0001')} />
        )}
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3">Preview a reminder</AppText>
        <AppText variant="small" color={colors.textMuted}>
          See the sequence a bear would follow at dose time. Sound plays through this phone.
        </AppText>
        <SelectField
          label="Voice message"
          value={recordingId}
          onChange={setRecordingId}
          options={[
            { value: 'none', label: 'Chime only' },
            ...data.recordings.map((item) => ({ value: item.id, label: item.name })),
          ]}
          hint={data.recordings.length === 0 ? 'Record a message in the Voice tab to hear it here.' : undefined}
        />
        <View style={styles.sequence}>
          {SEQUENCE.map((step) => {
            const active = bear.playback === step.state;
            return (
              <View key={step.state} style={styles.sequenceRow}>
                <Icon name={step.icon} size={18} color={active ? colors.primary : colors.textMuted} />
                <AppText variant={active ? 'smallBold' : 'small'} color={active ? colors.primaryDark : colors.textMuted} style={styles.flex}>
                  {step.label}
                </AppText>
                {active ? <Tag label="Now" tone="teal" /> : null}
              </View>
            );
          })}
        </View>
        {bear.message && bear.playback === 'idle' && isConnected ? (
          <Notice icon="alert-circle" tone="coral" message={bear.message} />
        ) : null}
        {isPlaying ? (
          <Button variant="secondary" icon="square" label="Stop preview" onPress={() => bearService.stopPlayback()} />
        ) : (
          <Button icon="play" label="Preview reminder" disabled={!isConnected} onPress={() => void bearService.previewReminder(recording)} />
        )}
        <Notice icon="info" message="A preview never marks a dose as taken." />
      </Card>

      <Card style={styles.block}>
        <AppText variant="h3">Demo controls</AppText>
        <AppText variant="small" color={colors.textMuted}>
          Try how the app responds to simulated battery levels.
        </AppText>
        <View style={styles.row}>
          <Button compact variant="secondary" icon="battery" label="Low (15%)" containerStyle={styles.flex} onPress={() => setBattery(15)} />
          <Button compact variant="secondary" icon="battery-charging" label="Full (100%)" containerStyle={styles.flex} onPress={() => setBattery(100)} />
        </View>
      </Card>

      <Notice
        icon="cpu"
        tone="honey"
        title="About the physical bear"
        message="This version does not connect to real hardware. No audio is transmitted to any device."
      />
      <Button label="Remove Demo Bear" variant="danger" icon="trash-2" onPress={() => void remove()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs },
  block: { gap: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  sequence: { gap: spacing.xs },
  sequenceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
  row: { flexDirection: 'row', gap: spacing.xs },
});
