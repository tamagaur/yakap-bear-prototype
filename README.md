# Yakap Bear

**Care, in a familiar voice.**

Yakap Bear is a medication-reminder companion for older adults and the families who care for them. A caregiver schedules doses, records a loved one's voice, and keeps a clear history of what was confirmed. The app runs fully offline in Expo Go, and a simulated Demo Bear stands in for the physical teddy bear.

> Yakap Bear is a reminder aid. It does not diagnose, give medical advice, monitor emergencies, or guarantee that medication was taken. Medication schedules should follow professional instructions.

## Run it on your phone

You need [Node.js](https://nodejs.org) 20 or newer and the latest **Expo Go** app from the App Store or Google Play. This project uses **Expo SDK 58**.

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on iPhone, or from inside Expo Go on Android. Your phone and computer must be on the same Wi-Fi network.

If the phone cannot connect, use a tunnel:

```bash
npx expo start --tunnel
```

If the app shows old content, clear the cache with `npx expo start --clear`.

## Suggested presentation flow

1. Tap **Open demo care plan**, then choose one of the two paths.
   - **Set up my own care plan** walks through all six onboarding steps.
   - **Open the sample care plan** loads labeled example doses and history.
2. On **Home**, tap **Mark as taken** and watch the progress and the bear react.
3. Open **Voice**, record a message, preview it, name it, and assign it to a dose.
4. Open **Settings > Demo Bear** and tap **Preview reminder** to hear the full sequence.
5. Open **History** to see the confirmation, then use **Correct this log** to show the audit trail.
6. Close and reopen the app to show that everything was saved.

To demonstrate alerts, use the sample plan after 9:30 AM. The 8:00 AM sample dose will show as unconfirmed, and **Care alerts** can open a prepared text message.

## What works in Expo Go

| Area | Implemented |
| --- | --- |
| Accounts | Offline demo mode with a saved session. Sign-in screens are ready for Supabase. |
| Onboarding | Six animated steps with validation: profile, referral, pairing, doses, voice, contacts |
| Home | Greeting, next dose, countdown, daily progress, dose list, bear status, activity, quick actions |
| Schedule | Date selector, day and week views, add, edit, delete, and all dose statuses |
| Voice | Microphone recording up to 30 seconds, live waveform, preview, rerecord, rename, delete, assign |
| History | Monthly calendar, status markers, timeline, adherence summary, corrections with an audit trail |
| Reminders | Local notifications with follow-ups, updated whenever the schedule changes |
| Family alerts | In-app alerts and a prepared message in the phone's own SMS app |
| Settings | Profile, care circle, consent with finger signature, Away mode, Demo Bear, preferences, help |
| Storage | Care data in AsyncStorage and voice files in the app's private document folder |

## What needs a backend or hardware

These are designed for but are **not active** in this build.

| Feature | What it needs |
| --- | --- |
| Physical bear connection and audio transfer | The real device and its protocol, plus a development build |
| Real sign-in and multi-device sync | A Supabase project (see below) |
| Clinic referral verification and data sharing | A Supabase project with real clinic codes |
| Automatic texts to family | A server-side SMS provider |
| Remote push notifications | A development build and a push service |

The app labels these limits on screen. It never reports a text as delivered, a clinic as linked, or a bear as physically connected unless that has actually happened.

### Known limits of local reminders

- Reminders are scheduled up to 14 days ahead. Open the app at least once every two weeks to keep them going.
- A notification cannot play a recorded voice by itself. The voice plays when the reminder is opened, or automatically if the app is already open.
- Reminders follow the phone's clock, even if a different time zone is chosen for the care recipient.

## Optional Supabase setup

The app runs without any of this.

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_yakap_bear_schema.sql` in the SQL editor. It creates the tables, Row Level Security policies, and a private storage bucket.
3. Copy `.env.example` to `.env` and fill in your project URL and **anon** key.
4. Restart with `npx expo start --clear`.

Never put the service-role key in this project. Anything prefixed `EXPO_PUBLIC_` is bundled into the app.

The cloud code has not been tested against a live Supabase project, so test sign-in and sync before relying on them.

## Project structure

```
app/            Screens and navigation (Expo Router)
components/     Reusable UI, mascot, dose, voice, and onboarding components
constants/      Design tokens and default settings
contexts/       Confirm dialogs, toasts, and the success reaction
hooks/          Clock, recorder, reduced motion, and data hooks
lib/            Supabase client
repositories/   Storage interface with local and cloud implementations
services/       Audio, bear, notifications, SMS, auth, referrals, sample data
stores/         Application state (Zustand)
supabase/       SQL migration and security policies
types/          Data models
utils/          Scheduling, adherence, alerts, validation
__tests__/      Automated logic tests
```

To add real hardware later, implement the `BearService` interface in `services/bear/HardwareBearService.ts` and export it from `services/bear/index.ts`. Screens depend only on that interface.

## Developer commands

```bash
npm run typecheck   # TypeScript
npm test            # Scheduling, adherence, and state tests
npx expo-doctor     # Project health
```

Avoid `npm audit fix --force`. It tries to downgrade Expo to an older SDK, which stops the app from opening in Expo Go.
