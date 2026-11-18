import type { BearConnectionState, BearDevice, BearPlaybackState, VoiceRecording } from '@/types/models';

export interface BearSnapshot {
  mode: 'demo' | 'hardware';
  connection: BearConnectionState;
  playback: BearPlaybackState;
  /** Percent. In demo mode this is a simulated value and must be labeled as such. */
  battery: number | null;
  serial: string | null;
  lastSeenAt: string | null;
  message: string | null;
}

/**
 * The contract every bear implementation fulfils. Screens depend only on this interface,
 * so a real hardware service can replace the demo without changing the UI.
 */
export interface BearService {
  readonly mode: 'demo' | 'hardware';
  getSnapshot(): BearSnapshot;
  subscribe(listener: () => void): () => void;
  /** Restores a previously paired bear after the app restarts. */
  restore(device: BearDevice | null): void;
  connect(serial: string): Promise<void>;
  disconnect(): Promise<void>;
  /** Runs the full reminder sequence: chime, then voice, then waiting for confirmation. */
  previewReminder(recording: VoiceRecording | null): Promise<void>;
  stopPlayback(): void;
}
