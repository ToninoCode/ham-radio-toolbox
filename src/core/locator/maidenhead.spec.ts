// @vitest-environment node
import { describe, expect, it } from "vitest";
import { unwrap } from "@/shared/types";
import {
  coordinatesToLocator,
  isLocator,
  locatorPrecision,
  locatorToBounds,
  locatorToCenter,
  parseLocator,
  type Locator,
} from ".";

const loc = (text: string) => unwrap(parseLocator(text));
const toLocator = (lat: number, lon: number, precision?: 4 | 6 | 8) =>
  unwrap(coordinatesToLocator({ lat, lon }, precision));

describe("parseLocator / isLocator", () => {
  it.each([
    ["JN45", "JN45"],
    ["jn45", "JN45"],
    ["JN45dl", "JN45dl"],
    ["jn45DL", "JN45dl"],
    ["Jn45Dl", "JN45dl"],
    [" JN45dl ", "JN45dl"],
    ["JN45dl12", "JN45dl12"],
    ["jn45DL12", "JN45dl12"],
    ["AA00aa00", "AA00aa00"],
    ["RR99xx99", "RR99xx99"],
  ])("normalises %j to %j", (input, expected) => {
    expect(parseLocator(input)).toEqual({ ok: true, value: expected });
    expect(isLocator(expected)).toBe(true);
  });

  it.each([
    "",
    "J",
    "JN",
    "JN4",
    "JN45d",
    "JN45dl1",
    "JN45dl123",
    "JN45dl12ab",
    "SN45", // field beyond R
    "JS45",
    "JN4A",
    "JN45yl", // subsquare beyond X
    "JN45dy",
    "JN45dlA1",
    "45JN",
    "JN 45",
  ])("rejects %j", (input) => {
    expect(parseLocator(input)).toEqual({
      ok: false,
      error: { code: "locator.invalid-format" },
    });
  });

  it("isLocator rejects valid but non-normalised text and non-strings", () => {
    expect(isLocator("jn45dl")).toBe(false);
    expect(isLocator("JN45DL")).toBe(false);
    expect(isLocator(" JN45dl")).toBe(false);
    expect(isLocator(null)).toBe(false);
    expect(isLocator(45)).toBe(false);
  });

  it("reports the precision", () => {
    expect(locatorPrecision(loc("JN45"))).toBe(4);
    expect(locatorPrecision(loc("JN45dl"))).toBe(6);
    expect(locatorPrecision(loc("JN45dl12"))).toBe(8);
  });
});

describe("coordinatesToLocator — reference positions", () => {
  // W1AW, ARRL HQ, Newington CT: published grid FN31pr; position
  // 41°42′53″N 72°43′38″W ≈ (41.7147, -72.7272).
  // By hand, 8 chars: lon units (107.2728 × 120 = 12872.7 → 12872):
  // F(5) 3 p(15) 2; lat units (131.7147 × 240 = 31611.5 → 31611):
  // N(13) 1 r(17) 1 → FN31pr21.
  it("W1AW is FN31 / FN31pr / FN31pr21", () => {
    expect(toLocator(41.7147, -72.7272, 4)).toBe("FN31");
    expect(toLocator(41.7147, -72.7272, 6)).toBe("FN31pr");
    expect(toLocator(41.7147, -72.7272, 8)).toBe("FN31pr21");
  });

  // Munich (48.14666, 11.60833), by hand: 191.60833 / 20 → J, rem 11.608 / 2
  // → 5, rem 1.608 × 12 = 19.3 → t; 138.14666 / 10 → N, rem 8.1 → 8,
  // rem 0.14666 × 24 = 3.5 → d.
  it("Munich is JN58td", () => {
    expect(toLocator(48.14666, 11.60833)).toBe("JN58td");
  });

  // Southern and western hemispheres: Montevideo (-34.91, -56.21166):
  // 123.788 / 20 → G, rem 3.788 / 2 → 1, rem 1.788 × 12 = 21.5 → v;
  // 55.09 / 10 → F, rem 5.09 → 5, rem 0.09 × 24 = 2.2 → c.
  it("Montevideo is GF15vc", () => {
    expect(toLocator(-34.91, -56.21166)).toBe("GF15vc");
  });

  it("defaults to 6 characters", () => {
    expect(toLocator(48.14666, 11.60833)).toHaveLength(6);
  });
});

describe("coordinatesToLocator — edges of the grid", () => {
  it("maps the south-west corner to AA00aa00", () => {
    expect(toLocator(-90, -180, 8)).toBe("AA00aa00");
  });

  it("maps the north-east limit to RR99xx99", () => {
    expect(toLocator(90, 179.999999, 8)).toBe("RR99xx99");
  });

  it("assigns the north pole to the northernmost row", () => {
    expect(toLocator(90, 0, 8)).toBe("JR09ax09");
  });

  it("treats longitude 180 as -180 (same meridian)", () => {
    expect(toLocator(0, 180, 8)).toBe(toLocator(0, -180, 8));
    expect(toLocator(0, 180, 4)).toBe("AJ00");
  });

  it("assigns points on a cell edge to the cell to the north-east", () => {
    // lon 0 is the J/I field edge; lat 0 is the J/I field edge.
    expect(toLocator(0, 0, 4)).toBe("JJ00");
    expect(toLocator(-0.000001, -0.000001, 4)).toBe("II99");
    // 11.5° E is the edge between subsquares r and s (191.5 × 12 = 2298).
    expect(toLocator(45, 11.5, 6)).toBe("JN55sa");
    expect(toLocator(45, 11.4999999, 6)).toBe("JN55ra");
  });

  it("is stable on decimal edges affected by binary rounding", () => {
    // The edge between extended squares 0 and 1 in longitude is at 1/120°,
    // which has no exact binary representation.
    const edge = 1 / 120;
    expect(toLocator(0, edge, 8)).toBe("JJ00aa10");
    expect(toLocator(0, edge - 1e-6, 8)).toBe("JJ00aa00");
  });

  it("rejects invalid coordinates", () => {
    expect(coordinatesToLocator({ lat: 91, lon: 0 })).toEqual({
      ok: false,
      error: { code: "coordinates.latitude-out-of-range" },
    });
    expect(coordinatesToLocator({ lat: 0, lon: 180.5 })).toEqual({
      ok: false,
      error: { code: "coordinates.longitude-out-of-range" },
    });
    expect(coordinatesToLocator({ lat: Number.NaN, lon: 0 })).toEqual({
      ok: false,
      error: { code: "coordinates.latitude-not-finite" },
    });
    expect(
      coordinatesToLocator({ lat: 0, lon: Number.POSITIVE_INFINITY }),
    ).toEqual({
      ok: false,
      error: { code: "coordinates.longitude-not-finite" },
    });
  });
});

describe("locatorToBounds / locatorToCenter", () => {
  // By definition: field 20° × 10°, square 2° × 1°, subsquare 5′ × 2.5′,
  // extended square 30″ × 15″, from (-90, -180).
  it("JN45: 2° × 1° cell centred on (45.5, 9)", () => {
    expect(locatorToBounds(loc("JN45"))).toEqual({
      south: 45,
      west: 8,
      north: 46,
      east: 10,
    });
    expect(locatorToCenter(loc("JN45"))).toEqual({ lat: 45.5, lon: 9 });
  });

  it("JN45dl: 5′ × 2.5′ cell", () => {
    // West 8 + 3 × 5′ = 8.25°, south 45 + 11 × 2.5′ = 45.458333°.
    const bounds = locatorToBounds(loc("JN45dl"));
    expect(bounds.west).toBeCloseTo(8.25, 12);
    expect(bounds.east).toBeCloseTo(8.25 + 1 / 12, 12);
    expect(bounds.south).toBeCloseTo(45 + 11 / 24, 12);
    expect(bounds.north).toBeCloseTo(45 + 12 / 24, 12);
    const centre = locatorToCenter(loc("JN45dl"));
    expect(centre.lon).toBeCloseTo(8.291667, 6);
    expect(centre.lat).toBeCloseTo(45.479167, 6);
  });

  it("JN45dl12: 30″ × 15″ cell", () => {
    const bounds = locatorToBounds(loc("JN45dl12"));
    expect(bounds.west).toBeCloseTo(8.25 + 1 / 120, 12);
    expect(bounds.east - bounds.west).toBeCloseTo(1 / 120, 12);
    expect(bounds.south).toBeCloseTo(45 + 11 / 24 + 2 / 240, 12);
    expect(bounds.north - bounds.south).toBeCloseTo(1 / 240, 12);
  });

  it("covers the whole grid at the corners", () => {
    expect(locatorToBounds(loc("AA00"))).toEqual({
      south: -90,
      west: -180,
      north: -89,
      east: -178,
    });
    const last = locatorToBounds(loc("RR99xx99"));
    expect(last.south).toBeCloseTo(90 - 1 / 240, 12);
    expect(last.west).toBeCloseTo(180 - 1 / 120, 12);
    expect(last.north).toBe(90);
    expect(last.east).toBe(180);
  });

  it("returns the cell centre, not the original position", () => {
    const munich = { lat: 48.14666, lon: 11.60833 };
    const centre = locatorToCenter(toLocator(munich.lat, munich.lon));
    expect(centre).not.toEqual(munich);
    // Error bounded by half a subsquare: 2.5′ in longitude, 1.25′ in latitude.
    expect(Math.abs(centre.lon - munich.lon)).toBeLessThanOrEqual(1 / 24);
    expect(Math.abs(centre.lat - munich.lat)).toBeLessThanOrEqual(1 / 48);
  });

  it("round-trips locator → centre → locator at every precision", () => {
    const samples: Locator[] = [
      "AA00",
      "JN45",
      "RR99",
      "FN31pr",
      "GF15vc",
      "JN45dl",
      "AA00aa00",
      "JN45dl12",
      "RR99xx99",
    ].map(loc);
    for (const locator of samples) {
      const precision = locatorPrecision(locator);
      expect(
        unwrap(coordinatesToLocator(locatorToCenter(locator), precision)),
      ).toBe(locator);
    }
  });
});
