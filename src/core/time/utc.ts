import {
  err,
  ok,
  type Brand,
  type DomainError,
  type Result,
} from "@/shared/types";

/**
 * Instant in UTC, ISO 8601 extended format with `Z`, to the second
 * (ADR-0005): `2026-10-17T13:21:00Z`. Fixed width, so lexicographic order
 * is chronological order (IndexedDB indexes rely on it).
 */
export type UtcDateTime = Brand<string, "UtcDateTime">;

/** Calendar date without time, `YYYY-MM-DD` (ADR-0005). */
export type UtcDate = Brand<string, "UtcDate">;

export type TimeErrorCode =
  | "time.invalid-format"
  | "time.missing-offset"
  | "time.invalid-date"
  | "time.invalid-time"
  | "time.invalid-offset"
  | "time.out-of-range";

export type TimeError = DomainError<TimeErrorCode>;

/**
 * Supported years. Four-digit years only, which keeps the format fixed-width
 * and avoids the two-digit-year mapping of `Date.UTC`.
 */
export const MIN_YEAR = 1000;
export const MAX_YEAR = 9999;

/** Minutes in a day; 1440 is the "end of day" bound of schedules. */
export const MINUTES_PER_DAY = 1440;
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;

const UTC_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const UTC_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?(?:([Zz])|([+-])(\d{2})(?::?(\d{2}))?)?$/;
const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const COMPACT_TIME = /^(\d{2})(\d{2})(\d{2})?$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function checkDate(
  year: number,
  month: number,
  day: number,
): TimeError | undefined {
  if (year < MIN_YEAR || year > MAX_YEAR) return { code: "time.out-of-range" };
  if (month < 1 || month > 12) return { code: "time.invalid-date" };
  if (day < 1 || day > daysInMonth(year, month)) {
    return { code: "time.invalid-date" };
  }
  return undefined;
}

/** Leap seconds (:60) are rejected: JavaScript time cannot represent them. */
function checkTime(
  hour: number,
  minute: number,
  second: number,
): TimeError | undefined {
  if (hour > 23 || minute > 59 || second > 59) {
    return { code: "time.invalid-time" };
  }
  return undefined;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** Formats epoch milliseconds, truncated to the second, as `UtcDateTime`. */
function format(ms: number): Result<UtcDateTime, TimeError> {
  const date = new Date(Math.floor(ms / MS_PER_SECOND) * MS_PER_SECOND);
  const year = date.getUTCFullYear();
  if (Number.isNaN(year)) return err({ code: "time.out-of-range" });
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return err({ code: "time.out-of-range" });
  }
  return ok(`${date.toISOString().slice(0, 19)}Z` as UtcDateTime);
}

/** True for a valid, normalised `YYYY-MM-DDTHH:MM:SSZ` string. */
export function isUtcDateTime(value: unknown): value is UtcDateTime {
  if (typeof value !== "string") return false;
  const m = UTC_DATE_TIME.exec(value);
  if (!m) return false;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return !checkDate(y, mo, d) && !checkTime(h, mi, s);
}

/** True for a valid `YYYY-MM-DD` calendar date. */
export function isUtcDate(value: unknown): value is UtcDate {
  if (typeof value !== "string") return false;
  const m = UTC_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number) as [number, number, number];
  return !checkDate(y, mo, d);
}

/**
 * Parses an ISO 8601 / RFC 3339 date-time with an explicit offset and
 * normalises it to `UtcDateTime`:
 * - `Z`, `±HH:MM`, `±HHMM` or `±HH` offsets (from -12:00 to +14:00);
 * - `T`, `t` or a space between date and time; seconds optional;
 * - fractional seconds are truncated (13:21:59.9 → 13:21:59).
 *
 * A date-time without offset is rejected (`time.missing-offset`): it would
 * be local time of an unknown zone, never stored (ADR-0005).
 */
export function parseUtcDateTime(text: string): Result<UtcDateTime, TimeError> {
  const m = ISO_DATE_TIME.exec(text.trim());
  if (!m) return err({ code: "time.invalid-format" });
  const [, ys, mos, ds, hs, mis, ss, zulu, sign, ohs, oms] = m;

  const year = Number(ys);
  const month = Number(mos);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mis);
  const second = Number(ss ?? "0");

  const dateError = checkDate(year, month, day);
  if (dateError) return err(dateError);
  const timeError = checkTime(hour, minute, second);
  if (timeError) return err(timeError);

  let offsetMinutes = 0;
  if (!zulu) {
    if (!sign) return err({ code: "time.missing-offset" });
    const offsetHours = Number(ohs);
    const offsetMins = Number(oms ?? "0");
    if (offsetMins > 59) return err({ code: "time.invalid-offset" });
    offsetMinutes = (sign === "-" ? -1 : 1) * (offsetHours * 60 + offsetMins);
    if (offsetMinutes < -12 * 60 || offsetMinutes > 14 * 60) {
      return err({ code: "time.invalid-offset" });
    }
  }

  const ms =
    Date.UTC(year, month - 1, day, hour, minute, second) -
    offsetMinutes * 60 * MS_PER_SECOND;
  return format(ms);
}

/** Validates a `YYYY-MM-DD` date (calendar-aware: no 30 February). */
export function parseUtcDate(text: string): Result<UtcDate, TimeError> {
  const m = UTC_DATE.exec(text.trim());
  if (!m) return err({ code: "time.invalid-format" });
  const [y, mo, d] = m.slice(1).map(Number) as [number, number, number];
  const dateError = checkDate(y, mo, d);
  return dateError ? err(dateError) : ok(`${m[0]}` as UtcDate);
}

/**
 * Instant of a `Date` (e.g. from the Clock port), truncated to the second.
 * Invalid dates and years outside 1000–9999 are rejected.
 */
export function fromDate(date: Date): Result<UtcDateTime, TimeError> {
  return fromEpochMillis(date.getTime());
}

export function fromEpochMillis(ms: number): Result<UtcDateTime, TimeError> {
  if (!Number.isFinite(ms)) return err({ code: "time.out-of-range" });
  return format(ms);
}

export function toEpochMillis(value: UtcDateTime): number {
  return Date.parse(value);
}

export function toDate(value: UtcDateTime): Date {
  return new Date(toEpochMillis(value));
}

/** Calendar date (UTC) of an instant. */
export function utcDateOf(value: UtcDateTime): UtcDate {
  return value.slice(0, 10) as UtcDate;
}

/** Minutes since 00:00 UTC, 0–1439. */
export function minuteOfDay(value: UtcDateTime): number {
  return Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
}

/** Seconds since 00:00 UTC, 0–86 399. */
export function secondOfDay(value: UtcDateTime): number {
  return minuteOfDay(value) * 60 + Number(value.slice(17, 19));
}

/** ISO weekday of the UTC date: Monday = 1 … Sunday = 7. */
export function isoWeekday(value: UtcDateTime | UtcDate): number {
  const day = new Date(Date.parse(value.slice(0, 10))).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Bit of the weekday in schedule masks (DATABASE.md `broadcast_schedules.days`):
 * Monday = 1, Tuesday = 2, … Sunday = 64.
 */
export function weekdayBit(value: UtcDateTime | UtcDate): number {
  return 1 << (isoWeekday(value) - 1);
}

export function addSeconds(value: UtcDateTime, seconds: number): UtcDateTime {
  const result = format(
    toEpochMillis(value) + Math.trunc(seconds) * MS_PER_SECOND,
  );
  if (!result.ok)
    throw new RangeError(`Date out of range: ${value} + ${seconds}s`);
  return result.value;
}

/** `b - a` in seconds (negative when `b` precedes `a`). */
export function secondsBetween(a: UtcDateTime, b: UtcDateTime): number {
  return (toEpochMillis(b) - toEpochMillis(a)) / MS_PER_SECOND;
}

/** Chronological comparison (equivalent to string comparison). */
export function compareUtc(a: UtcDateTime, b: UtcDateTime): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Builds the end instant from a start and an end time-of-day only (e.g.
 * ADIF `TIME_OFF` without `QSO_DATE_OFF`): same date when the end time is
 * not earlier than the start time, otherwise the next day (the contact
 * crossed midnight UTC). Durations of 24 h or more cannot be expressed.
 */
export function endOnOrAfter(
  start: UtcDateTime,
  endSecondOfDay: number,
): UtcDateTime {
  if (
    !Number.isInteger(endSecondOfDay) ||
    endSecondOfDay < 0 ||
    endSecondOfDay >= SECONDS_PER_DAY
  ) {
    throw new RangeError(`Invalid second of day: ${endSecondOfDay}`);
  }
  const startSecond = secondOfDay(start);
  const delta =
    endSecondOfDay >= startSecond
      ? endSecondOfDay - startSecond
      : SECONDS_PER_DAY - startSecond + endSecondOfDay;
  return addSeconds(start, delta);
}

/**
 * Whether `minute` (0–1439) falls in the schedule window [start, end), with
 * minutes 0–1440. When `end < start` the window crosses midnight UTC
 * (23:00–01:00); `0–1440` is the whole day; `start === end` is empty.
 */
export function isMinuteInWindow(
  minute: number,
  startMinute: number,
  endMinute: number,
): boolean {
  if (startMinute <= endMinute) {
    return minute >= startMinute && minute < endMinute;
  }
  return minute >= startMinute || minute < endMinute;
}

/** `HHMM` (e.g. EiBi/HFCC/ADIF times) to minutes 0–1440; "2400" is 1440. */
export function parseHhmm(text: string): Result<number, TimeError> {
  const m = /^(\d{2})(\d{2})$/.exec(text.trim());
  if (!m) return err({ code: "time.invalid-format" });
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour === 24 && minute === 0) return ok(MINUTES_PER_DAY);
  if (hour > 23 || minute > 59) return err({ code: "time.invalid-time" });
  return ok(hour * 60 + minute);
}

/** Minutes 0–1440 to `HHMM` ("2400" for 1440). */
export function formatHhmm(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_PER_DAY) {
    throw new RangeError(`Invalid minute of day: ${minutes}`);
  }
  return pad(Math.floor(minutes / 60)) + pad(minutes % 60);
}

/**
 * Compact date `YYYYMMDD` and time `HHMM` or `HHMMSS`, both UTC (ADIF
 * `QSO_DATE` / `TIME_ON`), to `UtcDateTime`.
 */
export function fromCompact(
  date: string,
  time: string,
): Result<UtcDateTime, TimeError> {
  const d = COMPACT_DATE.exec(date.trim());
  const t = COMPACT_TIME.exec(time.trim());
  if (!d || !t) return err({ code: "time.invalid-format" });
  return parseUtcDateTime(
    `${d[1]}-${d[2]}-${d[3]}T${t[1]}:${t[2]}:${t[3] ?? "00"}Z`,
  );
}

/** `UtcDateTime` to compact `YYYYMMDD` and `HHMMSS`. */
export function toCompact(value: UtcDateTime): { date: string; time: string } {
  return {
    date: value.slice(0, 10).replaceAll("-", ""),
    time: value.slice(11, 19).replaceAll(":", ""),
  };
}
