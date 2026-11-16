/**
 * Offline dose memory for the bear simulator (tasks B10, S7). When the bear
 * has no connection it decides locally — using the doses it cached from the
 * last /state response and the same window rules as the server — whether a
 * hold should be queued for sync. The server re-validates every queued hold.
 */
import type { BearDoseDTO } from "./contracts/bear";
import { computeWindows, type DoseStatus, HOLD_MIN_MS, positionInWindow } from "./dose-rules";

export interface QueuedHold {
  clientEventId: string;
  holdMs: number;
  heldAt: string;
  doseId: string;
  label: string;
  scheduledFor: string;
}

export type OfflineDecision =
  | { kind: "queue"; dose: BearDoseDTO; late: boolean }
  | { kind: "reject"; reason: "TOO_SHORT" | "OUTSIDE_WINDOW" | "ALREADY_LOGGED" | "AWAY"; dose?: BearDoseDTO };

const windowsOf = (d: BearDoseDTO) => {
  const scheduledFor = new Date(d.scheduledFor);
  const windowMin = (scheduledFor.getTime() - new Date(d.windowStart).getTime()) / 60_000;
  const lateMin = (new Date(d.lateEnd).getTime() - new Date(d.onTimeEnd).getTime()) / 60_000;
  return computeWindows(scheduledFor, windowMin, lateMin);
};

export function decideOffline(input: {
  doses: BearDoseDTO[];
  queued: QueuedHold[];
  holdMs: number;
  now: Date;
  away: boolean;
}): OfflineDecision {
  if (input.holdMs < HOLD_MIN_MS) return { kind: "reject", reason: "TOO_SHORT" };
  if (input.away) return { kind: "reject", reason: "AWAY" };
  const containing = input.doses
    .map((d) => ({ d, pos: positionInWindow(windowsOf(d), input.now) }))
    .filter((x) => x.pos === "ON_TIME" || x.pos === "LATE");
  if (containing.length === 0) return { kind: "reject", reason: "OUTSIDE_WINDOW" };
  const open = containing.find(
    (x) =>
      (["UPCOMING", "REMINDED", "MISSED"] as DoseStatus[]).includes(x.d.status) &&
      !input.queued.some((q) => q.doseId === x.d.doseId),
  );
  if (!open) return { kind: "reject", reason: "ALREADY_LOGGED", dose: containing[0].d };
  return { kind: "queue", dose: open.d, late: open.pos === "LATE" };
}

/** Random id that also works outside secure contexts (http on a LAN). */
export function newClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
