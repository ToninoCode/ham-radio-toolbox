import { ok, type Result } from "@/shared/types";
import {
  coordinates,
  type Coordinates,
  type CoordinatesError,
} from "./coordinates";

/**
 * Mean Earth radius R₁ = (2a + b) / 3 of the WGS84 ellipsoid, in km
 * (IUGG; Moritz, "Geodetic Reference System 1980").
 */
export const EARTH_MEAN_RADIUS_KM = 6371.0088;

export interface SphereOptions {
  /** Sphere radius in km; defaults to {@link EARTH_MEAN_RADIUS_KM}. */
  readonly radiusKm?: number;
}

/**
 * Distances and bearings use a spherical Earth: the error versus the WGS84
 * ellipsoid is below 0.5 %, well inside the uncertainty of a 6-character
 * locator and adequate for antenna pointing and QSO distances (FR-RFC-09).
 */
export interface GreatCirclePath {
  /** Short-path distance in km. */
  readonly distanceKm: number;
  /** Initial bearing from `from` to `to`, degrees clockwise from true north, [0, 360). */
  readonly azimuthDeg: number | undefined;
  /** Initial bearing from `to` back to `from` (reverse azimuth). */
  readonly reverseAzimuthDeg: number | undefined;
  /** Long-path distance: the rest of the great circle. */
  readonly longPathKm: number;
  /** Long-path azimuth: opposite to the short-path azimuth. */
  readonly longPathAzimuthDeg: number | undefined;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const normalizeDegrees = (degrees: number) => {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped === 0 ? 0 : wrapped;
};

/**
 * Central angle between two positions, in radians, with the haversine
 * formula (well conditioned for short distances, unlike the spherical law of
 * cosines). The clamp guards against rounding just above 1 near antipodes.
 */
export function centralAngle(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Short-path great-circle distance in km. Inputs must be valid coordinates. */
export function distanceKm(
  a: Coordinates,
  b: Coordinates,
  options: SphereOptions = {},
): number {
  return centralAngle(a, b) * (options.radiusKm ?? EARTH_MEAN_RADIUS_KM);
}

/** Below this central angle (≈ 6 mm) two points are treated as coincident. */
const COINCIDENT_RAD = 1e-9;

/**
 * Initial bearing from `a` to `b` in degrees [0, 360), clockwise from true
 * north. `undefined` when the direction is undefined: coincident or
 * antipodal points (every direction is a great circle to the antipode).
 */
export function initialBearingDeg(
  a: Coordinates,
  b: Coordinates,
): number | undefined {
  const angle = centralAngle(a, b);
  if (angle < COINCIDENT_RAD || Math.PI - angle < COINCIDENT_RAD) {
    return undefined;
  }
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLon = toRadians(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

/**
 * Short and long path between two positions, validating both (FR-RFC-09).
 * Longitude 180 is accepted and treated as -180.
 */
export function greatCirclePath(
  from: Coordinates,
  to: Coordinates,
  options: SphereOptions = {},
): Result<GreatCirclePath, CoordinatesError> {
  const a = coordinates(from.lat, from.lon);
  if (!a.ok) return a;
  const b = coordinates(to.lat, to.lon);
  if (!b.ok) return b;

  const radiusKm = options.radiusKm ?? EARTH_MEAN_RADIUS_KM;
  const distance = distanceKm(a.value, b.value, { radiusKm });
  const azimuth = initialBearingDeg(a.value, b.value);
  return ok({
    distanceKm: distance,
    azimuthDeg: azimuth,
    reverseAzimuthDeg: initialBearingDeg(b.value, a.value),
    longPathKm: 2 * Math.PI * radiusKm - distance,
    longPathAzimuthDeg:
      azimuth === undefined ? undefined : normalizeDegrees(azimuth + 180),
  });
}
