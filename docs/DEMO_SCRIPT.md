# Demo script (task Q1)

Audience: classmates and panel. Length: about 8 minutes. Two laptops (or two browser windows): **A = bear**,
**B = clinic dashboard**. Optional phone for the bear (needs the HTTPS deployment for sound).

> The family app screens are on hold. Steps marked **(API)** show family-side results through the clinic view or
> the launcher instead; when the family app is built, swap them for its Home / Alerts / Messages / Consent screens.

## 0 · Before the audience arrives (presenter)

1. `npm run dev:all` (or open the deployed URL). Open `/` → **Reset demo** → clock shows **7:45 PM**.
2. Window A: `/bear` → **Turn on bear** (unlocks sound). Volume up.
3. Window B: `/` → **Sign in as Dr. Reyes** → clinic dashboard (home).

## 1 · The problem and the bear (1 min) — Window A

- "Lola Rosa, 68, takes maintenance medication twice a day. Her bear sits on the bedside table."
- Point at the **No microphone** chip, the heart light (green = connected) and the battery.
- The speech bubble says her **8:00 PM window is open**; the dose card shows *3 pills = 1 hold*.

## 2 · Reminder in a loved one's voice (1 min)

- Click **Jump to next dose** → 8:00 PM. The heart turns **blue**, the bear wiggles and plays the reminder
  (seeded sample chime; with the family app this is Ana's recorded voice).
- Console: *Reminder 1 of 3 …* — it repeats every 20 seconds up to 3 times until she holds the paw.

## 3 · Accidental squeeze vs. real check-in (1.5 min)

- **Tap** the paw quickly → bear looks puzzled: *Hold my paw for 3 whole seconds*. Console:
  `1.2 s hold → Rejected: TOO_SHORT`.
- **Hold** the paw — ring fills over 3 s → hearts, *Salamat, Lola Rosa!* Console: `Accepted: TAKEN`.
- Hold again → *Already recorded — one hold per dose time is enough* (`ALREADY_LOGGED`). "3 pills = 1 hold."

## 4 · A missed dose (1.5 min)

- Click **Jump to next dose** (tomorrow 8:00 AM). Don't touch the paw.
- Click **Jump past dose window** → 9:31 AM. Console: *Unlogged doses are now missed*.
- **(API)** The family receives a simulated SMS: *"Yakap Bear: Hi Ana, Lola Rosa's 8:00 AM dose (Morning) has not
  been logged…"* — no real SMS is sent.

## 5 · Offline memory (optional, 1 min)

- Reset, **Jump to next dose**, turn **Wi-Fi connected** off, hold the paw → *Saved on the bear*.
- **Jump past dose window** (the server marks it missed). Turn Wi-Fi back on → console: *Synced hold from
  8:00 PM → Accepted: TAKEN — missed-dose alert resolved*.
- Drag **Battery** to 15 % → amber blinking heart and *low-battery alert sent to the family app*.

## 6 · The clinician's view (2 min) — Window B

- **Dashboard** (home): this week across all consented patients — on-time %, missed doses, *Needs attention*
  (Miguel: 5 missed this week), today's doses and recent missed doses.
- **Patients** (sidebar): only families who signed **written consent** appear (Jun's family revoked consent → not listed).
- Open **Rosa Santos** → adherence cards (away days excluded), doses per day, recent doses.
- **Patterns** tab → *Most often missed: Sunday 8:00 PM* — "a conversation starter for the check-up".
- **Dose log** → filter Missed; open a **Corrected** badge to show the family's reason.
- **Export CSV / PDF** → "every export is recorded".
- Try the URL `/clinic/patients/pat_jun` → *You don't have consent to view this record*.

## 7 · Privacy and accountability (30 s)

- Sign out → sign in as `admin@yakap.demo` → admin dashboard (clinic-wide counts, no patient dose data) →
  **Audit log**: views, exports, consent given/revoked, corrections — append-only (enforced by the database).

## Who clicks what

| Step | Presenter | Driver A (bear) | Driver B (clinic) |
|---|---|---|---|
| 0 | Reset | Turn on bear | Sign in |
| 1–5 | Narrates | Paw, time skips, Wi-Fi, battery | — |
| 6–7 | Narrates | — | Patient detail, exports, admin |

## If something fails

- No sound → "Continue without sound"; reminders still show on screen.
- API down → launcher shows "The Yakap API isn't reachable" → restart `npm run dev:api` → Reset demo.
- Anything weird → **Reset demo** (5 s) and restart from step 2. Keep the backup video (Q4) ready.
