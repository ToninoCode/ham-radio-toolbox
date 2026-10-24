// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";
import type { FrequencyHz } from "@/core/frequency";
import type { UtcDateTime } from "@/core/time";
import { issueCode } from "@/core/validation";
import { qsoLogSchema, type QsoLog } from "./qso-log";

const valid = {
  id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
  stationProfileId: "3c8b2c8f-5b4a-4d3e-8f9a-1b2c3d4e5f60",
  callsign: "ea8/iz1abc/p",
  datetimeOn: "2026-10-24 13:21Z",
  datetimeOff: "2026-10-24T13:25:00Z",
  frequencyHz: 7_074_000,
  band: "40M",
  mode: "ft8",
  rstSent: "-05",
  rstRcvd: "+02",
  gridsquare: "IL18",
  continent: "AF",
  dxcc: 29,
  cqZone: 33,
  ituZone: 36,
  potaRef: "ES-0001",
  adifExtra: { MY_ANTENNA: "EFHW" },
  origin: "adif-import",
  importJobId: "4d9c3d9f-6c5b-4e4f-9a0b-2c3d4e5f6071",
  createdAt: "2026-10-24T13:30:00Z",
  updatedAt: "2026-10-24T13:30:00Z",
};

const codes = (value: unknown) =>
  qsoLogSchema.safeParse(value).error?.issues.map(issueCode) ?? [];

describe("qsoLogSchema", () => {
  it("stores canonical values: callsign, band, mode, UTC, reports", () => {
    const qso = qsoLogSchema.parse(valid);
    expect(qso).toMatchObject({
      callsign: "EA8/IZ1ABC/P",
      band: "40m",
      mode: "FT8",
      datetimeOn: "2026-10-24T13:21:00Z",
      rstSent: "-05",
      rstRcvd: "+02",
      gridsquare: "IL18",
    });
    expectTypeOf<QsoLog["frequencyHz"]>().toEqualTypeOf<FrequencyHz>();
    expectTypeOf<QsoLog["datetimeOn"]>().toEqualTypeOf<UtcDateTime>();
  });

  it("is idempotent on canonical records (restore)", () => {
    const qso = qsoLogSchema.parse(valid);
    expect(qsoLogSchema.parse(qso)).toEqual(qso);
  });

  it.each([
    ["band", "20 metri"],
    ["mode", "S S B"],
    ["continent", "EU1"],
    ["origin", "clipboard"],
  ])("rejects an invalid %s", (field, value) => {
    expect(codes({ ...valid, [field]: value }).length).toBe(1);
  });

  it("rejects a frequency in kHz passed as a fraction of Hz", () => {
    expect(codes({ ...valid, frequencyHz: 7074.0005 })).toEqual([
      "frequency.not-integer",
    ]);
  });

  it("rejects unknown fields: unmapped ADIF data goes in adifExtra", () => {
    expect(codes({ ...valid, MY_RIG: "IC-705" })).toEqual([
      "zod.unrecognized_keys",
    ]);
  });
});
