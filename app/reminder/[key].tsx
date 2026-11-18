import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BearMascot } from '@/components/bear/BearMascot';
import { DoseActionSheet } from '@/components/dose/DoseActionSheet';
import { AppText } from '@/components/ui/AppText';
import { DemoTag, EmptyState, Notice, StatusPill } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { colors, spacing } from '@/constants/theme';
import { useCareData } from '@/hooks/useCareData';
import { useNow } from '@/hooks/useNow';
import { usePlayback } from '@/hooks/useServices';
import { voicePlayback } from '@/services/audio/voicePlayback';
import { getOccurrenceByKey, formatTime } from '@/utils/schedule';

/** Opened from a notification. Playing a reminder never marks the dose as taken. */
export default function ReminderScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const data = useCareData();
  const now = useNow();
  const playback = usePlayback();
  const [confirming, setConfirming] = useState(false);
  const autoPlayed = useRef(false);

  const dose = useMemo(() => (key ? getOccurrenceByKey(data, key, now) : null), [data, key, now]);
  const voice = data.recordings.find((item) => item.id === dose?.voiceRecordingId);
  const recipient = data.recipient?.preferredName ?? 'your loved one';
  const isPlaying = playback.recordingId === voice?.id && playback.status === 'playing';

  useEffect(() => {
    if (!voice || !data.settings.autoPlayVoice || autoPlayed.current) return;
    autoPlayed.current = true;
    void voicePlayback.play(voice);
  }, [data.settings.autoPlayVoice, voice]);

  useEffect(() => () => voicePlayback.stop(), []);

  if (!dose) {
    return (
      <Screen header={<ScreenHeader backIcon="x" />}>
        <EmptyState
          title="This reminder has passed"
          message="The dose may have been changed or removed from the plan."
          actionLabel="Go home"
          onAction={() => router.replace('/home')}
        />
      </Screen>
    );
  }

  const open = dose.status === 'upcoming' || dose.status === 'late' || dose.status === 'missed' || dose.status === 'away';

  return (
    <Screen header={<ScreenHeader backIcon="x" title="Reminder" />} contentStyle={styles.content}>
      <View style={styles.center}>
        <BearMascot size={170} mood={isPlaying ? 'listening' : 'idle'} floating waving={isPlaying} />
        <AppText variant="eyebrow" color={colors.primaryDark}>
          {formatTime(dose.time)} reminder
        </AppText>
        <AppText variant="h1" align="center">
          Time for {recipient}'s medicine
        </AppText>
      </View>

      <Card style={styles.card}>
        <AppText variant="h3">{dose.medicationName}</AppText>
        <AppText color={colors.textMuted}>{dose.doseLabel}</AppText>
        {dose.instructions ? (
          <AppText variant="small" color={colors.textMuted}>
            {dose.instructions}
          </AppText>
        ) : null}
        <StatusPill status={dose.status} confirmedLate={dose.confirmedLate} />
      </Card>

      {voice ? (
        <Button
          label={isPlaying ? 'Pause voice message' : `Play "${voice.name}"`}
          variant="secondary"
          icon={isPlaying ? 'pause' : 'play'}
          onPress={() => void voicePlayback.toggle(voice)}
        />
      ) : (
        <Notice icon="mic" tone="honey" message="No voice message is assigned to this dose yet." />
      )}
      {playback.status === 'error' && playback.errorMessage ? (
        <Notice icon="alert-circle" tone="coral" message={playback.errorMessage} />
      ) : null}
      {voice ? (
        <View style={styles.center}>
          <DemoTag label="Plays through this phone" />
        </View>
      ) : null}

      {open ? <Button label="Confirm this dose" icon="check" variant="teal" onPress={() => setConfirming(true)} /> : null}
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />

      <DoseActionSheet occurrence={confirming ? dose : null} onClose={() => setConfirming(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.xxs },
  card: { gap: spacing.xxs },
});
