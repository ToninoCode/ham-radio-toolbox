import {
  err,
  ok,
  type Brand,
  type DomainError,
  type Result,
} from "@/shared/types";
import {
  coordinates,
  type Coordinates,
  type CoordinatesError,
} from "./coordinates";

/**
 * Maidenhead locator, validated and normalised (ADR-0005): field and square
 * upper case/digits, subsquare lower case, extended square digits —
 * `JN45`, `JN45dl`, `JN45dl12`.
 */
export type Locator = Brand<string, "Locator">;

/** Number of characters: 4 (square), 6 (subsquare), 8 (extended square). */
export type LocatorPrecision = 4 | 6 | 8;

export const LOCATOR_PRECISIONS: readonly LocatorPrecision[] = [4, 6, 8];

export type LocatorErrorCode = "locator.invalid-format";

export type LocatorError = DomainError<LocatorErrorCode>;

/** South-west / north-east corners of a locator cell, in degrees. */
export interface LocatorBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/*
 * Grid arithmetic is done on integers at the finest resolution (8 chars):
 * longitude in units of 1/120° (30″), latitude in units of 1/240° (15″).
 * Both axes have 18 × 10 × 24 × 10 = 43 200 units.
 */
const LON_UNITS_PER_DEGREE = 120;
const LAT_UNITS_PER_DEGREE = 240;
const UNITS_PER_AXIS = 43_200;
const FIELD_UNITS = 2400; // 18 fields
const SQUARE_UNITS = 240; // 10 squares per field
const SUBSQUARE_UNITS = 10; // 24 subsquares per square
const CELL_UNITS: Readonly<Record<LocatorPrecision, number>> = {
  4: SQUARE_UNITS,
  6: SUBSQUARE_UNITS,
  8: 1,
};

/**
 * Tolerance, in grid units, against binary representation error of decimal
 * inputs that lie exactly on a cell edge (e.g. 191.6 × 120). 1e-9 units is
 * about 1 mm on the ground, far below the 8-character cell (~900 m × 460 m).
 */
const EDGE_EPSILON = 1e-9;

const LOCATOR_PATTERN = /^[A-R]{2}[0-9]{2}(?:[A-X]{2}(?:[0-9]{2})?)?$/;

const A = "A".charCodeAt(0);

function normalizeCase(text: string): string {
  const upper = text.toUpperCase();
  return upper.slice(0, 4) + upper.slice(4, 6).toLowerCase() + upper.slice(6);
}

/** True for a locator that is valid and already normalised. */
export function isLocator(value: unknown): value is Locator {
  return (
    typeof value === "string" &&
    LOCATOR_PATTERN.test(value.toUpperCase()) &&
    value === normalizeCase(value)
  );
}

/**
 * Validates a 4, 6 or 8 character locator in any letter case, ignoring
 * surrounding spaces, and returns it normalised ("jn45DL" → "JN45dl").
 */
export function parseLocator(text: string): Result<Locator, LocatorError> {
  const trimmed = text.trim();
  if (!LOCATOR_PATTERN.test(trimmed.toUpperCase())) {
    return err({ code: "locator.invalid-format" });
  }
  return ok(normalizeCase(trimmed) as Locator);
}

export function locatorPrecision(locator: Locator): LocatorPrecision {
  return locator.length as LocatorPrecision;
}

function toUnits(value: number, unitsPerDegree: number): number {
  const units = Math.floor(value * unitsPerDegree + EDGE_EPSILON);
  return Math.min(Math.max(units, 0), UNITS_PER_AXIS - 1);
}

function encodeAxis(units: number, precision: LocatorPrecision): string[] {
  const field = String.fromCharCode(A + Math.floor(units / FIELD_UNITS));
  const square = String(Math.floor((units % FIELD_UNITS) / SQUARE_UNITS));
  const subsquare = String.fromCharCode(
    A + Math.floor((units % SQUARE_UNITS) / SUBSQUARE_UNITS),
  ).toLowerCase();
  const extended = String(units % SUBSQUARE_UNITS);
  return [field, square, subsquare, extended].slice(0, precision / 2);
}

/**
 * Locator of the cell containing a WGS84 position. Cell edges belong to the
 * cell to the north/east; the north pole (lat 90) is assigned to the
 * northernmost row and longitude 180 to the -180 meridian.
 */
export function coordinatesToLocator(
  position: Coordinates,
  precision: LocatorPrecision = 6,
): Result<Locator, CoordinatesError> {
  const checked = coordinates(position.lat, position.lon);
  if (!checked.ok) return checked;

  const lon = encodeAxis(
    toUnits(checked.value.lon + 180, LON_UNITS_PER_DEGREE),
    precision,
  );
  const lat = encodeAxis(
    toUnits(checked.value.lat + 90, LAT_UNITS_PER_DEGREE),
    precision,
  );
  const pairs = lon.map((l, i) => `${l}${lat[i] ?? ""}`);
  return ok(pairs.join("") as Locator);
}

function decodeAxis(chars: readonly string[]): number {
  const [field = "A", square = "0", subsquare, extended] = chars;
  let units =
    (field.charCodeAt(0) - A) * FIELD_UNITS + Number(square) * SQUARE_UNITS;
  if (subsquare) {
    units += (subsquare.toUpperCase().charCodeAt(0) - A) * SUBSQUARE_UNITS;
  }
  if (extended) units += Number(extended);
  return units;
}

/** Corners of the cell identified by the locator. */
export function locatorToBounds(locator: Locator): LocatorBounds {
  const chars = [...locator];
  const lonChars = chars.filter((_, i) => i % 2 === 0);
  const latChars = chars.filter((_, i) => i % 2 === 1);
  const cell = CELL_UNITS[locatorPrecision(locator)];

  const westUnits = decodeAxis(lonChars);
  const southUnits = decodeAxis(latChars);
  return {
    west: westUnits / LON_UNITS_PER_DEGREE - 180,
    east: (westUnits + cell) / LON_UNITS_PER_DEGREE - 180,
    south: southUnits / LAT_UNITS_PER_DEGREE - 90,
    north: (southUnits + cell) / LAT_UNITS_PER_DEGREE - 90,
  };
}

/**
 * Centre of the locator cell. This is not the original position: a
 * locator only identifies a cell (4 chars: 2° × 1°, about 160 × 110 km at
 * 45°N; 6 chars: 5′ × 2.5′; 8 chars: 30″ × 15″), so the centre is the best
 * estimate, with an error up to half the cell size.
 */
export function locatorToCenter(locator: Locator): Coordinates {
  const { south, west, north, east } = locatorToBounds(locator);
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}
