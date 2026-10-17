// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unwrap } from "@/shared/types";
import {
  addSeconds,
  compareUtc,
  endOnOrAfter,
  formatHhmm,
  fromCompact,
  fromDate,
  fromEpochMillis,
  isMinuteInWindow,
  isUtcDate,
  isUtcDateTime,
  isoWeekday,
  minuteOfDay,
  parseHhmm,
  parseUtcDate,
  parseUtcDateTime,
  secondOfDay,
  secondsBetween,
  toCompact,
  toDate,
  toEpochMillis,
  utcDateOf,
  weekdayBit,
  type UtcDateTime,
} from ".";

const dt = (text: string) => unwrap(parseUtcDateTime(text));
const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? undefined : result.error?.code;

describe("isUtcDateTime / isUtcDate", () => {
  it("accepts only the normalised format", () => {
    expect(isUtcDateTime("2026-10-17T13:21:00Z")).toBe(true);
    expect(isUtcDateTime("2026-10-17T13:21:00.000Z")).toBe(false);
    expect(isUtcDateTime("2026-10-17T13:21Z")).toBe(false);
    expect(isUtcDateTime("2026-10-17T15:21:00+02:00")).toBe(false);
    expect(isUtcDateTime("2026-10-17 13:21:00Z")).toBe(false);
    expect(isUtcDateTime("2026-10-17t13:21:00z")).toBe(false);
    expect(isUtcDateTime("2026-10-17T13:21:00")).toBe(false);
    expect(isUtcDateTime(null)).toBe(false);
    expect(isUtcDateTime(1_700_000_000_000)).toBe(false);
  });

  it("checks the calendar and the clock", () => {
    expect(isUtcDateTime("2024-02-29T00:00:00Z")).toBe(true); // leap year
    expect(isUtcDateTime("2023-02-29T00:00:00Z")).toBe(false);
    expect(isUtcDateTime("2000-02-29T00:00:00Z")).toBe(true); // divisible by 400
    expect(isUtcDateTime("1900-02-29T00:00:00Z")).toBe(false); // by 100, not 400
    expect(isUtcDateTime("2026-04-31T00:00:00Z")).toBe(false);
    expect(isUtcDateTime("2026-13-01T00:00:00Z")).toBe(false);
    expect(isUtcDateTime("2026-00-01T00:00:00Z")).toBe(false);
    expect(isUtcDateTime("2026-10-00T00:00:00Z")).toBe(false);
    expect(isUtcDateTime("2026-10-17T24:00:00Z")).toBe(false);
    expect(isUtcDateTime("2026-10-17T23:60:00Z")).toBe(false);
    expect(isUtcDateTime("2016-12-31T23:59:60Z")).toBe(false); // leap second
  });

  it("limits years to 1000–9999", () => {
    expect(isUtcDateTime("1000-01-01T00:00:00Z")).toBe(true);
    expect(isUtcDateTime("9999-12-31T23:59:59Z")).toBe(true);
    expect(isUtcDateTime("0999-12-31T23:59:59Z")).toBe(false);
  });

  it("validates dates", () => {
    expect(isUtcDate("2026-10-17")).toBe(true);
    expect(isUtcDate("2026-02-30")).toBe(false);
    expect(isUtcDate("20261017")).toBe(false);
    expect(isUtcDate(undefined)).toBe(false);
  });
});

describe("parseUtcDateTime", () => {
  it("keeps a normalised value unchanged", () => {
    expect(dt("2026-10-17T13:21:00Z")).toBe("2026-10-17T13:21:00Z");
  });

  it.each([
    ["2026-10-17T15:21:00+02:00", "2026-10-17T13:21:00Z"],
    ["2026-10-17T15:21:00+0200", "2026-10-17T13:21:00Z"],
    ["2026-10-17T15:21:00+02", "2026-10-17T13:21:00Z"],
    ["2026-10-17T08:51:00-04:30", "2026-10-17T13:21:00Z"],
    ["2026-10-17T13:21:00-00:00", "2026-10-17T13:21:00Z"],
    ["2026-10-17t13:21:00z", "2026-10-17T13:21:00Z"],
    ["2026-10-17 13:21:00Z", "2026-10-17T13:21:00Z"],
    ["2026-10-17T13:21Z", "2026-10-17T13:21:00Z"],
    ["2026-10-17T13:21:59.999Z", "2026-10-17T13:21:59Z"],
    ["2026-10-17T13:21:59,5Z", "2026-10-17T13:21:59Z"],
    [" 2026-10-17T13:21:00Z ", "2026-10-17T13:21:00Z"],
  ])("normalises %j to %j", (input, expected) => {
    expect(dt(input)).toBe(expected);
  });

  it("moves to the previous or next UTC day across midnight", () => {
    // 01:30 in Italy (CEST, +02:00) is 23:30 UTC of the previous day.
    expect(dt("2026-10-18T01:30:00+02:00")).toBe("2026-10-17T23:30:00Z");
    expect(dt("2026-10-17T20:00:00-05:00")).toBe("2026-10-18T01:00:00Z");
    // Across a year and a leap day.
    expect(dt("2027-01-01T00:30:00+01:00")).toBe("2026-12-31T23:30:00Z");
    expect(dt("2024-02-28T23:30:00-01:00")).toBe("2024-02-29T00:30:00Z");
  });

  it.each([
    ["2026-10-17T13:21:00", "time.missing-offset"],
    ["2026-10-17", "time.invalid-format"],
    ["17/10/2026 13:21", "time.invalid-format"],
    ["", "time.invalid-format"],
    ["2026-10-17T13:21:00+2:00", "time.invalid-format"],
    ["2026-02-30T00:00:00Z", "time.invalid-date"],
    ["2026-10-17T25:00:00Z", "time.invalid-time"],
    ["2016-12-31T23:59:60Z", "time.invalid-time"],
    ["2026-10-17T13:21:00+15:00", "time.invalid-offset"],
    ["2026-10-17T13:21:00-13:00", "time.invalid-offset"],
    ["2026-10-17T13:21:00+01:60", "time.invalid-offset"],
    ["0999-12-31T23:00:00Z", "time.out-of-range"],
    ["1000-01-01T00:30:00+01:00", "time.out-of-range"],
  ])("rejects %j with %s", (input, code) => {
    expect(codeOf(parseUtcDateTime(input))).toBe(code);
  });
});

describe("parseUtcDate", () => {
  it("accepts calendar dates and rejects invalid ones", () => {
    expect(parseUtcDate("2026-10-17")).toEqual({
      ok: true,
      value: "2026-10-17",
    });
    expect(codeOf(parseUtcDate("2026-02-29"))).toBe("time.invalid-date");
    expect(codeOf(parseUtcDate("2026-1-7"))).toBe("time.invalid-format");
  });
});

describe("conversions", () => {
  it("converts to and from epoch milliseconds (Unix epoch reference)", () => {
    expect(toEpochMillis(dt("1970-01-01T00:00:00Z"))).toBe(0);
    expect(unwrap(fromEpochMillis(0))).toBe("1970-01-01T00:00:00Z");
    // 2000-01-01T00:00:00Z = 946 684 800 s (POSIX time).
    expect(toEpochMillis(dt("2000-01-01T00:00:00Z"))).toBe(946_684_800_000);
  });

  it("truncates milliseconds instead of rounding", () => {
    expect(unwrap(fromEpochMillis(946_684_800_999))).toBe(
      "2000-01-01T00:00:00Z",
    );
    // Before the epoch truncation still goes to the earlier second.
    expect(unwrap(fromEpochMillis(-1))).toBe("1969-12-31T23:59:59Z");
  });

  it("converts Date objects (from the Clock port)", () => {
    expect(
      unwrap(fromDate(new Date(Date.UTC(2026, 9, 17, 13, 21, 0, 500)))),
    ).toBe("2026-10-17T13:21:00Z");
    expect(toDate(dt("2026-10-17T13:21:00Z")).toISOString()).toBe(
      "2026-10-17T13:21:00.000Z",
    );
  });

  it("rejects invalid dates and non-finite or out-of-range epochs", () => {
    expect(codeOf(fromDate(new Date(Number.NaN)))).toBe("time.out-of-range");
    expect(codeOf(fromEpochMillis(Number.NaN))).toBe("time.out-of-range");
    expect(codeOf(fromEpochMillis(Number.POSITIVE_INFINITY))).toBe(
      "time.out-of-range",
    );
    expect(codeOf(fromEpochMillis(Date.UTC(10_000, 0, 1)))).toBe(
      "time.out-of-range",
    );
    // Finite but beyond the ±8.64e15 ms range of Date: an invalid Date.
    expect(codeOf(fromEpochMillis(1e20))).toBe("time.out-of-range");
  });

  it("converts compact ADIF-style date and time", () => {
    expect(unwrap(fromCompact("20261017", "1321"))).toBe(
      "2026-10-17T13:21:00Z",
    );
    expect(unwrap(fromCompact("20261017", "132145"))).toBe(
      "2026-10-17T13:21:45Z",
    );
    expect(codeOf(fromCompact("20261017", "13"))).toBe("time.invalid-format");
    expect(codeOf(fromCompact("2026-10-17", "1321"))).toBe(
      "time.invalid-format",
    );
    expect(codeOf(fromCompact("20260230", "1321"))).toBe("time.invalid-date");
    expect(codeOf(fromCompact("20261017", "2400"))).toBe("time.invalid-time");
    expect(toCompact(dt("2026-10-17T13:21:45Z"))).toEqual({
      date: "20261017",
      time: "132145",
    });
  });

  it("extracts date, minute and second of day", () => {
    const value = dt("2026-10-17T13:21:45Z");
    expect(utcDateOf(value)).toBe("2026-10-17");
    expect(minuteOfDay(value)).toBe(13 * 60 + 21);
    expect(secondOfDay(value)).toBe(13 * 3600 + 21 * 60 + 45);
    expect(minuteOfDay(dt("2026-10-17T00:00:00Z"))).toBe(0);
    expect(minuteOfDay(dt("2026-10-17T23:59:59Z"))).toBe(1439);
  });
});

describe("weekdays", () => {
  it("uses ISO numbering on known dates", () => {
    expect(isoWeekday(dt("1970-01-01T00:00:00Z"))).toBe(4); // Thursday
    expect(isoWeekday(dt("2000-01-01T12:00:00Z"))).toBe(6); // Saturday
    expect(isoWeekday(unwrap(parseUtcDate("2024-02-29")))).toBe(4); // Thursday
    expect(isoWeekday(dt("2000-01-02T23:59:59Z"))).toBe(7); // Sunday
  });

  it("follows the UTC date, not the local one", () => {
    // 23:30 UTC on Saturday is already Sunday in Italy, but stays Saturday.
    expect(isoWeekday(dt("2000-01-01T23:30:00Z"))).toBe(6);
  });

  it("maps to the schedule bitmask Monday = 1 … Sunday = 64", () => {
    expect(weekdayBit(dt("2000-01-03T00:00:00Z"))).toBe(1); // Monday
    expect(weekdayBit(dt("2000-01-01T00:00:00Z"))).toBe(32); // Saturday
    expect(weekdayBit(dt("2000-01-02T00:00:00Z"))).toBe(64); // Sunday
  });
});

describe("arithmetic across midnight UTC", () => {
  it("adds seconds across day, month, year and leap-day boundaries", () => {
    expect(addSeconds(dt("2026-10-17T23:59:59Z"), 1)).toBe(
      "2026-10-18T00:00:00Z",
    );
    expect(addSeconds(dt("2026-12-31T23:59:30Z"), 45)).toBe(
      "2027-01-01T00:00:15Z",
    );
    expect(addSeconds(dt("2024-02-28T23:00:00Z"), 3600)).toBe(
      "2024-02-29T00:00:00Z",
    );
    expect(addSeconds(dt("2026-10-18T00:00:00Z"), -1)).toBe(
      "2026-10-17T23:59:59Z",
    );
  });

  it("throws on results outside the supported years", () => {
    expect(() => addSeconds(dt("9999-12-31T23:59:59Z"), 1)).toThrow(RangeError);
  });

  it("measures and compares instants", () => {
    const a = dt("2026-10-17T23:58:00Z");
    const b = dt("2026-10-18T00:03:00Z");
    expect(secondsBetween(a, b)).toBe(300);
    expect(secondsBetween(b, a)).toBe(-300);
    expect(compareUtc(a, b)).toBe(-1);
    expect(compareUtc(b, a)).toBe(1);
    expect(compareUtc(a, a)).toBe(0);
    expect([b, a].sort(compareUtc)).toEqual([a, b]);
  });

  it("endOnOrAfter keeps the date or moves to the next day", () => {
    const start = dt("2026-10-17T23:58:00Z");
    expect(endOnOrAfter(start, 23 * 3600 + 59 * 60)).toBe(
      "2026-10-17T23:59:00Z",
    );
    expect(endOnOrAfter(start, 23 * 3600 + 58 * 60)).toBe(
      "2026-10-17T23:58:00Z",
    );
    expect(endOnOrAfter(start, 3 * 60)).toBe("2026-10-18T00:03:00Z");
    expect(endOnOrAfter(dt("2026-12-31T23:50:00Z"), 600)).toBe(
      "2027-01-01T00:10:00Z",
    );
  });

  it("endOnOrAfter rejects invalid seconds of day", () => {
    const start = dt("2026-10-17T12:00:00Z") as UtcDateTime;
    expect(() => endOnOrAfter(start, 86_400)).toThrow(RangeError);
    expect(() => endOnOrAfter(start, -1)).toThrow(RangeError);
    expect(() => endOnOrAfter(start, 1.5)).toThrow(RangeError);
  });
});

describe("schedule windows (minutes from 00:00 UTC)", () => {
  it("handles a window within the day, end excluded", () => {
    expect(isMinuteInWindow(600, 600, 660)).toBe(true);
    expect(isMinuteInWindow(659, 600, 660)).toBe(true);
    expect(isMinuteInWindow(660, 600, 660)).toBe(false);
    expect(isMinuteInWindow(599, 600, 660)).toBe(false);
  });

  it("handles a window crossing midnight (23:00–01:00)", () => {
    expect(isMinuteInWindow(1380, 1380, 60)).toBe(true);
    expect(isMinuteInWindow(1439, 1380, 60)).toBe(true);
    expect(isMinuteInWindow(0, 1380, 60)).toBe(true);
    expect(isMinuteInWindow(59, 1380, 60)).toBe(true);
    expect(isMinuteInWindow(60, 1380, 60)).toBe(false);
    expect(isMinuteInWindow(1379, 1380, 60)).toBe(false);
  });

  it("treats 0000–2400 as the whole day and equal bounds as empty", () => {
    expect(isMinuteInWindow(0, 0, 1440)).toBe(true);
    expect(isMinuteInWindow(1439, 0, 1440)).toBe(true);
    expect(isMinuteInWindow(0, 600, 600)).toBe(false);
    expect(isMinuteInWindow(600, 600, 600)).toBe(false);
  });

  it("parses and formats HHMM, with 2400 as end of day", () => {
    expect(unwrap(parseHhmm("0000"))).toBe(0);
    expect(unwrap(parseHhmm("2330"))).toBe(1410);
    expect(unwrap(parseHhmm("2400"))).toBe(1440);
    expect(codeOf(parseHhmm("2401"))).toBe("time.invalid-time");
    expect(codeOf(parseHhmm("0960"))).toBe("time.invalid-time");
    expect(codeOf(parseHhmm("930"))).toBe("time.invalid-format");
    expect(formatHhmm(0)).toBe("0000");
    expect(formatHhmm(1410)).toBe("2330");
    expect(formatHhmm(1440)).toBe("2400");
    expect(() => formatHhmm(1441)).toThrow(RangeError);
    expect(() => formatHhmm(-1)).toThrow(RangeError);
  });
});
