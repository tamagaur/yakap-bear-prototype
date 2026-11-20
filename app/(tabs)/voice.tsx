import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DoseAssignList } from '@/components/voice/DoseAssignList';
import { VoiceRecorderCard } from '@/components/voice/VoiceRecorderCard';
import { Waveform, seededBars } from '@/components/voice/Waveform';
import { AppText } from '@/components/ui/AppText';
import { Divider, EmptyState, InfoPoint, Notice, Tag } from '@/components/ui/Bits';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { IconButton, Screen, ScreenHeader } from '@/components/ui/Screen';
import { MAX_SAVED_RECORDINGS } from '@/constants/defaults';
import { colors, radii, spacing, TOUCH_TARGET } from '@/constants/theme';
import { afterSheetClose, useFeedback } from '@/contexts/FeedbackContext';
import { useActiveDoseOptions, useCareData } from '@/hooks/useCareData';
import { useBear, usePlayback } from '@/hooks/useServices';
import { voicePlayback } from '@/services/audio/voicePlayback';
import { bearService } from '@/services/bear';
import { useCareStore } from '@/stores/careStore';
import type { VoiceRecording } from '@/types/models';
import { formatDuration } from '@/utils/doseText';

function RecordingRow({
  recording,
  assignedCount,
  onMenu,
}: {
  recording: VoiceRecording;
  assignedCount: number;
  onMenu: () => void;
}) {
  const playback = usePlayback();
  const bars = useMemo(() => seededBars(recording.id, 26), [recording.id]);
  const isCurrent = playback.recordingId === recording.id;
  const isPlaying = isCurrent && playback.status === 'playing';
  const isLoading = isCurrent && playback.status === 'loading';
  const progress = isCurrent && playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <PressableScale
          accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${recording.name}`}
          onPress={() => void voicePlayback.toggle(recording)}
          style={styles.play}
        >
          <Icon name={isPlaying ? 'pause' : isLoading ? 'loader' : 'play'} size={21} color={colors.textOnPrimary} />
        </PressableScale>
        <View style={styles.flex}>
          <AppText variant="title" numberOfLines={1}>
            {recording.name}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {formatDuration(recording.durationMs)} ·{' '}
            {assignedCount > 0 ? `${assignedCount} dose${assignedCount === 1 ? '' : 's'}` : 'Not assigned'}
          </AppText>
        </View>
        <PressableScale accessibilityLabel={`Options for ${recording.name}`} onPress={onMenu} style={styles.more}>
          <Icon name="more-horizontal" size={22} />
        </PressableScale>
      </View>
      {isCurrent && playback.status !== 'error' ? <Waveform levels={bars} progress={progress} /> : null}
      {isCurrent && playback.status === 'error' ? (
        <Notice icon="alert-circle" tone="coral" message={playback.errorMessage ?? 'This recording could not be played.'} />
      ) : null}
    </View>
  );
}

export default function VoiceScreen() {
  const data = useCareData();
  const bear = useBear();
  const doseOptions = useActiveDoseOptions();
  const renameRecording = useCareStore((state) => state.renameRecording);
  const deleteRecording = useCareStore((state) => state.deleteRecording);
  const assignRecording = useCareStore((state) => state.assignRecording);
  const { confirm, toast } = useFeedback();

  const [infoOpen, setInfoOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<VoiceRecording | null>(null);
  const [renaming, setRenaming] = useState<VoiceRecording | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [assigning, setAssigning] = useState<VoiceRecording | null>(null);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);

  const assignedCount = (id: string) => doseOptions.filter((option) => option.voiceRecordingId === id).length;

  const openRename = (recording: VoiceRecording) => {
    setMenuFor(null);
    afterSheetClose(() => {
      setNameDraft(recording.name);
      setNameError(undefined);
      setRenaming(recording);
    });
  };

  const openAssign = (recording: VoiceRecording) => {
    setMenuFor(null);
    afterSheetClose(() => {
      setAssignDraft(doseOptions.filter((option) => option.voiceRecordingId === recording.id).map((option) => option.scheduleId));
      setAssigning(recording);
    });
  };

  const playOnDemoBear = (recording: VoiceRecording) => {
    setMenuFor(null);
    if (bear.connection !== 'connected') {
      toast('Pair the Demo Bear first.', 'info');
      return;
    }
    void bearService.previewReminder(recording);
    toast('Playing on this phone.', 'info');
  };

  const handleDelete = (recording: VoiceRecording) => {
    setMenuFor(null);
    afterSheetClose(async () => {
      const approved = await confirm({
        title: `Delete "${recording.name}"?`,
        message: 'It will be removed from any doses using it.',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (!approved) return;
      deleteRecording(recording.id);
      toast('Message deleted.');
    });
  };

  const saveRename = () => {
    if (!renaming) return;
    if (!nameDraft.trim()) return setNameError('Please enter a name.');
    renameRecording(renaming.id, nameDraft);
    setRenaming(null);
    toast('Renamed.');
  };

  return (
    <Screen
      tabbed
      header={
        <ScreenHeader
          large
          title="Voice"
          right={<IconButton icon="info" tone="card" label="About voice messages" onPress={() => setInfoOpen(true)} />}
        />
      }
    >
      <VoiceRecorderCard />

      <View style={styles.savedHeader}>
        <AppText variant="title" accessibilityRole="header" style={styles.savedTitle}>
          Saved
        </AppText>
        <Tag label={`${data.recordings.length}/${MAX_SAVED_RECORDINGS}`} />
      </View>

      {data.recordings.length === 0 ? (
        <EmptyState mood="comfort" size={96} title="No messages yet" message="Your voice makes reminders warmer." />
      ) : (
        <Card style={styles.list}>
          {data.recordings.map((recording, index) => (
            <View key={recording.id}>
              {index > 0 ? <Divider /> : null}
              <RecordingRow
                recording={recording}
                assignedCount={assignedCount(recording.id)}
                onMenu={() => setMenuFor(recording)}
              />
            </View>
          ))}
        </Card>
      )}

      <BottomSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title="Voice messages">
        <InfoPoint icon="lock" text="Saved privately on this phone." />
        <InfoPoint icon="bell" text="Plays when you open a dose reminder." />
        <InfoPoint icon="smartphone" tone="honey" text="Demo Bear audio plays through this phone. Nothing is sent to a physical bear." />
      </BottomSheet>

      <BottomSheet visible={Boolean(menuFor)} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        <Button label="Rename" variant="secondary" icon="edit-2" onPress={() => menuFor && openRename(menuFor)} />
        <Button label="Choose doses" variant="secondary" icon="calendar" onPress={() => menuFor && openAssign(menuFor)} />
        <Button label="Play on Demo Bear" variant="secondary" icon="volume-2" onPress={() => menuFor && playOnDemoBear(menuFor)} />
        <Button label="Delete" variant="danger" icon="trash-2" onPress={() => menuFor && handleDelete(menuFor)} />
      </BottomSheet>

      <BottomSheet
        visible={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="Rename"
        footer={<Button label="Save" onPress={saveRename} />}
      >
        <TextField
          label="Name"
          value={nameDraft}
          onChangeText={(value) => {
            setNameDraft(value);
            setNameError(undefined);
          }}
          error={nameError}
          maxLength={40}
        />
      </BottomSheet>

      <BottomSheet
        visible={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title="Play at"
        subtitle={assigning?.name}
        footer={
          doseOptions.length > 0 ? (
            <Button
              label="Save"
              onPress={() => {
                if (assigning) assignRecording(assigning.id, assignDraft);
                setAssigning(null);
                toast('Saved.');
              }}
            />
          ) : (
            <Button
              label="Add medication"
              onPress={() => {
                setAssigning(null);
                afterSheetClose(() => router.push('/medication/edit'));
              }}
            />
          )
        }
      >
        <DoseAssignList options={doseOptions} selected={assignDraft} onChange={setAssignDraft} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  savedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  savedTitle: { flex: 1, fontSize: 17 },
  list: { paddingVertical: spacing.xxs },
  rowWrap: { paddingVertical: spacing.xs, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  play: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  more: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  demoTag: { alignItems: 'center' },
});
