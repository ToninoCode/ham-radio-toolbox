import { INTL_LOCALES, DEFAULT_LOCALE } from "./catalogs";
import { t } from "./use-i18n";

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

const decimalFormat = new Intl.NumberFormat(intlLocale, {
  maximumFractionDigits: 1,
});

const percentFormat = new Intl.NumberFormat(intlLocale, {
  style: "percent",
  maximumFractionDigits: 1,
});

const utcShortDateFormat = new Intl.DateTimeFormat(intlLocale, {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const utcShortTimeFormat = new Intl.DateTimeFormat(intlLocale, {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const BINARY_UNITS = ["kib", "mib", "gib"] as const;

/**
 * Size in binary (IEC) units: `512 B`, `1,5 KiB`, `100 MiB`. 1 MiB =
 * 1 048 576 bytes, about 1,05 MB: the backup limit is 100 MiB.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return t("format.bytes", { value: Math.max(0, Math.round(bytes || 0)) });
  }
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BINARY_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return t(`format.${BINARY_UNITS[unit] ?? "gib"}`, {
    value: decimalFormat.format(value),
  });
}

/** `42,5 %` from a ratio between 0 and 1. */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}

/** `24 ottobre 2026, 13:21 UTC` from an ISO 8601 UTC instant. */
export function formatUtcDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return t("format.utcDateTime", {
    date: utcShortDateFormat.format(date),
    time: utcShortTimeFormat.format(date),
  });
}
