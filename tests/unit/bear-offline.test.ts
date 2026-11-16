import { describe, expect, it } from "vitest";
import { decideOffline, newClientEventId } from "@/lib/bear-offline";
import type { BearDoseDTO } from "@/lib/contracts/bear";
import { fromManila } from "@/lib/time";

const at = (hhmm: string) => fromManila("2026-11-16", hhmm);
const dose = (status: BearDoseDTO["status"] = "REMINDED"): BearDoseDTO => ({
  doseId: "d1",
  label: "Evening",
  pillNote: "3 pills",
  scheduledFor: at("20:00").toISOString(),
  windowStart: at("19:30").toISOString(),
  onTimeEnd: at("20:30").toISOString(),
  lateEnd: at("21:30").toISOString(),
  status,
  takenAt: null,
  reminderCount: 1,
  voice: null,
});

describe("bear offline dose memory (mirrors the server rules)", () => {
  const base = { doses: [dose()], queued: [], away: false };

  it("queues a valid 3-second hold inside the window", () => {
    const d = decideOffline({ ...base, holdMs: 3000, now: at("20:05") });
    expect(d).toMatchObject({ kind: "queue", late: false });
  });
  it("marks a hold in the late period as late", () => {
    expect(decideOffline({ ...base, holdMs: 3200, now: at("21:00") })).toMatchObject({ kind: "queue", late: true });
  });
  it("ignores short squeezes and holds outside the window", () => {
    expect(decideOffline({ ...base, holdMs: 2990, now: at("20:05") })).toMatchObject({ reason: "TOO_SHORT" });
    expect(decideOffline({ ...base, holdMs: 3500, now: at("18:00") })).toMatchObject({ reason: "OUTSIDE_WINDOW" });
  });
  it("never queues the same dose twice (one hold per dose time)", () => {
    const queued = [{ clientEventId: "x", holdMs: 3000, heldAt: at("20:01").toISOString(), doseId: "d1", label: "Evening", scheduledFor: dose().scheduledFor }];
    expect(decideOffline({ ...base, queued, holdMs: 3000, now: at("20:06") })).toMatchObject({ reason: "ALREADY_LOGGED" });
    expect(decideOffline({ ...base, doses: [dose("TAKEN")], holdMs: 3000, now: at("20:06") })).toMatchObject({ reason: "ALREADY_LOGGED" });
  });
  it("respects away mode", () => {
    expect(decideOffline({ ...base, away: true, holdMs: 3000, now: at("20:05") })).toMatchObject({ reason: "AWAY" });
  });
  it("generates unique client event ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newClientEventId()));
    expect(ids.size).toBe(200);
  });
});
