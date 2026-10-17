import { err, ok, type DomainError, type Result } from "@/shared/types";

/**
 * SINPO reception report (ITU-R / broadcast listening), five independent
 * ratings from 1 to 5, where 5 is always the best condition:
 * - Signal strength: 5 excellent … 1 barely audible;
 * - Interference from other stations: 5 nil … 1 extreme;
 * - Noise (atmospheric/man-made): 5 nil … 1 extreme;
 * - Propagation disturbance (fading): 5 nil … 1 extreme;
 * - Overall merit: 5 excellent … 1 unusable.
 *
 * `overall` is the listener's own judgement, not computed from the others.
 */
export interface Sinpo {
  readonly signal: number;
  readonly interference: number;
  readonly noise: number;
  readonly propagation: number;
  readonly overall: number;
}

export type SinpoField = keyof Sinpo;

/** Field order in the five-digit code. */
export const SINPO_FIELDS: readonly SinpoField[] = [
  "signal",
  "interference",
  "noise",
  "propagation",
  "overall",
];

export const SINPO_MIN = 1;
export const SINPO_MAX = 5;

export type SinpoErrorCode =
  "sinpo.empty" | "sinpo.invalid-format" | "sinpo.out-of-range";

export interface SinpoError extends DomainError<SinpoErrorCode> {
  /** Offending rating, for `sinpo.out-of-range`. */
  readonly field?: SinpoField;
}

const isRating = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= SINPO_MIN &&
  value <= SINPO_MAX;

/** Validates the five ratings, reporting the first one out of range. */
export function sinpo(values: {
  readonly [K in SinpoField]: unknown;
}): Result<Sinpo, SinpoError> {
  for (const field of SINPO_FIELDS) {
    if (!isRating(values[field])) {
      return err({ code: "sinpo.out-of-range", field });
    }
  }
  return ok({
    signal: values.signal as number,
    interference: values.interference as number,
    noise: values.noise as number,
    propagation: values.propagation as number,
    overall: values.overall as number,
  });
}

/** Parses the five-digit code ("45434"), ignoring surrounding spaces. */
export function parseSinpo(text: string): Result<Sinpo, SinpoError> {
  const trimmed = text.trim();
  if (trimmed === "") return err({ code: "sinpo.empty" });
  if (!/^\d{5}$/.test(trimmed)) return err({ code: "sinpo.invalid-format" });
  const digits = [...trimmed].map(Number);
  return sinpo({
    signal: digits[0],
    interference: digits[1],
    noise: digits[2],
    propagation: digits[3],
    overall: digits[4],
  });
}

/** Five-digit code, as persisted in `swl_receptions.sinpo`. */
export function formatSinpo(report: Sinpo): string {
  return SINPO_FIELDS.map((field) => report[field]).join("");
}

export function isSinpoCode(value: unknown): value is string {
  return typeof value === "string" && /^[1-5]{5}$/.test(value);
}
