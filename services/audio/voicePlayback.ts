import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { resolveVoiceUri } from '@/services/audio/voiceFiles';
import type { VoiceRecording } from '@/types/models';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PlaybackSnapshot {
  recordingId: string | null;
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number;
  errorMessage: string | null;
}

const IDLE: PlaybackSnapshot = { recordingId: null, status: 'idle', positionMs: 0, durationMs: 0, errorMessage: null };
const LOAD_TIMEOUT_MS = 6000;
export const PREVIEW_ID = 'unsaved-preview';

export const MISSING_AUDIO_MESSAGE = 'This recording is missing from the phone. Please record it again.';
export const DAMAGED_AUDIO_MESSAGE = 'This recording could not be played. It may be damaged, so please record it again.';

/** One shared player, so two voice messages can never play over each other. */
class VoicePlayback {
  private snapshot: PlaybackSnapshot = IDLE;
  private listeners = new Set<() => void>();
  private player: AudioPlayer | null = null;
  private subscription: { remove: () => void } | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(next: Partial<PlaybackSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private release() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadTimer = null;
    this.subscription?.remove();
    this.subscription = null;
    try {
      this.player?.pause();
      this.player?.remove();
    } catch {
      // The native player may already have been released.
    }
    this.player = null;
  }

  private fail(recordingId: string, errorMessage: string) {
    this.release();
    this.snapshot = { ...IDLE, recordingId, status: 'error', errorMessage };
    this.listeners.forEach((listener) => listener());
  }

  async play(recording: VoiceRecording): Promise<boolean> {
    const uri = resolveVoiceUri(recording.fileName);
    if (!uri) {
      this.fail(recording.id, MISSING_AUDIO_MESSAGE);
      return false;
    }
    return this.playUri(recording.id, uri, recording.durationMs);
  }

  /** Plays any local audio, including an unsaved take being previewed. */
  async playUri(id: string, uri: string, expectedDurationMs: number): Promise<boolean> {
    this.release();
    this.snapshot = { ...IDLE, recordingId: id, status: 'loading', durationMs: expectedDurationMs };
    this.listeners.forEach((listener) => listener());

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });
      const player = createAudioPlayer({ uri }, { updateInterval: 150 });
      this.player = player;
      this.loadTimer = setTimeout(() => {
        if (this.player === player && !player.isLoaded) this.fail(id, DAMAGED_AUDIO_MESSAGE);
      }, LOAD_TIMEOUT_MS);

      this.subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (this.player !== player) return;
        if (status.isLoaded && this.loadTimer) {
          clearTimeout(this.loadTimer);
          this.loadTimer = null;
        }
        if (status.didJustFinish) {
          this.release();
          this.snapshot = IDLE;
          this.listeners.forEach((listener) => listener());
          return;
        }
        this.update({
          status: status.playing ? 'playing' : this.snapshot.status === 'paused' ? 'paused' : 'loading',
          positionMs: Math.round(status.currentTime * 1000),
          durationMs: status.duration > 0 ? Math.round(status.duration * 1000) : expectedDurationMs,
        });
      });
      player.play();
      return true;
    } catch {
      this.fail(id, DAMAGED_AUDIO_MESSAGE);
      return false;
    }
  }

  pause() {
    if (!this.player) return;
    this.player.pause();
    this.update({ status: 'paused' });
  }

  resume() {
    if (!this.player) return;
    this.player.play();
    this.update({ status: 'playing' });
  }

  async toggle(recording: VoiceRecording) {
    const { recordingId, status } = this.snapshot;
    if (recordingId === recording.id && status === 'playing') return this.pause();
    if (recordingId === recording.id && status === 'paused') return this.resume();
    await this.play(recording);
  }

  async togglePreview(uri: string, durationMs: number) {
    const { recordingId, status } = this.snapshot;
    if (recordingId === PREVIEW_ID && status === 'playing') return this.pause();
    if (recordingId === PREVIEW_ID && status === 'paused') return this.resume();
    await this.playUri(PREVIEW_ID, uri, durationMs);
  }

  stop() {
    this.release();
    this.snapshot = IDLE;
    this.listeners.forEach((listener) => listener());
  }
}

export const voicePlayback = new VoicePlayback();
