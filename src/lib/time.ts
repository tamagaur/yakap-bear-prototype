/**
 * Time helpers. The whole app runs on Asia/Manila time (UTC+8, no DST).
 * Safe to import from both server and browser code.
 */
export const APP_TIMEZONE = "Asia/Manila";
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));
const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar parts of an instant, as seen in Manila. */
export function manilaParts(d: DateInput) {
  const m = new Date(toDate(d).getTime() + OFFSET_MS);
  return {
    year: m.getUTCFullYear(),
    month: m.getUTCMonth() + 1,
    day: m.getUTCDate(),
    hour: m.getUTCHours(),
    minute: m.getUTCMinutes(),
    second: m.getUTCSeconds(),
    weekday: m.getUTCDay(),
  };
}

/** "YYYY-MM-DD" of the Manila calendar day containing the instant. */
export function manilaDateKey(d: DateInput): string {
  const p = manilaParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" (24h) Manila wall-clock time of the instant. */
export function manilaTimeOfDay(d: DateInput): string {
  const p = manilaParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Manila weekday of the instant (0 = Sunday). */
export function manilaWeekday(d: DateInput): number {
  return manilaParts(d).weekday;
}

/** UTC instant for a Manila date key + "HH:mm" wall-clock time. */
export function fromManila(dateKey: string, timeOfDay = "00:00"): Date {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const [h, mi] = timeOfDay.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - OFFSET_MS);
}

export function addDaysToKey(dateKey: string, days: number): string {
  return manilaDateKey(fromManila(dateKey).getTime() + days * DAY_MS);
}

/** Inclusive list of date keys from `fromKey` to `toKey`. */
export function dateKeyRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  for (let i = 0; k <= toKey && i < 400; i++) {
    out.push(k);
    k = addDaysToKey(k, 1);
  }
  return out;
}

export function startOfManilaDay(d: DateInput): Date {
  return fromManila(manilaDateKey(d));
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return manilaDateKey(fromManila(key)) === key;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const longDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "8:00 PM" */
export function formatTime(d: DateInput): string {
  return timeFmt.format(toDate(d));
}
/** "Mon, Nov 16" */
export function formatDate(d: DateInput): string {
  return dateFmt.format(toDate(d));
}
/** "Monday, November 16, 2026" */
export function formatLongDate(d: DateInput): string {
  return longDateFmt.format(toDate(d));
}
/** "Nov 16, 2026" */
export function formatShortDate(d: DateInput): string {
  return shortDateFmt.format(toDate(d));
}
/** "Mon, Nov 16 · 8:00 PM" */
export function formatDateTime(d: DateInput): string {
  return `${formatDate(d)} · ${formatTime(d)}`;
}
/** "20:00" → "8:00 PM" */
export function formatTimeOfDay(timeOfDay: string): string {
  const [h, m] = timeOfDay.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}
/** Date key → "Mon, Nov 16" */
export function formatDateKey(dateKey: string): string {
  return formatDate(fromManila(dateKey, "12:00"));
}

/** "just now", "3 min ago", "2 h ago", "4 d ago" */
export function formatRelative(from: DateInput, now: DateInput = Date.now()): string {
  const diff = toDate(now).getTime() - toDate(from).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const wrap = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (abs < 45_000) return "just now";
  if (abs < 3_600_000) return wrap(`${Math.round(abs / 60_000)} min`);
  if (abs < DAY_MS) return wrap(`${Math.round(abs / 3_600_000)} h`);
  return wrap(`${Math.round(abs / DAY_MS)} d`);
}

/** Greeting based on the Manila hour of the (simulated) time. */
export function greetingFor(d: DateInput): string {
  const h = manilaParts(d).hour;
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
