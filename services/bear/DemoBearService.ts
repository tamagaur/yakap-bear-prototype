import { voicePlayback } from '@/services/audio/voicePlayback';
import { haptics } from '@/services/haptics';
import type { BearSnapshot, BearService } from '@/services/bear/types';
import type { BearDevice, VoiceRecording } from '@/types/models';

const STEP_MS = 1300;
const CHIME_MS = 1100;
const AWAIT_CONFIRMATION_MS = 3500;
const BATTERY_TICK_MS = 5 * 60_000;
export const DEMO_START_BATTERY = 82;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Simulates a Yakap Bear for Expo Go. No radio or hardware is involved: connection states
 * and battery are invented for the demonstration, and audio plays through the phone speaker.
 */
export class DemoBearService implements BearService {
  readonly mode = 'demo' as const;

  private snapshot: BearSnapshot = {
    mode: 'demo',
    connection: 'disconnected',
    playback: 'idle',
    battery: null,
    serial: null,
    lastSeenAt: null,
    message: null,
  };
  private listeners = new Set<() => void>();
  private batteryTimer: ReturnType<typeof setInterval> | null = null;
  private runId = 0;
  private stopWatchingPlayback: (() => void) | null = null;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(next: Partial<BearSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private startBatterySimulation() {
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    this.batteryTimer = setInterval(() => {
      const battery = Math.max(5, (this.snapshot.battery ?? DEMO_START_BATTERY) - 1);
      this.update({ battery, lastSeenAt: new Date().toISOString() });
    }, BATTERY_TICK_MS);
  }

  restore(device: BearDevice | null) {
    if (!device) {
      if (this.batteryTimer) clearInterval(this.batteryTimer);
      this.batteryTimer = null;
      this.update({ connection: 'disconnected', playback: 'idle', battery: null, serial: null, lastSeenAt: null });
      return;
    }
    this.update({
      connection: 'connected',
      serial: device.serial,
      battery: device.lastBattery,
      lastSeenAt: new Date().toISOString(),
    });
    this.startBatterySimulation();
  }

  async connect(serial: string) {
    const run = ++this.runId;
    this.update({ connection: 'searching', serial, message: 'Looking for the Demo Bear…' });
    await wait(STEP_MS);
    if (run !== this.runId) return;
    this.update({ connection: 'pairing', message: 'Saying hello to the Demo Bear…' });
    await wait(STEP_MS);
    if (run !== this.runId) return;
    this.update({
      connection: 'connected',
      battery: this.snapshot.battery ?? DEMO_START_BATTERY,
      lastSeenAt: new Date().toISOString(),
      message: null,
    });
    haptics.success();
    this.startBatterySimulation();
  }

  async disconnect() {
    this.runId += 1;
    this.stopPlayback();
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    this.batteryTimer = null;
    this.update({ connection: 'disconnected', message: null });
  }

  setDemoBattery(battery: number) {
    this.update({ battery: Math.min(100, Math.max(5, battery)), lastSeenAt: new Date().toISOString() });
  }

  async previewReminder(recording: VoiceRecording | null) {
    const run = ++this.runId;
    voicePlayback.stop();
    this.update({ playback: 'chime', message: null });
    haptics.soft();
    // The chime is real audio through the phone speaker; the wait keeps the step visible.
    await Promise.all([voicePlayback.playChime(), wait(CHIME_MS)]);
    if (run !== this.runId) return;

    if (recording) {
      this.update({ playback: 'playing' });
      const started = await voicePlayback.play(recording);
      if (run !== this.runId) return;
      if (!started) {
        this.update({ playback: 'idle', message: voicePlayback.getSnapshot().errorMessage });
        return;
      }
      // Ends when the voice finishes or anything else on the phone takes over playback.
      await new Promise<void>((resolve) => {
        this.stopWatchingPlayback = voicePlayback.subscribe(() => {
          const { recordingId, status } = voicePlayback.getSnapshot();
          if (recordingId !== recording.id || status === 'idle' || status === 'error') resolve();
        });
      });
      this.stopWatchingPlayback?.();
      this.stopWatchingPlayback = null;
      if (run !== this.runId) return;
    }

    this.update({ playback: 'awaiting_confirmation' });
    await wait(AWAIT_CONFIRMATION_MS);
    if (run !== this.runId) return;
    this.update({ playback: 'idle' });
  }

  stopPlayback() {
    this.runId += 1;
    this.stopWatchingPlayback?.();
    this.stopWatchingPlayback = null;
    voicePlayback.stop();
    this.update({ playback: 'idle' });
  }
}
