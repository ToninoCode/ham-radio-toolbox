import { err, ok, type DomainError, type Result } from "@/shared/types";
import {
  frequencyHz,
  type FrequencyError,
  type FrequencyHz,
} from "./frequency";

/** Speed of light in vacuum, exact by definition of the metre (SI, 1983). */
export const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

export type WavelengthErrorCode =
  "wavelength.zero-frequency" | "wavelength.not-positive";

export type WavelengthError = DomainError<WavelengthErrorCode>;

/**
 * Free-space wavelength λ = c / f, in metres. Velocity factor of cables or
 * antenna shortening belong to the RF calculators (M6), not here.
 */
export function wavelengthMeters(
  hz: FrequencyHz,
): Result<number, WavelengthError> {
  if (hz === 0) return err({ code: "wavelength.zero-frequency" });
  return ok(SPEED_OF_LIGHT_M_PER_S / hz);
}

/** Frequency f = c / λ for a free-space wavelength in metres, rounded to 1 Hz. */
export function frequencyFromWavelength(
  meters: number,
): Result<FrequencyHz, WavelengthError | FrequencyError> {
  if (typeof meters !== "number" || Number.isNaN(meters)) {
    return err({ code: "frequency.not-a-number" });
  }
  if (!(meters > 0) || !Number.isFinite(meters)) {
    return err({ code: "wavelength.not-positive" });
  }
  return frequencyHz(Math.round(SPEED_OF_LIGHT_M_PER_S / meters));
}
