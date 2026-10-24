import { err, ok, type DomainError, type Result } from "@/shared/types";

/**
 * Kind of signal report (FR-HAM-04):
 * - `rs`: readability 1–5 and strength 1–9, for telephony (`59`);
 * - `rst`: plus tone 1–9, for CW and digital modes (`599`);
 * - `db`: signal-to-noise ratio in dB, for WSJT-X modes (`-12`, `+05`).
 */
export type ReportKind = "rs" | "rst" | "db";

export interface RstReport {
  /** 1 (unreadable) … 5 (perfectly readable). */
  readonly readability: number;
  /** 1 (faint) … 9 (extremely strong). */
  readonly strength: number;
  /** 1 (very rough) … 9 (perfect tone); absent for telephony. */
  readonly tone?: number;
}

export type ReportErrorCode =
  | "report.empty"
  | "report.invalid-format"
  | "report.out-of-range"
  | "report.kind-mismatch";

export type ReportError = DomainError<ReportErrorCode>;

/**
 * Sanity range for dB reports. The decoders of WSJT-X modes report values
 * well inside it; anything outside is a typing error.
 */
export const DB_REPORT_MIN = -50;
export const DB_REPORT_MAX = 50;

/** ADIF modes using telephony reports. */
const PHONE_MODES = new Set(["SSB", "AM", "FM", "DIGITALVOICE"]);

/**
 * ADIF modes and MFSK submodes of WSJT-X/JS8Call, which exchange dB
 * reports. Meteor-scatter FSK441/ISCAT use their own format: not listed.
 */
const DB_MODES = new Set([
  "FT8",
  "FT4",
  "JT4",
  "JT9",
  "JT65",
  "Q65",
  "QRA64",
  "FST4",
  "MSK144",
  "JS8",
]);

/** Modes without contacts or with other report systems (SSTV RSV, beacons). */
const NO_STANDARD_REPORT = new Set([
  "SSTV",
  "ATV",
  "FAX",
  "WSPR",
  "FSK441",
  "ISCAT",
]);

/**
 * Report kind expected for an ADIF mode/submode (case-insensitive);
 * `undefined` when the mode has no single standard report or is unknown,
 * in which case any well-formed report is accepted.
 */
export function reportKindForMode(
  mode: string,
  submode?: string,
): ReportKind | undefined {
  const m = mode.trim().toUpperCase();
  const s = submode?.trim().toUpperCase();
  if (DB_MODES.has(m) || (s !== undefined && DB_MODES.has(s))) return "db";
  if (PHONE_MODES.has(m)) return "rs";
  if (m === "" || NO_STANDARD_REPORT.has(m)) return undefined;
  return "rst";
}

const RST_PATTERN = /^([0-9])([0-9])([0-9])?$/;
const DB_PATTERN = /^([+-])?(\d{1,2})$/;

function parseRstDigits(text: string): Result<RstReport, ReportError> {
  const m = RST_PATTERN.exec(text);
  if (!m) return err({ code: "report.invalid-format" });
  const readability = Number(m[1]);
  const strength = Number(m[2]);
  const tone = m[3] === undefined ? undefined : Number(m[3]);
  if (
    readability < 1 ||
    readability > 5 ||
    strength < 1 ||
    (tone !== undefined && tone < 1)
  ) {
    return err({ code: "report.out-of-range" });
  }
  return ok({ readability, strength, ...(tone === undefined ? {} : { tone }) });
}

/**
 * Parses an RS (`kind = "rs"`) or RST (`kind = "rst"`) report. Checks, in
 * order: format (two or three digits), range of each digit, then kind.
 */
export function parseRst(
  text: string,
  kind: "rs" | "rst",
): Result<RstReport, ReportError> {
  const trimmed = text.trim();
  if (trimmed === "") return err({ code: "report.empty" });
  const report = parseRstDigits(trimmed);
  if (!report.ok) return report;
  const isRst = report.value.tone !== undefined;
  if (isRst !== (kind === "rst")) return err({ code: "report.kind-mismatch" });
  return report;
}

export function formatRst(report: RstReport): string {
  return `${report.readability}${report.strength}${report.tone ?? ""}`;
}

/**
 * Parses a dB report: optional sign, one or two digits ("-5", "-05", "+12",
 * "0"), within {@link DB_REPORT_MIN}…{@link DB_REPORT_MAX}.
 */
export function parseDbReport(text: string): Result<number, ReportError> {
  const trimmed = text.trim();
  if (trimmed === "") return err({ code: "report.empty" });
  const m = DB_PATTERN.exec(trimmed);
  if (!m) return err({ code: "report.invalid-format" });
  const value = (m[1] === "-" ? -1 : 1) * Number(m[2]);
  if (value < DB_REPORT_MIN || value > DB_REPORT_MAX) {
    return err({ code: "report.out-of-range" });
  }
  return ok(value === 0 ? 0 : value);
}

/** dB report as exchanged by WSJT-X: sign and two digits ("-05", "+12", "+00"). */
export function formatDbReport(value: number): string {
  if (
    !Number.isInteger(value) ||
    value < DB_REPORT_MIN ||
    value > DB_REPORT_MAX
  ) {
    throw new RangeError(`Invalid dB report: ${value}`);
  }
  return `${value < 0 ? "-" : "+"}${String(Math.abs(value)).padStart(2, "0")}`;
}

/**
 * Validates a report and returns its normalised string, as persisted in
 * `rstSent`/`rstRcvd`/`rst`. With a `kind` the report must be of that kind;
 * without, the kind is inferred from the text (a sign means dB, then two or
 * three digits mean RS or RST).
 */
export function normalizeSignalReport(
  text: string,
  kind?: ReportKind,
): Result<string, ReportError> {
  const trimmed = text.trim();
  if (trimmed === "") return err({ code: "report.empty" });

  const effective =
    kind ??
    (/^[+-]/.test(trimmed) ? "db" : trimmed.length === 2 ? "rs" : "rst");

  if (effective === "db") {
    const db = parseDbReport(trimmed);
    if (db.ok) return ok(formatDbReport(db.value));
    // "59" given where a dB report is expected.
    if (kind && parseRstDigits(trimmed).ok) {
      return err({ code: "report.kind-mismatch" });
    }
    return db;
  }

  if (/^[+-]/.test(trimmed) && parseDbReport(trimmed).ok) {
    return err({ code: "report.kind-mismatch" });
  }
  const rst = parseRst(trimmed, effective);
  return rst.ok ? ok(formatRst(rst.value)) : rst;
}
