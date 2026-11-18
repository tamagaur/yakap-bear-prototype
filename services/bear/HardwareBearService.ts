import type { BearSnapshot, BearService } from '@/services/bear/types';
import type { BearDevice, VoiceRecording } from '@/types/models';

const NOT_AVAILABLE = 'A physical Yakap Bear is not supported in this version of the app.';

/**
 * Placeholder for the physical bear. No hardware protocol exists yet, so every action
 * reports that it is unavailable instead of pretending a connection was made. A future
 * build can implement BearService here using a development build and the real protocol.
 */
export class HardwareBearService implements BearService {
  readonly mode = 'hardware' as const;

  private snapshot: BearSnapshot = {
    mode: 'hardware',
    connection: 'disconnected',
    playback: 'idle',
    battery: null,
    serial: null,
    lastSeenAt: null,
    message: NOT_AVAILABLE,
  };

  getSnapshot = () => this.snapshot;
  subscribe = () => () => undefined;
  restore(_device: BearDevice | null) {}
  async connect(_serial: string) {
    throw new Error(NOT_AVAILABLE);
  }
  async disconnect() {}
  async previewReminder(_recording: VoiceRecording | null) {
    throw new Error(NOT_AVAILABLE);
  }
  stopPlayback() {}
}
