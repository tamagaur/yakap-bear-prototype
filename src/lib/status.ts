import type { AttemptReasonT, DoseStatusT, LoggedByT } from "./contracts/common";

/** Dose status labels + design tokens (used by the bear, clinic and family UI). */
export const STATUS_META: Record<DoseStatusT, { label: string; short: string; tone: Tone }> = {
  TAKEN: { label: "Taken on time", short: "Taken", tone: "taken" },
  LATE: { label: "Taken late", short: "Late", tone: "late" },
  MISSED: { label: "Missed", short: "Missed", tone: "missed" },
  AWAY: { label: "Away (excused)", short: "Away", tone: "away" },
  UPCOMING: { label: "Upcoming", short: "Upcoming", tone: "upcoming" },
  REMINDED: { label: "Reminder played", short: "Reminded", tone: "upcoming" },
};

export type Tone = "taken" | "late" | "missed" | "away" | "upcoming" | "neutral";

/** Tailwind classes per tone (pill background / text / dot). */
export const TONE_CLASSES: Record<Tone, { pill: string; dot: string; solid: string }> = {
  taken: { pill: "bg-taken-soft text-taken-ink", dot: "bg-taken", solid: "bg-taken" },
  late: { pill: "bg-late-soft text-late-ink", dot: "bg-late", solid: "bg-late" },
  missed: { pill: "bg-missed-soft text-missed-ink", dot: "bg-missed", solid: "bg-missed" },
  away: { pill: "bg-away-soft text-away-ink", dot: "bg-away", solid: "bg-away" },
  upcoming: { pill: "bg-upcoming-soft text-upcoming-ink", dot: "bg-upcoming", solid: "bg-upcoming" },
  neutral: { pill: "bg-cream-200 text-cocoa-700", dot: "bg-cocoa-300", solid: "bg-cocoa-300" },
};

export const LOGGED_BY_LABEL: Record<LoggedByT, string> = {
  BEAR: "Bear (paw hold)",
  OFFLINE_SYNC: "Bear (synced after offline)",
  FAMILY: "Family correction",
};

export const REASON_LABEL: Record<AttemptReasonT, string> = {
  TOO_SHORT: "shorter than 3 seconds",
  OUTSIDE_WINDOW: "not inside a dose window",
  ALREADY_LOGGED: "this dose time is already recorded",
  AWAY: "away mode is on",
};
