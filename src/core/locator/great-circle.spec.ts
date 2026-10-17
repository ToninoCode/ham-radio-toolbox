// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unwrap } from "@/shared/types";
import {
  EARTH_MEAN_RADIUS_KM,
  centralAngle,
  distanceKm,
  greatCirclePath,
  initialBearingDeg,
  locatorToCenter,
  parseLocator,
} from ".";

const R = EARTH_MEAN_RADIUS_KM;

describe("distanceKm — published references", () => {
  // Rosetta Code, "Haversine formula": Nashville BNA (36.12, -86.67) to
  // Los Angeles LAX (33.94, -118.40) with R = 6372.8 km → 2887.2599506071106 km.
  it("BNA → LAX matches the Rosetta Code haversine reference", () => {
    expect(
      distanceKm(
        { lat: 36.12, lon: -86.67 },
        { lat: 33.94, lon: -118.4 },
        { radiusKm: 6372.8 },
      ),
    ).toBeCloseTo(2887.2599506071106, 9);
  });

  // Ed Williams, "Aviation Formulary", worked example LAX (33°57′N 118°24′W)
  // → JFK (40°38′N 73°47′W): d = 0.623585 rad (2144 nm), initial true
  // course 1.150035 rad = 66°.
  const LAX = { lat: 33 + 57 / 60, lon: -(118 + 24 / 60) };
  const JFK = { lat: 40 + 38 / 60, lon: -(73 + 47 / 60) };

  it("LAX → JFK central angle matches the Aviation Formulary", () => {
    expect(centralAngle(LAX, JFK)).toBeCloseTo(0.623585, 6);
    // 1 nautical mile = 1′ of arc on the sphere.
    expect(centralAngle(LAX, JFK) * ((180 * 60) / Math.PI)).toBeCloseTo(
      2144,
      0,
    );
  });

  it("LAX → JFK initial course matches the Aviation Formulary", () => {
    const course = initialBearingDeg(LAX, JFK);
    expect(course).toBeDefined();
    expect(((course ?? 0) * Math.PI) / 180).toBeCloseTo(1.150035, 6);
  });
});

describe("distanceKm — geometric identities on the sphere", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ lat: 45, lon: 9 }, { lat: 45, lon: 9 })).toBe(0);
  });

  it("1° along a meridian is R × π / 180", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(
      (R * Math.PI) / 180,
      9,
    );
  });

  it("a quarter of the equator is R × π / 2", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo(
      (R * Math.PI) / 2,
      9,
    );
  });

  it("pole to pole and antipodes are R × π", () => {
    expect(distanceKm({ lat: 90, lon: 0 }, { lat: -90, lon: 0 })).toBeCloseTo(
      R * Math.PI,
      9,
    );
    expect(
      distanceKm({ lat: 45, lon: 9 }, { lat: -45, lon: -171 }),
    ).toBeCloseTo(R * Math.PI, 6);
  });

  it("is symmetric and handles the antimeridian", () => {
    const a = { lat: 10, lon: 179.5 };
    const b = { lat: 10, lon: -179.5 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 12);
    // 1° of longitude at 10°N, not 359°.
    expect(distanceKm(a, b)).toBeLessThan(120);
  });
});

describe("initialBearingDeg", () => {
  const origin = { lat: 0, lon: 0 };

  it.each([
    [{ lat: 10, lon: 0 }, 0],
    [{ lat: 0, lon: 10 }, 90],
    [{ lat: -10, lon: 0 }, 180],
    [{ lat: 0, lon: -10 }, 270],
  ])("cardinal direction to %o is %d°", (to, expected) => {
    expect(initialBearingDeg(origin, to)).toBeCloseTo(expected, 9);
  });

  it("always points south from the north pole and north from the south pole", () => {
    expect(
      initialBearingDeg({ lat: 90, lon: 0 }, { lat: 45, lon: 0 }),
    ).toBeCloseTo(180, 9);
    expect(
      initialBearingDeg({ lat: -90, lon: 0 }, { lat: -45, lon: 0 }),
    ).toBeCloseTo(0, 9);
  });

  it("crosses the antimeridian eastwards", () => {
    expect(
      initialBearingDeg({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 }),
    ).toBeCloseTo(90, 9);
  });

  it("is undefined for coincident and antipodal points", () => {
    expect(initialBearingDeg(origin, origin)).toBeUndefined();
    expect(initialBearingDeg(origin, { lat: 0, lon: 180 })).toBeUndefined();
    expect(
      initialBearingDeg({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }),
    ).toBeUndefined();
  });

  it("returns values in [0, 360)", () => {
    const bearing = initialBearingDeg(
      { lat: 0, lon: 0 },
      { lat: 0.001, lon: -0.000001 },
    );
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe("greatCirclePath", () => {
  it("returns short path, reverse azimuth and long path", () => {
    const path = unwrap(
      greatCirclePath({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }),
    );
    expect(path.distanceKm).toBeCloseTo((R * Math.PI) / 2, 9);
    expect(path.azimuthDeg).toBeCloseTo(90, 9);
    expect(path.reverseAzimuthDeg).toBeCloseTo(270, 9);
    expect(path.longPathKm).toBeCloseTo((3 * R * Math.PI) / 2, 9);
    expect(path.longPathAzimuthDeg).toBeCloseTo(270, 9);
    expect(path.distanceKm + path.longPathKm).toBeCloseTo(2 * Math.PI * R, 9);
  });

  it("reverse azimuth differs from azimuth + 180 off the equator", () => {
    // Great circles are not rhumb lines: LAX → JFK 66°, JFK → LAX ≈ 274°.
    const path = unwrap(
      greatCirclePath(
        { lat: 33 + 57 / 60, lon: -(118 + 24 / 60) },
        { lat: 40 + 38 / 60, lon: -(73 + 47 / 60) },
      ),
    );
    expect(path.reverseAzimuthDeg).toBeDefined();
    expect(path.reverseAzimuthDeg).not.toBeCloseTo(
      ((path.azimuthDeg ?? 0) + 180) % 360,
      0,
    );
  });

  it("works between locator centres (FR-RFC-09)", () => {
    const jn45 = locatorToCenter(unwrap(parseLocator("JN45"))); // (45.5, 9)
    const jn55 = locatorToCenter(unwrap(parseLocator("JN55"))); // (45.5, 11)
    const path = unwrap(greatCirclePath(jn45, jn55));
    // 2° of longitude at 45.5°N: slightly less than R·cos(45.5°)·2° on a parallel.
    expect(path.distanceKm).toBeLessThan(
      R * Math.cos((45.5 * Math.PI) / 180) * (Math.PI / 90),
    );
    expect(path.distanceKm).toBeGreaterThan(155);
    expect(path.azimuthDeg).toBeGreaterThan(89);
    expect(path.azimuthDeg).toBeLessThan(90);
  });

  it("accepts longitude 180 as -180", () => {
    const a = unwrap(greatCirclePath({ lat: 0, lon: 180 }, { lat: 0, lon: 0 }));
    const b = unwrap(
      greatCirclePath({ lat: 0, lon: -180 }, { lat: 0, lon: 0 }),
    );
    expect(a).toEqual(b);
  });

  it("leaves azimuths undefined for coincident points", () => {
    const path = unwrap(
      greatCirclePath({ lat: 45, lon: 9 }, { lat: 45, lon: 9 }),
    );
    expect(path.distanceKm).toBe(0);
    expect(path.azimuthDeg).toBeUndefined();
    expect(path.reverseAzimuthDeg).toBeUndefined();
    expect(path.longPathAzimuthDeg).toBeUndefined();
  });

  it("rejects invalid coordinates on either end", () => {
    expect(greatCirclePath({ lat: 100, lon: 0 }, { lat: 0, lon: 0 })).toEqual({
      ok: false,
      error: { code: "coordinates.latitude-out-of-range" },
    });
    expect(
      greatCirclePath({ lat: 0, lon: 0 }, { lat: 0, lon: Number.NaN }),
    ).toEqual({
      ok: false,
      error: { code: "coordinates.longitude-not-finite" },
    });
  });
});
