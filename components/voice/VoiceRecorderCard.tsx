import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, View } from 'react-native';

import { DoseAssignList } from '@/components/voice/DoseAssignList';
import { Waveform, seededBars } from '@/components/voice/Waveform';
import { AppText } from '@/components/ui/AppText';
import { Notice } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { MAX_RECORDING_MS, MAX_SAVED_RECORDINGS } from '@/constants/defaults';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useActiveDoseOptions, useCareData } from '@/hooks/useCareData';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { usePlayback } from '@/hooks/useServices';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { persistVoiceFile } from '@/services/audio/voiceFiles';
import { PREVIEW_ID, voicePlayback } from '@/services/audio/voicePlayback';
import { useCareStore } from '@/stores/careStore';
import { formatDuration } from '@/utils/doseText';
import { createId } from '@/utils/ids';

const IDLE_BARS = seededBars('yakap-idle');

function RecordButton({ recording, onPress, disabled }: { recording: boolean; onPress: () => void; disabled: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!recording || reducedMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, recording, reducedMotion]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.recordWrap}>
      <Animated.View style={[styles.pulse, { opacity: recording ? opacity : 0, transform: [{ scale }] }]} />
      <PressableScale
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        disabled={disabled}
        onPress={onPress}
        style={[styles.recordButton, disabled && styles.recordDisabled]}
      >
        <Icon name={recording ? 'square' : 'mic'} size={30} color={colors.textOnPrimary} />
      </PressableScale>
    </View>
  );
}

export function VoiceRecorderCard({
  onSaved,
  onUnsavedChange,
}: {
  onSaved?: () => void;
  /** Reports whether a finished take is waiting to be saved. */
  onUnsavedChange?: (hasUnsavedTake: boolean) => void;
}) {
  const data = useCareData();
  const addRecording = useCareStore((state) => state.addRecording);
  const doseOptions = useActiveDoseOptions();
  const playback = usePlayback();
  const { toast } = useFeedback();
  const recorder = useVoiceRecorder();
  const { handleBlur } = recorder;

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [assigned, setAssigned] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => () => handleBlur(), [handleBlur]));

  const isFull = data.recordings.length >= MAX_SAVED_RECORDINGS;
  const isRecording = recorder.phase === 'recording';
  const isRecorded = recorder.phase === 'recorded' && Boolean(recorder.tempUri);
  useEffect(() => {
    onUnsavedChange?.(isRecorded);
  }, [isRecorded, onUnsavedChange]);

  const previewActive = playback.recordingId === PREVIEW_ID;
  const previewPlaying = previewActive && playback.status === 'playing';
  const previewProgress = previewActive && playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;

  const save = async () => {
    if (!recorder.tempUri) return;
    if (!name.trim()) return setNameError('Please give this message a name.');
    setNameError(undefined);
    setSaving(true);
    voicePlayback.stop();
    try {
      const id = createId();
      const fileName = await persistVoiceFile(recorder.tempUri, id);
      const stamp = new Date().toISOString();
      addRecording(
        { id, name: name.trim(), fileName, durationMs: recorder.durationMs, createdAt: stamp, updatedAt: stamp },
        assigned,
      );
      recorder.markSaved();
      setName('');
      setAssigned([]);
      toast('Voice reminder saved.');
      onSaved?.();
    } catch {
      toast('The recording could not be saved. Please check your storage and try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remainingLabel = `${formatDuration(recorder.durationMs)} / ${formatDuration(MAX_RECORDING_MS)}`;

  return (
    <Card style={styles.card}>
      <AppText variant="eyebrow" color={colors.primaryDark} align="center">
        New recording
      </AppText>
      <AppText variant="h2" align="center">
        Record a little care
      </AppText>
      <AppText variant="small" color={colors.textMuted} align="center">
        Your voice plays at dose time. Keep it short and warm.
      </AppText>

      <Waveform
        levels={isRecording ? recorder.levels : IDLE_BARS}
        active={isRecording}
        progress={isRecorded ? previewProgress : undefined}
      />
      <AppText variant="h3" align="center" accessibilityLiveRegion="polite">
        {remainingLabel}
      </AppText>

      {recorder.phase === 'denied' ? (
        <Notice
          icon="mic-off"
          tone="coral"
          title="Microphone access is off"
          message="Allow microphone access in your phone settings to record a message."
        >
          <Button compact variant="secondary" label="Open settings" onPress={() => void Linking.openSettings()} />
        </Notice>
      ) : null}
      {recorder.phase === 'error' && recorder.errorMessage ? (
        <Notice icon="alert-circle" tone="coral" message={recorder.errorMessage} />
      ) : null}
      {isFull && !isRecorded ? (
        <Notice icon="info" tone="honey" message={`You can keep up to ${MAX_SAVED_RECORDINGS} messages. Delete one to record another.`} />
      ) : null}

      {isRecorded ? (
        <View style={styles.reviewBlock}>
          <View style={styles.previewRow}>
            <PressableScale
              accessibilityLabel={previewPlaying ? 'Pause preview' : 'Play preview'}
              onPress={() => void voicePlayback.togglePreview(recorder.tempUri as string, recorder.durationMs)}
              style={styles.previewButton}
            >
              <Icon name={previewPlaying ? 'pause' : 'play'} size={22} color={colors.textOnPrimary} />
            </PressableScale>
            <View style={styles.flex}>
              <AppText variant="title">Preview recording</AppText>
              <AppText variant="small" color={colors.textMuted}>
                {formatDuration(recorder.durationMs)}
              </AppText>
            </View>
            <Button compact variant="ghost" icon="rotate-ccw" label="Rerecord" onPress={recorder.reset} />
          </View>
          {playback.status === 'error' && previewActive ? (
            <Notice icon="alert-circle" tone="coral" message={playback.errorMessage ?? 'This take could not be played.'} />
          ) : null}

          <TextField
            label="Message name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameError(undefined);
            }}
            error={nameError}
            placeholder={'For example, "Good morning, Lola"'}
            maxLength={40}
          />
          <View style={styles.assign}>
            <AppText variant="title">Assign to a dose</AppText>
            <DoseAssignList options={doseOptions} selected={assigned} onChange={setAssigned} />
          </View>
          <Button label="Save reminder" icon="check" onPress={() => void save()} loading={saving} />
        </View>
      ) : (
        <View style={styles.center}>
          <RecordButton
            recording={isRecording}
            disabled={recorder.phase === 'preparing' || isFull}
            onPress={() => void (isRecording ? recorder.stop() : recorder.start())}
          />
          <AppText variant="caption" color={colors.textMuted} align="center">
            {isRecording ? 'Tap to stop' : 'Tap to record, up to 30 seconds'}
          </AppText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, padding: spacing.lg },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  recordWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: colors.coral },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.coralDeep,
    ...shadows.raised,
  },
  recordDisabled: { opacity: 0.5 },
  reviewBlock: { gap: spacing.md, marginTop: spacing.xs },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.brownSoft,
  },
  previewButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  assign: { gap: spacing.xs },
});
