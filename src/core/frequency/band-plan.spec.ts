// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  IARU_REGION_1_BAND_PLAN,
  createBandPlan,
  iaruRegion1,
  type BandPlanData,
  type FrequencyHz,
} from ".";

const hz = (value: number) => value as FrequencyHz;

/**
 * Reference edges (inclusive, Hz) from the IARU Region 1 HF band plan
 * (revision 2016) and VHF/UHF band plan (edition 2020). Duplicated here on
 * purpose: a change to the data file must be a conscious change to the test.
 */
const REFERENCE_EDGES: readonly [string, number, number][] = [
  ["2190m", 135_700, 137_800],
  ["630m", 472_000, 479_000],
  ["160m", 1_810_000, 2_000_000],
  ["80m", 3_500_000, 3_800_000],
  ["60m", 5_351_500, 5_366_500],
  ["40m", 7_000_000, 7_200_000],
  ["30m", 10_100_000, 10_150_000],
  ["20m", 14_000_000, 14_350_000],
  ["17m", 18_068_000, 18_168_000],
  ["15m", 21_000_000, 21_450_000],
  ["12m", 24_890_000, 24_990_000],
  ["10m", 28_000_000, 29_700_000],
  ["6m", 50_000_000, 52_000_000],
  ["4m", 70_000_000, 70_500_000],
  ["2m", 144_000_000, 146_000_000],
  ["70cm", 430_000_000, 440_000_000],
  ["23cm", 1_240_000_000, 1_300_000_000],
  ["13cm", 2_300_000_000, 2_450_000_000],
];

describe("IARU Region 1 band plan", () => {
  it("contains exactly the reference bands, ordered by frequency", () => {
    expect(iaruRegion1.bands.map((b) => [b.id, b.lowerHz, b.upperHz])).toEqual(
      REFERENCE_EDGES,
    );
  });

  describe.each(REFERENCE_EDGES)("%s", (id, lower, upper) => {
    it("includes both edges and the centre", () => {
      expect(iaruRegion1.findBand(hz(lower))?.id).toBe(id);
      expect(iaruRegion1.findBand(hz(upper))?.id).toBe(id);
      expect(
        iaruRegion1.findBand(hz(Math.round((lower + upper) / 2)))?.id,
      ).toBe(id);
    });

    it("excludes 1 Hz below the lower edge and 1 Hz above the upper edge", () => {
      expect(iaruRegion1.findBand(hz(lower - 1))).toBeUndefined();
      expect(iaruRegion1.findBand(hz(upper + 1))).toBeUndefined();
    });

    it("is retrievable by its ADIF id", () => {
      expect(iaruRegion1.getBand(id)).toMatchObject({
        id,
        lowerHz: lower,
        upperHz: upper,
      });
    });
  });

  it("recognises common operating frequencies", () => {
    expect(iaruRegion1.findBand(hz(14_074_000))?.id).toBe("20m"); // FT8
    expect(iaruRegion1.findBand(hz(7_074_000))?.id).toBe("40m"); // FT8
    expect(iaruRegion1.findBand(hz(145_500_000))?.id).toBe("2m"); // FM calling
    expect(iaruRegion1.findBand(hz(432_200_000))?.id).toBe("70cm"); // SSB centre
  });

  it("does not recognise Region 2 extensions outside Region 1 edges", () => {
    // 3.9 MHz (80 m in Region 2) and 7.25 MHz (40 m in Region 2).
    expect(iaruRegion1.findBand(hz(3_900_000))).toBeUndefined();
    expect(iaruRegion1.findBand(hz(7_250_000))).toBeUndefined();
    // 146–148 MHz and 50–54 MHz belong to Region 2 only.
    expect(iaruRegion1.findBand(hz(147_000_000))).toBeUndefined();
    expect(iaruRegion1.findBand(hz(53_000_000))).toBeUndefined();
  });

  it("reports bands above 2450 MHz as out of band (not yet verified)", () => {
    expect(iaruRegion1.findBand(hz(10_368_000_000))).toBeUndefined();
  });

  it("marks 4 m as national (no ITU allocation in Region 1)", () => {
    expect(iaruRegion1.getBand("4m")?.allocation).toBe("national");
    expect(
      iaruRegion1.bands
        .filter((b) => b.allocation === "national")
        .map((b) => b.id),
    ).toEqual(["4m"]);
  });

  it("exposes its sources and verification date", () => {
    expect(iaruRegion1.id).toBe("iaru-r1");
    expect(iaruRegion1.sources.length).toBeGreaterThan(0);
    expect(iaruRegion1.verifiedOn).toBe("2026-10-17");
  });

  it("returns undefined for an unknown id", () => {
    expect(iaruRegion1.getBand("11m")).toBeUndefined();
  });
});

describe("classify", () => {
  it("returns the band for an in-band frequency", () => {
    expect(iaruRegion1.classify(hz(14_074_000))).toMatchObject({
      kind: "in-band",
      band: { id: "20m" },
    });
  });

  it("returns the nearest bands around an out-of-band frequency", () => {
    const match = iaruRegion1.classify(hz(27_555_000)); // CB, 11 m
    expect(match.kind).toBe("out-of-band");
    if (match.kind !== "out-of-band") return;
    expect(match.below?.id).toBe("12m");
    expect(match.above?.id).toBe("10m");
  });

  it("omits the missing neighbour at the ends of the plan", () => {
    expect(iaruRegion1.classify(hz(0))).toEqual({
      kind: "out-of-band",
      above: iaruRegion1.getBand("2190m"),
    });
    expect(iaruRegion1.classify(hz(5_000_000_000))).toEqual({
      kind: "out-of-band",
      below: iaruRegion1.getBand("13cm"),
    });
  });
});

describe("createBandPlan", () => {
  const base: BandPlanData = {
    id: "test",
    sources: [],
    verifiedOn: "2026-10-17",
    bands: [],
  };

  it("sorts unordered data", () => {
    const plan = createBandPlan({
      ...base,
      bands: [
        IARU_REGION_1_BAND_PLAN.bands[3]!,
        IARU_REGION_1_BAND_PLAN.bands[0]!,
      ],
    });
    expect(plan.bands.map((b) => b.id)).toEqual(["2190m", "80m"]);
  });

  it.each([
    [
      { id: "x", lowerHz: 10, upperHz: 5, allocation: "itu" as const },
      /Invalid edges/,
    ],
    [
      { id: "x", lowerHz: -1, upperHz: 5, allocation: "itu" as const },
      /Invalid edges/,
    ],
    [
      { id: "x", lowerHz: 1.5, upperHz: 5, allocation: "itu" as const },
      /Invalid edges/,
    ],
  ])("rejects invalid edges %#", (band, message) => {
    expect(() => createBandPlan({ ...base, bands: [band] })).toThrow(message);
  });

  it("rejects duplicate ids and overlapping bands", () => {
    const a = { id: "a", lowerHz: 0, upperHz: 10, allocation: "itu" as const };
    expect(() =>
      createBandPlan({
        ...base,
        bands: [a, { ...a, lowerHz: 20, upperHz: 30 }],
      }),
    ).toThrow(/Duplicate band a/);
    expect(() =>
      createBandPlan({
        ...base,
        bands: [a, { id: "b", lowerHz: 10, upperHz: 30, allocation: "itu" }],
      }),
    ).toThrow(/overlap/);
  });
});
