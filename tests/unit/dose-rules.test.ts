import { describe, expect, it } from "vitest";
import {
  classifyHold,
  computeWindows,
  type DoseStatus,
  HOLD_MIN_MS,
  isWithinAway,
  positionInWindow,
  reminderDue,
  shouldMarkMissed,
  slotsForRange,
  summarizeAdherence,
} from "@/lib/dose-rules";
import { fromManila } from "@/lib/time";

const DAY = "2026-11-16";
const at = (hhmm: string, extraMs = 0) => new Date(fromManila(DAY, hhmm).getTime() + extraMs);
const dose8pm = computeWindows(at("20:00"), 30, 60);
const candidate = (status: DoseStatus = "UPCOMING", id = "d1") => ({ id, status, windows: dose8pm });
const hold = (holdMs: number, heldAt: Date, status: DoseStatus = "UPCOMING", awayActive = false) =>
  classifyHold({ holdMs, heldAt, awayActive, candidates: [candidate(status)] });

describe("dose windows (8:00 PM dose, ±30 min, +60 min late)", () => {
  it("computes window start, on-time end and late end", () => {
    expect(dose8pm.windowStart).toEqual(at("19:30"));
    expect(dose8pm.onTimeEnd).toEqual(at("20:30"));
    expect(dose8pm.lateEnd).toEqual(at("21:30"));
  });

  it("classifies exact on-time boundaries as ON_TIME (inclusive)", () => {
    expect(positionInWindow(dose8pm, at("19:30", -1))).toBe("BEFORE");
    expect(positionInWindow(dose8pm, at("19:30"))).toBe("ON_TIME");
    expect(positionInWindow(dose8pm, at("20:30"))).toBe("ON_TIME");
  });

  it("classifies exact late-period boundaries", () => {
    expect(positionInWindow(dose8pm, at("20:30", 1))).toBe("LATE");
    expect(positionInWindow(dose8pm, at("21:30"))).toBe("LATE");
    expect(positionInWindow(dose8pm, at("21:30", 1))).toBe("AFTER");
  });
});

describe("accidental-squeeze filter (classifyHold)", () => {
  it("rejects a 2.99-second hold as TOO_SHORT", () => {
    expect(hold(2990, at("20:05"))).toEqual({ accepted: false, reason: "TOO_SHORT", doseId: "d1" });
    expect(hold(HOLD_MIN_MS - 1, at("20:05"))).toMatchObject({ accepted: false, reason: "TOO_SHORT" });
  });

  it("accepts a 3.00-second hold inside the on-time window as TAKEN", () => {
    expect(hold(3000, at("20:05"))).toEqual({
      accepted: true,
      doseId: "d1",
      status: "TAKEN",
      resolvesMissed: false,
    });
  });

  it("treats a non-numeric duration as too short", () => {
    expect(hold(Number.NaN, at("20:05"))).toMatchObject({ accepted: false, reason: "TOO_SHORT" });
  });

  it("applies exact on-time window boundaries", () => {
    expect(hold(3000, at("19:30"))).toMatchObject({ accepted: true, status: "TAKEN" });
    expect(hold(3000, at("20:30"))).toMatchObject({ accepted: true, status: "TAKEN" });
    expect(hold(3000, at("19:30", -1))).toMatchObject({ accepted: false, reason: "OUTSIDE_WINDOW" });
  });

  it("applies exact late-period boundaries", () => {
    expect(hold(3000, at("20:30", 1))).toMatchObject({ accepted: true, status: "LATE" });
    expect(hold(3000, at("21:30"))).toMatchObject({ accepted: true, status: "LATE" });
    expect(hold(3000, at("21:30", 1))).toMatchObject({ accepted: false, reason: "OUTSIDE_WINDOW" });
  });

  it("rejects a second hold for an already-logged dose (one log per dose time)", () => {
    expect(hold(4000, at("20:10"), "TAKEN")).toMatchObject({ accepted: false, reason: "ALREADY_LOGGED" });
    expect(hold(4000, at("21:00"), "LATE")).toMatchObject({ accepted: false, reason: "ALREADY_LOGGED" });
  });

  it("rejects holds while away mode is active", () => {
    expect(hold(4000, at("20:05"), "UPCOMING", true)).toMatchObject({ accepted: false, reason: "AWAY" });
    expect(hold(4000, at("20:05"), "AWAY")).toMatchObject({ accepted: false, reason: "AWAY" });
  });

  it("lets a delayed (offline) valid hold resolve a MISSED dose", () => {
    expect(hold(3500, at("20:10"), "MISSED")).toEqual({
      accepted: true,
      doseId: "d1",
      status: "TAKEN",
      resolvesMissed: true,
    });
    expect(hold(3500, at("21:10"), "MISSED")).toMatchObject({ status: "LATE", resolvesMissed: true });
  });

  it("picks the dose nearest to the hold when windows overlap", () => {
    const early = { id: "a", status: "UPCOMING" as const, windows: computeWindows(at("20:00"), 30, 60) };
    const later = { id: "b", status: "UPCOMING" as const, windows: computeWindows(at("21:00"), 30, 60) };
    const r = classifyHold({ holdMs: 3200, heldAt: at("20:55"), awayActive: false, candidates: [early, later] });
    expect(r).toMatchObject({ accepted: true, doseId: "b", status: "TAKEN" });
  });
});

describe("missed-dose rule", () => {
  it("is not missed at the exact end of the late period", () => {
    expect(shouldMarkMissed("UPCOMING", dose8pm, at("21:30"))).toBe(false);
  });
  it("is missed 1 ms after the late period", () => {
    expect(shouldMarkMissed("REMINDED", dose8pm, at("21:30", 1))).toBe(true);
  });
  it("never marks logged or excused doses as missed", () => {
    for (const s of ["TAKEN", "LATE", "MISSED", "AWAY"] as DoseStatus[]) {
      expect(shouldMarkMissed(s, dose8pm, at("23:00"))).toBe(false);
    }
  });
});

describe("reminder repetition (every 20 s real time, max 3)", () => {
  const real = new Date("2026-11-16T12:00:00Z");
  const base = { status: "UPCOMING" as DoseStatus, windows: dose8pm, reminderCount: 0, lastReminderAt: null, nowReal: real };
  it("waits until the dose time", () => {
    expect(reminderDue({ ...base, nowSim: at("19:59") })).toBe(false);
    expect(reminderDue({ ...base, nowSim: at("20:00") })).toBe(true);
  });
  it("repeats only after 20 seconds", () => {
    const last = new Date(real.getTime() - 19_999);
    expect(reminderDue({ ...base, reminderCount: 1, lastReminderAt: last, nowSim: at("20:01") })).toBe(false);
    const ok = new Date(real.getTime() - 20_000);
    expect(reminderDue({ ...base, reminderCount: 1, lastReminderAt: ok, nowSim: at("20:01") })).toBe(true);
  });
  it("stops after three reminders", () => {
    expect(reminderDue({ ...base, reminderCount: 3, nowSim: at("20:05") })).toBe(false);
  });
  it("stops once the dose is acknowledged or the window closed", () => {
    expect(reminderDue({ ...base, status: "TAKEN", nowSim: at("20:05") })).toBe(false);
    expect(reminderDue({ ...base, nowSim: at("21:30", 1) })).toBe(false);
  });
});

describe("dose slots — one per schedule per day, never per pill", () => {
  const schedule = {
    timeOfDay: "20:00",
    windowMinutes: 30,
    lateMinutes: 60,
    effectiveFrom: fromManila("2026-11-01"),
  };
  it("creates exactly one slot per day", () => {
    const slots = slotsForRange(schedule, "2026-11-14", "2026-11-16");
    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((s) => s.getTime())).size).toBe(3);
    expect(slots[2]).toEqual(at("20:00"));
  });
  it("skips slots that could no longer be logged when the schedule started", () => {
    const late = { ...schedule, effectiveFrom: at("21:31") };
    expect(slotsForRange(late, DAY, DAY)).toHaveLength(0);
    const inWindow = { ...schedule, effectiveFrom: at("21:00") };
    expect(slotsForRange(inWindow, DAY, DAY)).toHaveLength(1);
  });
});

describe("away periods and adherence", () => {
  const away = [{ startsAt: fromManila("2026-11-16"), endsAt: fromManila("2026-11-18") }];
  it("treats away ranges as [start, end)", () => {
    expect(isWithinAway(fromManila("2026-11-16"), away)).toBe(true);
    expect(isWithinAway(new Date(fromManila("2026-11-18").getTime() - 1), away)).toBe(true);
    expect(isWithinAway(fromManila("2026-11-18"), away)).toBe(false);
  });
  it("excludes away doses from adherence percentages", () => {
    const s = summarizeAdherence([
      { status: "TAKEN" },
      { status: "TAKEN" },
      { status: "LATE" },
      { status: "MISSED" },
      { status: "AWAY" },
      { status: "AWAY" },
    ]);
    expect(s).toMatchObject({ counted: 4, away: 2, onTimePct: 50, adherencePct: 75, total: 6 });
  });
  it("returns null percentages when only away days exist", () => {
    expect(summarizeAdherence([{ status: "AWAY" }])).toMatchObject({ counted: 0, onTimePct: null });
  });
});
