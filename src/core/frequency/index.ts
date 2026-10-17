import { createBandPlan } from "./band-plan";
import { IARU_REGION_1_BAND_PLAN } from "./iaru-region1";

export {
  FREQUENCY_UNITS,
  MAX_FREQUENCY_HZ,
  frequencyHz,
  fromUnit,
  isFrequencyHz,
  ituFrequencyRange,
  parseFrequency,
  toUnit,
} from "./frequency";
export type {
  FrequencyError,
  FrequencyErrorCode,
  FrequencyHz,
  FrequencyUnit,
  ItuFrequencyRange,
} from "./frequency";
export {
  SPEED_OF_LIGHT_M_PER_S,
  frequencyFromWavelength,
  wavelengthMeters,
} from "./wavelength";
export type { WavelengthError, WavelengthErrorCode } from "./wavelength";
export { createBandPlan } from "./band-plan";
export type {
  Band,
  BandAllocation,
  BandData,
  BandMatch,
  BandPlan,
  BandPlanData,
} from "./band-plan";
export { IARU_REGION_1_BAND_PLAN } from "./iaru-region1";

/** Default band plan of the application (FR-HAM-02: IARU Region 1). */
export const iaruRegion1 = createBandPlan(IARU_REGION_1_BAND_PLAN);
