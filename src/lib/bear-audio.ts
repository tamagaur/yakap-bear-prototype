"use client";

/**
 * Bear sounds (task S1/S4). Short tones are synthesized with the Web Audio
 * API (no audio files to license). Family voice messages play through one
 * shared <audio> element that is unlocked by the "Turn on bear" tap —
 * browsers block sound until the user interacts with the page.
 */
let ctx: AudioContext | null = null;
let voiceEl: HTMLAudioElement | null = null;

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function audioSupported(): boolean {
  return typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
}

/** Must be called from a user gesture (click/tap). */
export async function unlockAudio(): Promise<boolean> {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") await ctx.resume();
    voiceEl ??= new Audio();
    voiceEl.src = SILENT_WAV;
    await voiceEl.play().catch(() => undefined);
    return ctx.state === "running";
  } catch {
    return false;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export type BearSound = "success" | "ignored" | "lowBattery" | "chime" | "sync";

export function playSound(kind: BearSound) {
  if (!ctx || ctx.state !== "running") return;
  switch (kind) {
    case "success":
      tone(659.25, 0, 0.35);
      tone(880, 0.12, 0.45);
      tone(1318.5, 0.24, 0.6, "sine", 0.12);
      break;
    case "ignored":
      tone(392, 0, 0.18, "triangle", 0.12);
      tone(330, 0.16, 0.28, "triangle", 0.12);
      break;
    case "lowBattery":
      tone(880, 0, 0.12, "square", 0.06);
      tone(880, 0.22, 0.12, "square", 0.06);
      tone(660, 0.44, 0.3, "square", 0.06);
      break;
    case "sync":
      tone(523.25, 0, 0.2);
      tone(783.99, 0.1, 0.3);
      break;
    case "chime":
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.28, 0.9, "sine", 0.14));
      break;
  }
}

/** Plays a recorded voice message (object URL). Resolves when it ends. */
export function playVoice(url: string, onStart?: () => void): Promise<void> {
  voiceEl ??= new Audio();
  const el = voiceEl;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      el.onended = null;
      el.onerror = null;
    };
    el.onended = () => {
      cleanup();
      resolve();
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("This browser couldn't play the recording."));
    };
    el.src = url;
    el.play().then(() => onStart?.(), (e) => {
      cleanup();
      reject(e instanceof Error ? e : new Error("Playback was blocked."));
    });
  });
}

export function stopVoice() {
  if (voiceEl) {
    voiceEl.pause();
    voiceEl.currentTime = 0;
  }
}
