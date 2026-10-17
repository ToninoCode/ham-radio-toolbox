import {
  err,
  ok,
  type Brand,
  type DomainError,
  type Result,
} from "@/shared/types";

/**
 * Radio frequency in hertz: a safe, non-negative integer (ADR-0005).
 *
 * This is the only representation that is persisted or passed between
 * layers. kHz/MHz/GHz exist only at the boundaries: parsers and forms convert
 * into `FrequencyHz`, presentation converts out of it for display.
 */
export type FrequencyHz = Brand<number, "FrequencyHz">;

export type FrequencyUnit = "Hz" | "kHz" | "MHz" | "GHz";

export const FREQUENCY_UNITS: readonly FrequencyUnit[] = [
  "Hz",
  "kHz",
  "MHz",
  "GHz",
];

/** Decimal exponent of each unit (1 kHz = 10^3 Hz). */
const UNIT_EXPONENT: Readonly<Record<FrequencyUnit, number>> = {
  Hz: 0,
  kHz: 3,
  MHz: 6,
  GHz: 9,
};

/** Upper bound: `Number.MAX_SAFE_INTEGER` Hz (≈ 9 PHz), see DATABASE.md § 1. */
export const MAX_FREQUENCY_HZ = Number.MAX_SAFE_INTEGER;

export type FrequencyErrorCode =
  | "frequency.not-a-number"
  | "frequency.not-finite"
  | "frequency.negative"
  | "frequency.not-integer"
  | "frequency.too-large"
  | "frequency.invalid-format";

export type FrequencyError = DomainError<FrequencyErrorCode>;

export function isFrequencyHz(value: unknown): value is FrequencyHz {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Checks a value already expressed in whole hertz (no rounding). */
export function frequencyHz(
  value: unknown,
): Result<FrequencyHz, FrequencyError> {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return err({ code: "frequency.not-a-number" });
  }
  if (!Number.isFinite(value)) return err({ code: "frequency.not-finite" });
  if (value < 0) return err({ code: "frequency.negative" });
  if (value > MAX_FREQUENCY_HZ) return err({ code: "frequency.too-large" });
  if (!Number.isInteger(value)) return err({ code: "frequency.not-integer" });
  return ok(value as FrequencyHz);
}

/**
 * Converts a numeric value in `unit` to hertz, rounding to the nearest hertz
 * (ADR-0005: sources in kHz/MHz are rounded at the boundary).
 *
 * Binary floating point cannot represent most decimal fractions exactly
 * (0.001014 MHz × 10^6 = 1013.999…), so the rounding absorbs that error.
 * A value exactly half-way between two hertz may round either way: use
 * {@link parseFrequency} on the original text when that matters.
 */
export function fromUnit(
  value: number,
  unit: FrequencyUnit,
): Result<FrequencyHz, FrequencyError> {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return err({ code: "frequency.not-a-number" });
  }
  if (!Number.isFinite(value)) return err({ code: "frequency.not-finite" });
  if (value < 0) return err({ code: "frequency.negative" });
  return frequencyHz(Math.round(value * 10 ** UNIT_EXPONENT[unit]));
}

/** Hertz expressed in `unit` (nearest double). For display, not for storage. */
export function toUnit(hz: FrequencyHz, unit: FrequencyUnit): number {
  return hz / 10 ** UNIT_EXPONENT[unit];
}

const DECIMAL_TEXT = /^(\d+)(?:[.,](\d*))?$/;

/**
 * Parses decimal text in `unit` ("14.074", "7,0745", "3573") to hertz using
 * exact decimal arithmetic, so no floating-point error is introduced.
 * Accepts `.` or `,` as decimal separator and no thousands separators.
 * Digits beyond 1 Hz are rounded half-up ("1.0000005" MHz → 1 000 001 Hz).
 */
export function parseFrequency(
  text: string,
  unit: FrequencyUnit,
): Result<FrequencyHz, FrequencyError> {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (!match) return err({ code: "frequency.invalid-format" });

  const integerDigits = match[1] ?? "";
  const fractionDigits = match[2] ?? "";
  const exponent = UNIT_EXPONENT[unit];

  const kept = fractionDigits.slice(0, exponent).padEnd(exponent, "0");
  const roundUp = (fractionDigits[exponent] ?? "0") >= "5";

  const hz = BigInt(integerDigits + kept) + (roundUp ? 1n : 0n);
  if (hz > BigInt(MAX_FREQUENCY_HZ))
    return err({ code: "frequency.too-large" });
  return ok(Number(hz) as FrequencyHz);
}

/**
 * ITU designation of the frequency range (Radio Regulations, Art. 2):
 * band N covers 0.3 × 10^N Hz (excluded) to 3 × 10^N Hz (included).
 * `undefined` below 3 Hz or above 3000 GHz.
 */
export type ItuFrequencyRange =
  | "ELF"
  | "SLF"
  | "ULF"
  | "VLF"
  | "LF"
  | "MF"
  | "HF"
  | "VHF"
  | "UHF"
  | "SHF"
  | "EHF"
  | "THF";

const ITU_RANGES: readonly { upperHz: number; range: ItuFrequencyRange }[] = [
  { upperHz: 30, range: "ELF" },
  { upperHz: 300, range: "SLF" },
  { upperHz: 3_000, range: "ULF" },
  { upperHz: 30_000, range: "VLF" },
  { upperHz: 300_000, range: "LF" },
  { upperHz: 3_000_000, range: "MF" },
  { upperHz: 30_000_000, range: "HF" },
  { upperHz: 300_000_000, range: "VHF" },
  { upperHz: 3_000_000_000, range: "UHF" },
  { upperHz: 30_000_000_000, range: "SHF" },
  { upperHz: 300_000_000_000, range: "EHF" },
  { upperHz: 3_000_000_000_000, range: "THF" },
];

export function ituFrequencyRange(
  hz: FrequencyHz,
): ItuFrequencyRange | undefined {
  if (hz <= 3) return undefined;
  return ITU_RANGES.find((r) => hz <= r.upperHz)?.range;
}
