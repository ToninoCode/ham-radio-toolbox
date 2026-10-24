import { err, ok, type DomainError, type Result } from "@/shared/types";

/**
 * WGS84 position in decimal degrees (ADR-0005): `lat` ∈ [-90, 90],
 * `lon` ∈ [-180, 180) (DATABASE.md § 1; 180° is stored as -180°).
 */
export interface Coordinates {
  readonly lat: number;
  readonly lon: number;
}

export type CoordinatesErrorCode =
  | "coordinates.latitude-not-finite"
  | "coordinates.latitude-out-of-range"
  | "coordinates.longitude-not-finite"
  | "coordinates.longitude-out-of-range";

export type CoordinatesError = DomainError<CoordinatesErrorCode>;

export function isLatitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

/** Longitude in the stored range [-180, 180). */
export function isLongitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value < 180
  );
}

/**
 * Wraps any finite longitude into [-180, 180): 180 → -180, 190 → -170,
 * -190 → 170. Used by calculations whose result may leave the range.
 */
export function normalizeLongitude(lon: number): number {
  // Values already in range are returned untouched: the modular arithmetic
  // below can change them by one ulp, breaking round-trips of stored data.
  if (lon >= -180 && lon < 180) return lon === 0 ? 0 : lon;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Avoid -0 in persisted data and in equality checks.
  return wrapped === 0 ? 0 : wrapped;
}

/**
 * Validates a position. Latitude must be in [-90, 90]; longitude in
 * [-180, 180], with the 180° meridian normalised to -180° (same meridian).
 * Values outside these ranges are rejected, not wrapped: they usually mean
 * swapped or mistyped fields.
 */
export function coordinates(
  lat: unknown,
  lon: unknown,
): Result<Coordinates, CoordinatesError> {
  if (typeof lat !== "number" || !Number.isFinite(lat)) {
    return err({ code: "coordinates.latitude-not-finite" });
  }
  if (lat < -90 || lat > 90) {
    return err({ code: "coordinates.latitude-out-of-range" });
  }
  if (typeof lon !== "number" || !Number.isFinite(lon)) {
    return err({ code: "coordinates.longitude-not-finite" });
  }
  if (lon < -180 || lon > 180) {
    return err({ code: "coordinates.longitude-out-of-range" });
  }
  return ok({ lat: lat === 0 ? 0 : lat, lon: normalizeLongitude(lon) });
}
