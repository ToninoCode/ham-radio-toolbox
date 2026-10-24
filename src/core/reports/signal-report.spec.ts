// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DB_REPORT_MAX,
  DB_REPORT_MIN,
  formatDbReport,
  formatRst,
  normalizeSignalReport,
  parseDbReport,
  parseRst,
  reportKindForMode,
} from ".";

const codeOf = (result: { ok: boolean; error?: { code: string } }) =>
  result.ok ? undefined : result.error?.code;

describe("parseRst — RST scale (R 1–5, S 1–9, T 1–9)", () => {
  it("parses the limits of each component", () => {
    expect(parseRst("11", "rs")).toEqual({
      ok: true,
      value: { readability: 1, strength: 1 },
    });
    expect(parseRst("59", "rs")).toEqual({
      ok: true,
      value: { readability: 5, strength: 9 },
    });
    expect(parseRst("111", "rst")).toEqual({
      ok: true,
      value: { readability: 1, strength: 1, tone: 1 },
    });
    expect(parseRst(" 599 ", "rst")).toEqual({
      ok: true,
      value: { readability: 5, strength: 9, tone: 9 },
    });
  });

  it.each([
    ["69", "rs"], // readability above 5
    ["09", "rs"], // readability 0
    ["09", "rst"], // out of range is reported before the kind mismatch
    ["50", "rs"], // strength 0
    ["099", "rst"],
    ["699", "rst"],
    ["509", "rst"],
    ["590", "rst"], // tone 0
  ] as const)("rejects %s (%s) as out of range", (text, kind) => {
    expect(codeOf(parseRst(text, kind))).toBe("report.out-of-range");
  });

  it.each([
    ["599", "rs"],
    ["59", "rst"],
  ] as const)("rejects %s as the wrong kind for %s", (text, kind) => {
    expect(codeOf(parseRst(text, kind))).toBe("report.kind-mismatch");
  });

  it.each(["5", "5999", "5N9", "5NN", "-10", "59+", " 5 9"])(
    "rejects %j as malformed",
    (text) => {
      expect(codeOf(parseRst(text, "rst"))).toBe("report.invalid-format");
    },
  );

  it("rejects empty input", () => {
    expect(codeOf(parseRst("  ", "rs"))).toBe("report.empty");
  });

  it("formats reports", () => {
    expect(formatRst({ readability: 5, strength: 7 })).toBe("57");
    expect(formatRst({ readability: 4, strength: 8, tone: 9 })).toBe("489");
  });
});

describe("dB reports", () => {
  it.each([
    ["-12", -12],
    ["-5", -5],
    ["-05", -5],
    ["+05", 5],
    ["5", 5],
    ["0", 0],
    ["-0", 0],
    [String(DB_REPORT_MIN), DB_REPORT_MIN],
    [`+${DB_REPORT_MAX}`, DB_REPORT_MAX],
  ])("parses %j as %d", (text, value) => {
    expect(parseDbReport(text)).toEqual({ ok: true, value });
  });

  it("rejects values outside the sanity range and malformed text", () => {
    expect(codeOf(parseDbReport("-51"))).toBe("report.out-of-range");
    expect(codeOf(parseDbReport("+51"))).toBe("report.out-of-range");
    expect(codeOf(parseDbReport("-100"))).toBe("report.invalid-format");
    expect(codeOf(parseDbReport("--5"))).toBe("report.invalid-format");
    expect(codeOf(parseDbReport("-5dB"))).toBe("report.invalid-format");
    expect(codeOf(parseDbReport("-5.5"))).toBe("report.invalid-format");
    expect(codeOf(parseDbReport(""))).toBe("report.empty");
  });

  it("formats with sign and two digits, as WSJT-X", () => {
    expect(formatDbReport(-12)).toBe("-12");
    expect(formatDbReport(-5)).toBe("-05");
    expect(formatDbReport(5)).toBe("+05");
    expect(formatDbReport(0)).toBe("+00");
    expect(() => formatDbReport(51)).toThrow(RangeError);
    expect(() => formatDbReport(1.5)).toThrow(RangeError);
  });
});

describe("reportKindForMode (FR-HAM-04)", () => {
  it.each([
    ["SSB", undefined, "rs"],
    ["AM", undefined, "rs"],
    ["FM", undefined, "rs"],
    ["DIGITALVOICE", "DMR", "rs"],
    ["CW", undefined, "rst"],
    ["RTTY", undefined, "rst"],
    ["PSK", "PSK31", "rst"],
    ["OLIVIA", undefined, "rst"],
    ["FT8", undefined, "db"],
    ["MFSK", "FT4", "db"],
    ["MFSK", "Q65", "db"],
    ["MFSK", "JS8", "db"],
    ["JT65", undefined, "db"],
    ["MSK144", undefined, "db"],
    ["ft8", undefined, "db"],
    ["ssb", "usb", "rs"],
  ])("%s/%s → %s", (mode, submode, kind) => {
    expect(reportKindForMode(mode, submode)).toBe(kind);
  });

  it("has no single expected kind for SSTV, beacons and empty modes", () => {
    expect(reportKindForMode("SSTV")).toBeUndefined();
    expect(reportKindForMode("WSPR")).toBeUndefined();
    expect(reportKindForMode("")).toBeUndefined();
  });
});

describe("normalizeSignalReport", () => {
  it("normalises according to the expected kind", () => {
    expect(normalizeSignalReport(" 59 ", "rs")).toEqual({
      ok: true,
      value: "59",
    });
    expect(normalizeSignalReport("599", "rst")).toEqual({
      ok: true,
      value: "599",
    });
    expect(normalizeSignalReport("-5", "db")).toEqual({
      ok: true,
      value: "-05",
    });
    expect(normalizeSignalReport("3", "db")).toEqual({
      ok: true,
      value: "+03",
    });
  });

  it("reports a kind mismatch between report and mode", () => {
    expect(codeOf(normalizeSignalReport("599", "rs"))).toBe(
      "report.kind-mismatch",
    );
    expect(codeOf(normalizeSignalReport("59", "rst"))).toBe(
      "report.kind-mismatch",
    );
    expect(codeOf(normalizeSignalReport("59", "db"))).toBe(
      "report.kind-mismatch",
    );
    expect(codeOf(normalizeSignalReport("599", "db"))).toBe(
      "report.kind-mismatch",
    );
    expect(codeOf(normalizeSignalReport("-10", "rst"))).toBe(
      "report.kind-mismatch",
    );
  });

  it("infers the kind when the mode gives none", () => {
    expect(normalizeSignalReport("57")).toEqual({ ok: true, value: "57" });
    expect(normalizeSignalReport("579")).toEqual({ ok: true, value: "579" });
    expect(normalizeSignalReport("-7")).toEqual({ ok: true, value: "-07" });
    expect(normalizeSignalReport("+12")).toEqual({ ok: true, value: "+12" });
  });

  it("propagates format and range errors", () => {
    expect(codeOf(normalizeSignalReport(""))).toBe("report.empty");
    expect(codeOf(normalizeSignalReport("5"))).toBe("report.invalid-format");
    expect(codeOf(normalizeSignalReport("69"))).toBe("report.out-of-range");
    expect(codeOf(normalizeSignalReport("-60"))).toBe("report.out-of-range");
    expect(codeOf(normalizeSignalReport("abc", "db"))).toBe(
      "report.invalid-format",
    );
  });
});
