// @vitest-environment node
import { describe, expect, it } from "vitest";
import { coordinates, isLatitude, isLongitude, normalizeLongitude } from ".";

describe("coordinates", () => {
  it("accepts the full valid range, poles included", () => {
    for (const [lat, lon] of [
      [0, 0],
      [90, 0],
      [-90, 0],
      [45.5, -179.999],
      [-33.86, 151.21],
    ] as const) {
      expect(coordinates(lat, lon)).toEqual({ ok: true, value: { lat, lon } });
    }
  });

  it("normalises longitude 180 to -180 (DATABASE.md: lon ∈ [-180, 180))", () => {
    expect(coordinates(10, 180)).toEqual({
      ok: true,
      value: { lat: 10, lon: -180 },
    });
    expect(coordinates(10, -180)).toEqual({
      ok: true,
      value: { lat: 10, lon: -180 },
    });
  });

  it("removes negative zero", () => {
    const result = coordinates(-0, -0);
    expect(result.ok && Object.is(result.value.lat, 0)).toBe(true);
    expect(result.ok && Object.is(result.value.lon, 0)).toBe(true);
  });

  it.each([
    [Number.NaN, 0, "coordinates.latitude-not-finite"],
    [Number.POSITIVE_INFINITY, 0, "coordinates.latitude-not-finite"],
    [null, 0, "coordinates.latitude-not-finite"],
    [undefined, 0, "coordinates.latitude-not-finite"],
    ["45", 0, "coordinates.latitude-not-finite"],
    [90.000001, 0, "coordinates.latitude-out-of-range"],
    [-91, 0, "coordinates.latitude-out-of-range"],
    [0, Number.NaN, "coordinates.longitude-not-finite"],
    [0, Number.NEGATIVE_INFINITY, "coordinates.longitude-not-finite"],
    [0, null, "coordinates.longitude-not-finite"],
    [0, 180.000001, "coordinates.longitude-out-of-range"],
    [0, -180.5, "coordinates.longitude-out-of-range"],
    [0, 360, "coordinates.longitude-out-of-range"],
  ])("rejects (%s, %s) with %s", (lat, lon, code) => {
    expect(coordinates(lat, lon)).toEqual({ ok: false, error: { code } });
  });
});

describe("isLatitude / isLongitude", () => {
  it("checks the stored ranges", () => {
    expect(isLatitude(90)).toBe(true);
    expect(isLatitude(-90)).toBe(true);
    expect(isLatitude(90.1)).toBe(false);
    expect(isLatitude(Number.NaN)).toBe(false);
    expect(isLongitude(-180)).toBe(true);
    expect(isLongitude(179.9999)).toBe(true);
    expect(isLongitude(180)).toBe(false);
    expect(isLongitude("0")).toBe(false);
  });
});

describe("normalizeLongitude", () => {
  it.each([
    [0, 0],
    [180, -180],
    [-180, -180],
    [190, -170],
    [-190, 170],
    [360, 0],
    [540, -180],
    [-720, 0],
    [179.5, 179.5],
  ])("%d → %d", (input, expected) => {
    expect(normalizeLongitude(input)).toBe(expected);
  });

  it("returns in-range values bit-for-bit unchanged", () => {
    for (const lon of [-179.999, 151.21, -72.7272, 179.99999999]) {
      expect(normalizeLongitude(lon)).toBe(lon);
    }
  });

  it("never returns negative zero", () => {
    expect(Object.is(normalizeLongitude(-360), 0)).toBe(true);
  });
});
