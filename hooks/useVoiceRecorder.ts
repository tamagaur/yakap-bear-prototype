import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { MAX_RECORDING_MS } from '@/constants/defaults';
import { deleteTempVoiceFile } from '@/services/audio/voiceFiles';
import { voicePlayback } from '@/services/audio/voicePlayback';
import { haptics } from '@/services/haptics';

export type RecorderPhase = 'idle' | 'preparing' | 'recording' | 'recorded' | 'denied' | 'error';

const BAR_COUNT = 34;
const MIN_TAKE_MS = 800;
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const quietBars = () => Array.from({ length: BAR_COUNT }, () => 0.12);

function levelFromMetering(metering: number | undefined, tick: number): number {
  if (metering === undefined) return 0.3 + Math.abs(Math.sin(tick * 1.7)) * 0.5;
  return Math.max(0.08, Math.min(1, (metering + 50) / 50));
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 110);

  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [tempUri, setTempUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(quietBars);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const phaseRef = useRef<RecorderPhase>('idle');
  const tempUriRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const tickRef = useRef(0);
  const mountedRef = useRef(true);

  const updatePhase = useCallback((next: RecorderPhase) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  }, []);

  const rememberTake = useCallback((uri: string | null) => {
    tempUriRef.current = uri;
    if (mountedRef.current) setTempUri(uri);
  }, []);

  const restoreAudioMode = useCallback(
    () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined),
    [],
  );

  const fail = useCallback(
    (message: string) => {
      if (mountedRef.current) setErrorMessage(message);
      updatePhase('error');
      void restoreAudioMode();
    },
    [restoreAudioMode, updatePhase],
  );

  const start = useCallback(async () => {
    if (phaseRef.current === 'preparing' || phaseRef.current === 'recording') return;
    voicePlayback.stop();
    if (tempUriRef.current) deleteTempVoiceFile(tempUriRef.current);
    rememberTake(null);
    setErrorMessage(null);
    setDurationMs(0);
    durationRef.current = 0;
    setLevels(quietBars());
    updatePhase('preparing');

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        updatePhase('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // The caregiver may have left the screen while the microphone was getting ready.
      if ((phaseRef.current as RecorderPhase) !== 'preparing') {
        void restoreAudioMode();
        return;
      }
      recorder.record();
      haptics.soft();
      updatePhase('recording');
    } catch {
      fail('The microphone could not start. Please close other apps using it and try again.');
    }
  }, [fail, recorder, rememberTake, restoreAudioMode, updatePhase]);

  const stop = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    updatePhase('preparing');
    try {
      await recorder.stop();
      await restoreAudioMode();
      const uri = recorder.uri;
      const finalDuration = durationRef.current;
      if (!uri) return fail('That recording could not be saved. Please try again.');
      if (finalDuration < MIN_TAKE_MS) {
        deleteTempVoiceFile(uri);
        return fail('That was a little too short. Please record a longer message.');
      }
      rememberTake(uri);
      if (mountedRef.current) setDurationMs(finalDuration);
      haptics.success();
      updatePhase('recorded');
    } catch {
      fail('That recording could not be finished. Please try again.');
    }
  }, [fail, recorder, rememberTake, restoreAudioMode, updatePhase]);

  /** Throws away the current take and returns to the starting state. */
  const reset = useCallback(() => {
    voicePlayback.stop();
    if (tempUriRef.current) deleteTempVoiceFile(tempUriRef.current);
    rememberTake(null);
    setDurationMs(0);
    durationRef.current = 0;
    setLevels(quietBars());
    setErrorMessage(null);
    updatePhase('idle');
  }, [rememberTake, updatePhase]);

  /** Marks a take as saved, so its file is no longer treated as temporary. */
  const markSaved = useCallback(() => {
    voicePlayback.stop();
    rememberTake(null);
    setDurationMs(0);
    durationRef.current = 0;
    setLevels(quietBars());
    updatePhase('idle');
  }, [rememberTake, updatePhase]);

  /** Releases the microphone when the caregiver leaves the screen. */
  const cancel = useCallback(() => {
    const wasRecording = phaseRef.current === 'recording';
    const wasPreparing = phaseRef.current === 'preparing';
    updatePhase('idle');
    if (wasRecording || wasPreparing) {
      recorder
        .stop()
        .catch(() => undefined)
        .finally(() => {
          void restoreAudioMode();
          if (recorder.uri) deleteTempVoiceFile(recorder.uri);
        });
    }
    voicePlayback.stop();
    if (tempUriRef.current) deleteTempVoiceFile(tempUriRef.current);
    rememberTake(null);
    if (mountedRef.current) {
      setDurationMs(0);
      setLevels(quietBars());
    }
  }, [recorder, rememberTake, restoreAudioMode, updatePhase]);

  /** Leaving the screen ends a live recording, but a finished take is kept for when they return. */
  const handleBlur = useCallback(() => {
    if (phaseRef.current === 'recording' || phaseRef.current === 'preparing') cancel();
    else voicePlayback.stop();
  }, [cancel]);

  // Tracks elapsed time, drives the waveform, and enforces the 30 second limit.
  useEffect(() => {
    if (phase !== 'recording') return;
    durationRef.current = recorderState.durationMillis;
    setDurationMs(recorderState.durationMillis);
    tickRef.current += 1;
    const level = levelFromMetering(recorderState.metering, tickRef.current);
    setLevels((current) => [...current.slice(1), level]);
    if (recorderState.durationMillis >= MAX_RECORDING_MS) void stop();
  }, [phase, recorderState.durationMillis, recorderState.metering, stop]);

  // Keeps what was captured if the phone leaves the app mid-recording.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current === 'recording') void stop();
    });
    return () => subscription.remove();
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (tempUriRef.current) deleteTempVoiceFile(tempUriRef.current);
      tempUriRef.current = null;
      phaseRef.current = 'idle';
      voicePlayback.stop();
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    };
  }, []);

  return { phase, tempUri, durationMs, levels, errorMessage, start, stop, reset, markSaved, handleBlur };
}
