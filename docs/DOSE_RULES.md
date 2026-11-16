# Dose rules (tasks B5, B6, S2, S4, S5)

Authoritative implementation: `backend/src/dose_rules.rs` (pure functions, unit-tested).
The bear simulator keeps a TypeScript mirror (`src/lib/dose-rules.ts`) only for **offline** feedback; the server
re-validates everything.

All times are **Asia/Manila** (UTC+8, no daylight saving). The app's "now" comes from the simulated demo clock.

## Windows

For a dose scheduled at `t` with on-time window `W` (default 30 min) and late period `L` (default 60 min):

| Instant | Meaning |
|---|---|
| `t − W` | window opens (holds accepted from here) |
| `t` | dose time — the bear plays the family's reminder |
| `t + W` | last instant that counts as **on time** |
| `t + W + L` | last instant that counts as **late** |
| after `t + W + L` | the dose becomes **MISSED** |

Example, 8:00 PM dose: 7:30 PM opens · 8:00 PM reminder · until 8:30 PM = TAKEN · 8:30–9:30 PM = LATE ·
after 9:30 PM = MISSED.

**Boundaries are inclusive:** a hold at exactly 7:30:00.000 or 8:30:00.000 is TAKEN; 8:30:00.001 is LATE;
exactly 9:30:00.000 is LATE; 9:30:00.001 is outside the window. A dose is marked missed only when
`now > t + W + L`.

## Statuses

`UPCOMING → REMINDED → TAKEN | LATE | MISSED | AWAY`

- `REMINDED` — the bear played at least one reminder.
- `AWAY` — inside an away period (excused; no reminders, no alerts, excluded from adherence).
- Family corrections may change TAKEN/LATE/MISSED; the event keeps `original_status`, every change is stored in
  `dose_corrections`, and an audit entry is written.

## One check-in per dose time

There is exactly **one** dose event per schedule per dose time — enforced by
`UNIQUE(schedule_id, scheduled_for)`. A schedule with "3 pills" still produces one event; a second hold for the
same dose time is rejected as `ALREADY_LOGGED`.

## Accidental-squeeze filter (paw hold)

A hold is **accepted** only when all are true:

1. duration ≥ **3,000 ms**
2. away mode is not active at the hold time
3. the hold time is inside a dose window (`[t − W, t + W + L]`)
4. that dose has not been logged yet

Otherwise it is stored in `dose_attempts` with a reason, checked in this order:
`TOO_SHORT → AWAY → OUTSIDE_WINDOW → ALREADY_LOGGED`. If windows overlap, the dose whose scheduled time is
nearest to the hold wins. Live holds use the **server** clock; offline holds use the time the hold happened.

Holds are idempotent per `clientEventId`: re-sending returns the original result with `duplicate: true`.

## Reminders

The bear asks `POST /api/bear/:id/reminder` and plays only when the server says `play: true`:

- the dose is still open and `now ≥ t` (and not past `t + W + L`)
- at most **3** reminders per dose
- at least **20 seconds of real time** apart
- stops as soon as the dose is logged

If no family voice is assigned to the dose time, the latest family recording plays; if there is none, a sample
chime plays.

## Missed doses → alert + simulated SMS

There is no background worker. Dose evaluation runs whenever the demo clock moves, the bear polls, or a family or
clinic view loads. Each run:

1. creates any missing events (7 days back → tomorrow);
2. marks open events inside active away periods as `AWAY`;
3. marks open events past `t + W + L` as `MISSED` — in a transaction guarded by
   `WHERE status IN ('UPCOMING','REMINDED')`, creating **one** alert (unique per dose) and one simulated SMS per
   family contact who opted in. Running it again never duplicates.

## Offline memory and sync

When offline, the bear keeps its last schedule and queues holds ≥ 3 s that fall in a window (locally checked) with
a unique `clientEventId` and the original `heldAt`. On reconnect it calls `POST /api/bear/:id/sync`:

- events are processed in chronological order against their **original** time;
- duplicates are skipped;
- a valid hold for a dose that became MISSED meanwhile turns it into TAKEN/LATE (`logged_by = OFFLINE_SYNC`) and
  resolves the missed-dose alert.

## Low battery

A heartbeat with battery ≤ **20 %** creates one `LOW_BATTERY` alert for the family; it re-arms after the battery
goes back above 20 % (the open alert is resolved).

## Adherence

- **On-time %** = TAKEN ÷ (TAKEN + LATE + MISSED)
- **Adherence %** = (TAKEN + LATE) ÷ (TAKEN + LATE + MISSED)
- AWAY doses are **excluded** from both.
- Weekly pattern = counts of missed/late/taken per (weekday × dose time) — simple counts, no prediction.
