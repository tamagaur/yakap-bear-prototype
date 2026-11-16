/**
 * Pure dose rules (tasks B5, B6, S2, S5). No database access — used by the
 * server dose engine AND by the bear simulator for offline feedback, so both
 * sides always agree. Documented in docs/DOSE_RULES.md; tested in
 * tests/unit/dose-rules.test.ts.
 */
import { dateKeyRange, fromManila, manilaDateKey } from "./time";

export const HOLD_MIN_MS = 3000;
export const REMINDER_REPEAT_MS = 20_000;
export const MAX_REMINDERS = 3;
export const DEFAULT_WINDOW_MINUTES = 30;
export const DEFAULT_LATE_MINUTES = 60;
export const LOW_BATTERY_PCT = 20;

export type DoseStatus = "UPCOMING" | "REMINDED" | "TAKEN" | "LATE" | "MISSED" | "AWAY";
export type AttemptReason = "TOO_SHORT" | "OUTSIDE_WINDOW" | "ALREADY_LOGGED" | "AWAY";

export const OPEN_STATUSES: readonly DoseStatus[] = ["UPCOMING", "REMINDED"];
export const LOGGED_STATUSES: readonly DoseStatus[] = ["TAKEN", "LATE"];
export const FINAL_STATUSES: readonly DoseStatus[] = ["TAKEN", "LATE", "MISSED", "AWAY"];

const MIN = 60_000;

export interface DoseWindows {
  /** Window opens: scheduledFor − windowMinutes. */
  windowStart: Date;
  scheduledFor: Date;
  /** Last instant that still counts as on time: scheduledFor + windowMinutes. */
  onTimeEnd: Date;
  /** Last instant that still counts as late: onTimeEnd + lateMinutes. */
  lateEnd: Date;
}

export function computeWindows(
  scheduledFor: Date,
  windowMinutes: number,
  lateMinutes: number,
): DoseWindows {
  const t = scheduledFor.getTime();
  return {
    windowStart: new Date(t - windowMinutes * MIN),
    scheduledFor,
    onTimeEnd: new Date(t + windowMinutes * MIN),
    lateEnd: new Date(t + (windowMinutes + lateMinutes) * MIN),
  };
}

export type WindowPosition = "BEFORE" | "ON_TIME" | "LATE" | "AFTER";

/**
 * Boundaries are inclusive:
 *   [windowStart, onTimeEnd] → ON_TIME, (onTimeEnd, lateEnd] → LATE.
 */
export function positionInWindow(w: DoseWindows, at: Date): WindowPosition {
  const t = at.getTime();
  if (t < w.windowStart.getTime()) return "BEFORE";
  if (t <= w.onTimeEnd.getTime()) return "ON_TIME";
  if (t <= w.lateEnd.getTime()) return "LATE";
  return "AFTER";
}

export interface HoldCandidate {
  id: string;
  status: DoseStatus;
  windows: DoseWindows;
}

export type HoldDecision =
  | {
      accepted: true;
      doseId: string;
      status: "TAKEN" | "LATE";
      /** True when a delayed (offline) hold turns a MISSED dose into TAKEN/LATE. */
      resolvesMissed: boolean;
    }
  | { accepted: false; reason: AttemptReason; doseId?: string };

/**
 * Accidental-squeeze filter (B6). A hold counts only if it lasted ≥ 3 s,
 * away mode is off, it happened inside a dose window, and that dose has not
 * been logged yet. Check order: TOO_SHORT → AWAY → OUTSIDE_WINDOW → ALREADY_LOGGED.
 */
export function classifyHold(input: {
  holdMs: number;
  heldAt: Date;
  awayActive: boolean;
  candidates: HoldCandidate[];
}): HoldDecision {
  const { holdMs, heldAt, awayActive, candidates } = input;
  const containing = candidates
    .map((c) => ({ c, pos: positionInWindow(c.windows, heldAt) }))
    .filter((x) => x.pos === "ON_TIME" || x.pos === "LATE")
    .sort(
      (a, b) =>
        Math.abs(a.c.windows.scheduledFor.getTime() - heldAt.getTime()) -
        Math.abs(b.c.windows.scheduledFor.getTime() - heldAt.getTime()),
    );

  if (!(holdMs >= HOLD_MIN_MS)) {
    return { accepted: false, reason: "TOO_SHORT", doseId: containing[0]?.c.id };
  }
  if (awayActive) {
    return { accepted: false, reason: "AWAY", doseId: containing[0]?.c.id };
  }
  if (containing.length === 0) {
    return { accepted: false, reason: "OUTSIDE_WINDOW" };
  }
  const open = containing.find(
    (x) => OPEN_STATUSES.includes(x.c.status) || x.c.status === "MISSED",
  );
  if (!open) {
    const away = containing.find((x) => x.c.status === "AWAY");
    if (away) return { accepted: false, reason: "AWAY", doseId: away.c.id };
    return { accepted: false, reason: "ALREADY_LOGGED", doseId: containing[0].c.id };
  }
  return {
    accepted: true,
    doseId: open.c.id,
    status: open.pos === "ON_TIME" ? "TAKEN" : "LATE",
    resolvesMissed: open.c.status === "MISSED",
  };
}

/** A dose becomes MISSED once the late period has fully passed with no valid hold. */
export function shouldMarkMissed(status: DoseStatus, w: DoseWindows, now: Date): boolean {
  return OPEN_STATUSES.includes(status) && now.getTime() > w.lateEnd.getTime();
}

/**
 * Reminder rule (S4/S5): play when the dose time has arrived and the dose is
 * still open, at most MAX_REMINDERS times, at least 20 s (real time) apart.
 */
export function reminderDue(input: {
  status: DoseStatus;
  windows: DoseWindows;
  reminderCount: number;
  lastReminderAt: Date | null;
  nowSim: Date;
  nowReal: Date;
}): boolean {
  const { status, windows, reminderCount, lastReminderAt, nowSim, nowReal } = input;
  if (!OPEN_STATUSES.includes(status)) return false;
  if (nowSim.getTime() < windows.scheduledFor.getTime()) return false;
  if (nowSim.getTime() > windows.lateEnd.getTime()) return false;
  if (reminderCount >= MAX_REMINDERS) return false;
  if (lastReminderAt && nowReal.getTime() - lastReminderAt.getTime() < REMINDER_REPEAT_MS) {
    return false;
  }
  return true;
}

export interface TimeRange {
  startsAt: Date;
  endsAt: Date;
}

/** Away periods are [startsAt, endsAt). */
export function isWithinAway(at: Date, periods: TimeRange[]): boolean {
  const t = at.getTime();
  return periods.some((p) => t >= p.startsAt.getTime() && t < p.endsAt.getTime());
}

/**
 * Dose times for one schedule across a date range — exactly one per day,
 * regardless of how many pills the dose has. A slot is skipped if it could no
 * longer be logged when the schedule took effect.
 */
export function slotsForRange(
  schedule: {
    timeOfDay: string;
    windowMinutes: number;
    lateMinutes: number;
    effectiveFrom: Date;
  },
  fromKey: string,
  toKey: string,
): Date[] {
  return dateKeyRange(fromKey, toKey)
    .map((key) => fromManila(key, schedule.timeOfDay))
    .filter((slot) => {
      const w = computeWindows(slot, schedule.windowMinutes, schedule.lateMinutes);
      return w.lateEnd.getTime() > schedule.effectiveFrom.getTime();
    });
}

export interface AdherenceCounts {
  total: number;
  taken: number;
  late: number;
  missed: number;
  away: number;
  /** Doses that count towards adherence (away days excluded). */
  counted: number;
  /** % taken on time among counted doses, null when nothing counted. */
  onTimePct: number | null;
  /** % taken at all (on time + late) among counted doses. */
  adherencePct: number | null;
}

/** Adherence summary. AWAY doses are excluded from every percentage. */
export function summarizeAdherence(events: { status: DoseStatus }[]): AdherenceCounts {
  let taken = 0;
  let late = 0;
  let missed = 0;
  let away = 0;
  for (const e of events) {
    if (e.status === "TAKEN") taken++;
    else if (e.status === "LATE") late++;
    else if (e.status === "MISSED") missed++;
    else if (e.status === "AWAY") away++;
  }
  const counted = taken + late + missed;
  return {
    total: counted + away,
    taken,
    late,
    missed,
    away,
    counted,
    onTimePct: counted ? Math.round((taken / counted) * 100) : null,
    adherencePct: counted ? Math.round(((taken + late) / counted) * 100) : null,
  };
}

/** Today's Manila date key for a (simulated) instant — re-exported for convenience. */
export const dateKeyOf = manilaDateKey;
