"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { BearMood, LedColor } from "@/components/bear/bear-figure";
import { ApiClientError, apiFetch, errorMessage, fetcher } from "@/lib/api-client";
import { playSound, playVoice, unlockAudio } from "@/lib/bear-audio";
import { decideOffline, newClientEventId, type QueuedHold } from "@/lib/bear-offline";
import type { BearDoseDTO, BearStateDTO, HeartbeatResultDTO, HoldResultDTO, ReminderResultDTO, SyncResultDTO } from "@/lib/contracts/bear";
import type { AttemptReasonT } from "@/lib/contracts/common";
import type { ClockAction, ClockActionResultDTO, DemoDeviceDTO } from "@/lib/contracts/demo";
import { LOW_BATTERY_PCT } from "@/lib/dose-rules";
import { REASON_LABEL } from "@/lib/status";
import { formatTime } from "@/lib/time";

export type ConsoleKind = "ok" | "reject" | "info" | "warn" | "sync";
export interface ConsoleEntry {
  id: string;
  simAt: string | null;
  kind: ConsoleKind;
  text: string;
}
interface Feedback {
  mood: BearMood;
  /** Small label above the message, e.g. "Dose logged". */
  kicker?: string;
  text: string;
  sub?: string;
  flash?: "success" | "reject";
  until: number;
}
type AudioMode = "locked" | "on" | "muted";
type Connection = "online" | "offline" | "error";

const QUEUE_KEY = (id: string) => `yakap-bear-queue-${id}`;
const STATE_KEY = (id: string) => `yakap-bear-state-${id}`;
const DEVICE_KEY = "yakap-bear-device";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable — queue lives in memory only */
  }
}

const REJECT_TEXT: Record<AttemptReasonT, (next?: string) => { kicker: string; text: string; sub?: string }> = {
  TOO_SHORT: () => ({ kicker: "Not logged yet", text: "Almost there!", sub: "Hold my paw for 3 whole seconds." }),
  OUTSIDE_WINDOW: (next) => ({
    kicker: "Not dose time",
    text: "It's not dose time right now.",
    sub: next ? `Your next dose is at ${next}.` : undefined,
  }),
  ALREADY_LOGGED: () => ({
    kicker: "One check-in per dose",
    text: "Already recorded",
    sub: "One hold per dose time is enough, even with several pills.",
  }),
  AWAY: () => ({ kicker: "Away mode", text: "Away mode is on. I'm not recording doses right now." }),
};

/** First name of whoever recorded a voice message, or null for the sample chime. */
function recordedBy(v: BearDoseDTO["voice"]) {
  return v && !v.isSample && v.recordedByName ? v.recordedByName.split(" ")[0] : null;
}

export function useBearDevice(opts: { startOffline?: boolean } = {}) {
  const { mutate: globalMutate } = useSWRConfig();
  const [selectedId, setSelectedId] = useState("BEAR-0001");
  const [queue, setQueue] = useState<QueuedHold[]>([]);
  const [cached, setCached] = useState<{ state: BearStateDTO; fetchedAt: number } | null>(null);
  const [battery, setBattery] = useState<number | null>(null);

  // Per-device offline memory (queue + last known schedule) survives reloads.
  const loadMemory = useCallback((id: string) => {
    setQueue(readJSON<QueuedHold[]>(QUEUE_KEY(id), []));
    setCached(readJSON(STATE_KEY(id), null));
    setBattery(null);
  }, []);
  const restored = useRef(false);
  const { data: devData, error: devError, isLoading: devLoading } = useSWR<{ devices: DemoDeviceDTO[] }>(
    "/api/demo/devices",
    fetcher,
    {
      revalidateOnFocus: false,
      onSuccess: (d) => {
        if (restored.current) return;
        restored.current = true;
        const stored = readJSON(DEVICE_KEY, "BEAR-0001");
        const id = d.devices.some((x) => x.id === stored) ? stored : d.devices[0]?.id;
        if (id) {
          setSelectedId(id);
          loadMemory(id);
        }
      },
    },
  );
  const devices = useMemo(() => devData?.devices ?? [], [devData]);
  const device = devices.find((d) => d.id === selectedId) ?? devices[0] ?? null;
  const headers = useMemo(() => (device ? { "x-bear-key": device.deviceKey } : undefined), [device]);

  const [online, setOnline] = useState(true);
  // Offline scenario: connect once so the bear knows its schedule, then drop Wi-Fi.
  const offlineAfterSync = useRef(!!opts.startOffline);
  const [audio, setAudio] = useState<AudioMode>("locked");
  const [speaking, setSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [log, setLog] = useState<ConsoleEntry[]>([]);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deviceId = device?.id ?? null;
  useEffect(() => {
    if (deviceId) writeJSON(QUEUE_KEY(deviceId), queue);
  }, [queue, deviceId]);

  const stateUrl = device && online ? `/api/bear/${device.id}/state` : null;
  const { data: live, error: liveError, mutate } = useSWR<BearStateDTO>(
    stateUrl,
    (url: string) => apiFetch<BearStateDTO>(url, { headers }),
    {
      refreshInterval: 2000,
      dedupingInterval: 800,
      revalidateOnFocus: true,
      onSuccess: (s) => {
        const c = { state: s, fetchedAt: Date.now() };
        setCached(c);
        writeJSON(STATE_KEY(s.device.id), c);
        // Battery starts from the server value, then the presenter controls it.
        setBattery((b) => b ?? s.device.batteryPct);
        if (offlineAfterSync.current) {
          offlineAfterSync.current = false;
          setOnline(false);
          setLog((l) =>
            [
              {
                id: newClientEventId(),
                simAt: s.now,
                kind: "warn" as const,
                text: "Offline scenario: Wi-Fi switched off. The bear now works from its memory.",
              },
              ...l,
            ].slice(0, 80),
          );
        }
      },
    },
  );

  const connection: Connection = !online ? "offline" : liveError ? "error" : "online";
  const state = cached?.state ?? null;
  const simNow = useMemo(
    () => (cached ? new Date(new Date(cached.state.now).getTime() + (tick - cached.fetchedAt)) : null),
    [cached, tick],
  );
  const nickname = state?.patient.nickname ?? device?.patientNickname ?? "friend";

  // Latest values for async callbacks.
  const refs = useRef({ state, simNow, queue, connection, nickname, battery });
  useEffect(() => {
    refs.current = { state, simNow, queue, connection, nickname, battery };
  });

  const addLog = useCallback((kind: ConsoleKind, text: string, simAt?: string) => {
    setLog((l) =>
      [{ id: newClientEventId(), simAt: simAt ?? refs.current.simNow?.toISOString() ?? null, kind, text }, ...l].slice(0, 80),
    );
  }, []);

  const show = useCallback((f: Omit<Feedback, "until">, ms = 4500) => {
    setFeedback({ ...f, until: Date.now() + ms });
    if (f.mood === "ignored") setShakeKey((k) => k + 1);
  }, []);

  // Pairing message
  const pairedFor = useRef<string | null>(null);
  useEffect(() => {
    if (device && pairedFor.current !== device.id) {
      pairedFor.current = device.id;
      writeJSON(DEVICE_KEY, device.id);
      addLog("info", `Paired with ${device.id} (${device.patientNickname}) — demo mode`);
    }
  }, [device, addLog]);

  const sendHeartbeat = useCallback(
    async (pct: number) => {
      if (!device || refs.current.connection === "offline") return;
      try {
        const r = await apiFetch<HeartbeatResultDTO>(`/api/bear/${device.id}/heartbeat`, {
          json: { batteryPct: pct },
          headers,
        });
        if (r.alertCreated) addLog("warn", `Battery ${pct}% → low-battery alert sent to the family app`);
      } catch (e) {
        addLog("warn", `Heartbeat failed: ${errorMessage(e)}`);
      }
    },
    [device, headers, addLog],
  );
  useEffect(() => {
    if (battery === null || !online) return;
    const t = setTimeout(() => sendHeartbeat(battery), 450);
    return () => clearTimeout(t);
  }, [battery, online, sendHeartbeat]);
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => {
      if (refs.current.battery !== null) sendHeartbeat(refs.current.battery);
    }, 15_000);
    return () => clearInterval(id);
  }, [online, sendHeartbeat]);
  const prevBattery = useRef<number | null>(null);
  useEffect(() => {
    if (battery === null) return;
    const prev = prevBattery.current;
    prevBattery.current = battery;
    if (prev !== null && prev > LOW_BATTERY_PCT && battery <= LOW_BATTERY_PCT) {
      playSound("lowBattery");
      show({
        mood: "sleepy",
        kicker: "Low battery",
        text: "Battery low. Please charge me",
        sub: "Battery is low. Please plug me in tonight. The family app has been told.",
      });
    }
  }, [battery, show]);

  // Voice playback
  const speak = useCallback(
    async (voiceId: string | null) => {
      if (!device) return;
      if (!voiceId) {
        setSpeaking(true);
        playSound("chime");
        setTimeout(() => setSpeaking(false), 1600);
        return;
      }
      let url: string | null = null;
      try {
        const res = await fetch(`/api/voice/${voiceId}/audio`, {
          headers: { "x-bear-key": device.deviceKey, "x-bear-device": device.id },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`audio request failed (${res.status})`);
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        await playVoice(url, () => setSpeaking(true));
      } catch (e) {
        addLog("warn", `Couldn't play the recording (${errorMessage(e)}) — played the bear's chime instead.`);
        playSound("chime");
      } finally {
        setSpeaking(false);
        if (url) URL.revokeObjectURL(url);
      }
    },
    [device, addLog],
  );

  // Reminders — the server decides (20 s apart, max 3, stops once logged).
  const claiming = useRef(false);
  useEffect(() => {
    if (!device || !online || !live?.reminderDue || !live.activeDose || audio === "locked" || claiming.current) return;
    claiming.current = true;
    const dose = live.activeDose;
    (async () => {
      try {
        const r = await apiFetch<ReminderResultDTO>(`/api/bear/${device.id}/reminder`, {
          json: { doseId: dose.doseId },
          headers,
        });
        if (!r.play) return;
        const v = dose.voice;
        const what = !v
          ? "the bear's chime (no family recording yet)"
          : v.isSample
            ? "the sample chime"
            : `${v.recordedByName ?? "the family"}'s message “${v.title}”`;
        addLog("info", `Reminder ${r.reminderCount} of 3 for the ${formatTime(dose.scheduledFor)} dose — playing ${what}`, live.now);
        if (audio === "on") await speak(r.voiceId);
      } catch (e) {
        addLog("warn", `Reminder failed: ${errorMessage(e)}`);
      } finally {
        claiming.current = false;
        mutate();
      }
    })();
  }, [live, audio, online, device, headers, speak, addLog, mutate]);

  // Holds
  const onHoldResult = useCallback(
    (r: HoldResultDTO) => {
      const secs = (r.holdMs / 1000).toFixed(1);
      const when = r.scheduledFor ? formatTime(r.scheduledFor) : null;
      const nick = refs.current.nickname;
      if (r.accepted) {
        addLog(
          r.duplicate ? "info" : "ok",
          `${secs} s hold → ${r.duplicate ? "Already recorded" : "Accepted"}: ${r.status}${when ? ` (${when} dose)` : ""}`,
        );
        playSound("success");
        const label = refs.current.state?.doses.find((d) => d.doseId === r.doseId)?.label.toLowerCase() ?? when ?? "";
        show({
          mood: "happy",
          flash: "success",
          kicker: r.duplicate ? "One check-in per dose" : "Dose logged",
          text: `Salamat, ${nick}!`,
          sub:
            r.status === "LATE"
              ? `Your ${label} dose was logged as taken late.`
              : `Your ${label} dose was logged on time.`,
        });
      } else {
        const reason = (r.reason ?? "OUTSIDE_WINDOW") as AttemptReasonT;
        addLog("reject", `${secs} s hold → Rejected: ${reason} (${REASON_LABEL[reason]})`);
        playSound("ignored");
        const next = refs.current.state?.nextDose;
        show({ mood: "ignored", flash: "reject", ...REJECT_TEXT[reason](next ? formatTime(next.scheduledFor) : undefined) });
      }
    },
    [addLog, show],
  );

  const handleOffline = useCallback(
    (clientEventId: string, holdMs: number) => {
      const { state: st, simNow: now, queue: q, nickname: nick } = refs.current;
      const secs = (holdMs / 1000).toFixed(1);
      if (!st || !now) {
        addLog("warn", `${secs} s hold → can't check the schedule yet (connect the bear once first)`);
        return;
      }
      const d = decideOffline({ doses: st.doses, queued: q, holdMs, now, away: st.away });
      if (d.kind === "queue") {
        setQueue((cur) => [
          ...cur,
          {
            clientEventId,
            holdMs,
            heldAt: now.toISOString(),
            doseId: d.dose.doseId,
            label: d.dose.label,
            scheduledFor: d.dose.scheduledFor,
          },
        ]);
        addLog("sync", `${secs} s hold → Saved on the bear (offline) for the ${formatTime(d.dose.scheduledFor)} dose — will sync on reconnect`);
        playSound("success");
        show({
          mood: "happy",
          flash: "success",
          kicker: "Saved offline",
          text: "Saved safely in my memory",
          sub: `I'll send this check-in when Wi-Fi returns, ${nick}.`,
        });
      } else {
        addLog("reject", `${secs} s hold → Ignored offline: ${d.reason} (${REASON_LABEL[d.reason]})`);
        playSound("ignored");
        const next = st.nextDose;
        show({ mood: "ignored", flash: "reject", ...REJECT_TEXT[d.reason](next ? formatTime(next.scheduledFor) : undefined) });
      }
    },
    [addLog, show],
  );

  const submitHold = useCallback(
    async (holdMs: number) => {
      if (!device || holdMs < 120) return; // a brush, not a squeeze
      const clientEventId = newClientEventId();
      if (refs.current.connection !== "online") {
        handleOffline(clientEventId, holdMs);
        return;
      }
      try {
        const r = await apiFetch<HoldResultDTO>(`/api/bear/${device.id}/hold`, { json: { clientEventId, holdMs }, headers });
        onHoldResult(r);
        mutate();
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 0 || e.status >= 500)) {
          addLog("warn", "Server unreachable — the bear handled this hold offline.");
          handleOffline(clientEventId, holdMs);
        } else {
          addLog("warn", `Hold failed: ${errorMessage(e)}`);
        }
      }
    },
    [device, headers, onHoldResult, handleOffline, addLog, mutate],
  );

  // Sync queued holds when the connection is back.
  const syncing = useRef(false);
  useEffect(() => {
    if (connection !== "online" || !device || queue.length === 0 || syncing.current) return;
    syncing.current = true;
    const batch = queue;
    addLog("sync", `Back online — syncing ${batch.length} saved hold${batch.length > 1 ? "s" : ""}…`);
    apiFetch<SyncResultDTO>(`/api/bear/${device.id}/sync`, {
      json: { events: batch.map(({ clientEventId, holdMs, heldAt }) => ({ clientEventId, holdMs, heldAt })) },
      headers,
    })
      .then((r) => {
        for (const res of r.results) {
          const when = formatTime(res.heldAt);
          addLog(
            res.accepted ? "ok" : "reject",
            `Synced hold from ${when} → ${res.duplicate ? "duplicate skipped" : res.accepted ? `Accepted: ${res.status}` : `Rejected: ${res.reason}`}${res.resolvedMissed ? " — missed-dose alert resolved" : ""}`,
          );
        }
        const done = new Set(r.results.map((x) => x.clientEventId));
        setQueue((cur) => cur.filter((x) => !done.has(x.clientEventId)));
        playSound("sync");
        show({
          mood: "happy",
          kicker: "Back online",
          text: "Your saved check-ins are synced.",
          sub: "No duplicates: each hold is sent once.",
        });
        mutate();
      })
      .catch((e) => addLog("warn", `Sync failed, will retry: ${errorMessage(e)}`))
      .finally(() => {
        syncing.current = false;
      });
  }, [connection, device, queue, headers, addLog, show, mutate, live]);

  const turnOn = useCallback(async () => {
    const ok = await unlockAudio();
    setAudio(ok ? "on" : "muted");
    addLog(ok ? "info" : "warn", ok ? "Bear turned on — sound enabled" : "Sound couldn't be enabled in this browser — continuing silently");
    if (ok) playSound("success");
  }, [addLog]);

  const clockAction = useCallback(
    async (action: ClockAction) => {
      try {
        const r = await apiFetch<ClockActionResultDTO>("/api/demo/clock", { json: action });
        addLog("info", `Demo clock: ${r.message}`);
        await Promise.all([mutate(), globalMutate("/api/demo/clock")]);
        if (refs.current.connection !== "online") {
          addLog("warn", "The bear is offline, so it keeps its own clock until it reconnects.");
        }
      } catch (e) {
        addLog("warn", errorMessage(e));
      }
    },
    [addLog, mutate, globalMutate],
  );

  /** "Before dose": rebuild the demo data and put the clock back at 7:45 PM. */
  const resetDemo = useCallback(async () => {
    try {
      await apiFetch("/api/demo/reset", { json: {} });
      setQueue([]);
      setBattery(null);
      setFeedback(null);
      addLog("info", "Demo reset: clock back to 7:45 PM, before the evening dose");
      await Promise.all([mutate(), globalMutate("/api/demo/clock")]);
    } catch (e) {
      addLog("warn", errorMessage(e));
    }
  }, [addLog, mutate, globalMutate]);

  const selectDevice = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadMemory(id);
    },
    [loadMemory],
  );

  const toggleOnline = useCallback(
    (v: boolean) => {
      setOnline(v);
      addLog(v ? "info" : "warn", v ? "Wi-Fi reconnected" : "Wi-Fi off — the bear now works from its offline memory");
    },
    [addLog],
  );

  // What the bear shows right now.
  const view = useMemo(() => {
    const low = battery !== null && battery <= LOW_BATTERY_PCT;
    const active = state?.activeDose ?? null;
    const open = !!active && (active.status === "UPCOMING" || active.status === "REMINDED");
    const due = open && !!simNow && simNow >= new Date(active!.scheduledFor);
    const led: LedColor = connection !== "online" ? "gray" : low ? "amber" : due ? "blue" : "green";
    let mood: BearMood = "idle";
    let bubble = "Waking up…";
    let sub: string | undefined;
    let kicker: string | undefined;
    if (feedback && feedback.until > tick) {
      return {
        led: feedback.flash === "success" && connection === "online" && !low ? ("green" as LedColor) : led,
        mood: feedback.mood,
        kicker: feedback.kicker,
        bubble: feedback.text,
        sub: feedback.sub,
        flash: feedback.flash ?? null,
        due,
      };
    }
    if (state) {
      const next = state.nextDose;
      if (state.away) {
        mood = "sleepy";
        bubble = "Away mode is on — no reminders until you're back.";
      } else if (due) {
        mood = "reminder";
        const v = active!.voice;
        const who = recordedBy(v);
        kicker = speaking ? (who ? `${who}'s voice is playing` : "Reminder chime is playing") : "Dose time";
        bubble =
          v && !v.isSample ? `“${v.title}”` : `${nickname}, it's time for your ${formatTime(active!.scheduledFor)} medicine.`;
        sub = "Press and hold my paw after taking the dose.";
      } else if (open) {
        kicker = "Dose window open";
        bubble = `Your ${formatTime(active!.scheduledFor)} dose can be logged now.`;
        sub = "A gentle 3-second hold logs this dose.";
      } else if (active && (active.status === "TAKEN" || active.status === "LATE")) {
        kicker = "One check-in per dose";
        bubble = "Already recorded";
        sub = `This dose was logged at ${formatTime(active.takenAt ?? active.scheduledFor)}. One check-in per dose.`;
      } else if (next) {
        const who = recordedBy(next.voice);
        bubble = `Next reminder at ${formatTime(next.scheduledFor)}`;
        sub = who ? `I'll light up and play ${who}'s message.` : "I'll light up and play the reminder chime.";
      } else {
        bubble = `Hi ${nickname}! No doses scheduled yet.`;
      }
      if (connection !== "online") {
        kicker = "Offline";
        sub = open ? "I'm offline, but I still remember this dose." : "I'm offline. I'll keep check-ins safe until Wi-Fi returns.";
      } else if (low && !state.away) {
        if (!open) {
          mood = "sleepy";
          kicker = "Low battery";
          bubble = "Battery low. Please charge me";
        }
        sub = "Battery is low. Please plug me in tonight.";
      }
    }
    return { led, mood, kicker, bubble, sub, flash: null as Feedback["flash"] | null, due };
  }, [state, simNow, connection, battery, feedback, tick, nickname, speaking]);

  return {
    devices,
    devLoading,
    devError,
    device,
    selectDevice,
    state,
    simNow,
    connection,
    liveError,
    online,
    setOnline: toggleOnline,
    audio,
    turnOn,
    continueMuted: () => {
      setAudio("muted");
      addLog("info", "Continuing without sound — reminders are shown on screen only");
    },
    battery,
    setBattery,
    speaking,
    log,
    clearLog: () => setLog([]),
    queue,
    submitHold,
    clockAction,
    resetDemo,
    view,
    shakeKey,
  };
}
