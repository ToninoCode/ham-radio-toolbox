import { INTL_LOCALES, DEFAULT_LOCALE } from "./catalogs";

const intlLocale = INTL_LOCALES[DEFAULT_LOCALE];

const utcTimeFormat = new Intl.DateTimeFormat(intlLocale, {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const utcDateFormat = new Intl.DateTimeFormat(intlLocale, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** `13:21:05`: time of day in UTC, 24-hour clock (NFR-I18N-02). */
export function formatUtcTime(date: Date): string {
  return utcTimeFormat.format(date);
}

/** `sabato 17 ottobre 2026`: calendar date in UTC. */
export function formatUtcDate(date: Date): string {
  return utcDateFormat.format(date);
}

/** `2026-10-17T13:21:05Z`: machine-readable UTC timestamp (e.g. `<time datetime>`). */
export function toIsoUtcSeconds(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}
