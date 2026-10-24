// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Callsign } from "@/core/callsign";
import type { Locator } from "@/core/locator";
import { issueCode } from "@/core/validation";
import { stationProfileSchema, type StationProfile } from "./station-profile";

const valid = {
  id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
  name: "Casa",
  kind: "ham",
  callsign: "iz1abc",
  locator: "jn45DL",
  lat: 45.5,
  lon: 9.2,
  positionSource: "manual",
  equipment: { rig: "FT-991A", antenna: "Dipolo 40 m", powerW: 100 },
  isDefault: 1,
  createdAt: "2026-10-24T10:00:00Z",
  updatedAt: "2026-10-24T10:00:00Z",
};

const codes = (value: unknown) =>
  stationProfileSchema.safeParse(value).error?.issues.map(issueCode) ?? [];

describe("stationProfileSchema", () => {
  it("normalises and brands the fields", () => {
    const profile = stationProfileSchema.parse(valid);
    expect(profile).toMatchObject({ callsign: "IZ1ABC", locator: "JN45dl" });
    expectTypeOf<StationProfile["callsign"]>().toEqualTypeOf<
      Callsign | undefined
    >();
    expectTypeOf<StationProfile["locator"]>().toEqualTypeOf<
      Locator | undefined
    >();
  });

  it("is idempotent on canonical records (restore)", () => {
    const profile = stationProfileSchema.parse(valid);
    expect(stationProfileSchema.parse(profile)).toEqual(profile);
  });

  it("requires a callsign unless the station is SWL only", () => {
    const { callsign: _callsign, ...withoutCallsign } = valid;
    expect(codes({ ...withoutCallsign, kind: "both" })).toEqual([
      "station-profile.callsign-required",
    ]);
    expect(codes({ ...withoutCallsign, kind: "swl" })).toEqual([]);
  });

  it("checks zones, the default flag and position consistency", () => {
    expect(codes({ ...valid, cqZone: 41 })).toEqual(["zod.too_big"]);
    expect(codes({ ...valid, ituZone: 0 })).toEqual(["zod.too_small"]);
    expect(codes({ ...valid, isDefault: true })).toEqual(["zod.invalid_union"]);
    const { lat: _lat, lon: _lon, ...withoutPosition } = valid;
    expect(codes(withoutPosition)).toEqual(["fields.incomplete-group"]);
  });
});
