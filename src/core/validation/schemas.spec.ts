// @vitest-environment node
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { Callsign } from "@/core/callsign";
import type { FrequencyHz } from "@/core/frequency";
import type { Locator } from "@/core/locator";
import type { UtcDateTime } from "@/core/time";
import {
  callsignSchema,
  catalogKeySchema,
  coordinatesSchema,
  frequencyHzSchema,
  indexedFlagSchema,
  issueCode,
  latitudeSchema,
  locatorSchema,
  longitudeSchema,
  minuteOfDaySchema,
  provenanceSchema,
  sampleFlagSchema,
  sha256HexSchema,
  signalReportSchema,
  signalReportSchemaFor,
  sinpoCodeSchema,
  timestampsSchema,
  utcDateSchema,
  utcDateTimeSchema,
  uuidSchema,
} from ".";

/** Codes of all issues of a failed parse (empty array on success). */
function codes(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map(issueCode);
}

describe("uuidSchema", () => {
  it("accepts UUID v4 as produced by crypto.randomUUID()", () => {
    expect(uuidSchema.parse("2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f")).toBe(
      "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
    );
    const generated = globalThis.crypto.randomUUID();
    expect(uuidSchema.parse(generated)).toBe(generated);
  });

  it.each([
    "2b7a1b7e-4a3f-1c2d-9e8f-0a1b2c3d4e5f", // version 1
    "2b7a1b7e-4a3f-4c2d-7e8f-0a1b2c3d4e5f", // invalid variant
    "2b7a1b7e4a3f4c2d9e8f0a1b2c3d4e5f",
    "",
    "not-a-uuid",
  ])("rejects %j", (value) => {
    expect(uuidSchema.safeParse(value).success).toBe(false);
  });

  it("rejects non-strings, null and undefined", () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(codes(uuidSchema, value)).toEqual(["zod.invalid_type"]);
    }
  });
});

describe("catalogKeySchema / sha256HexSchema", () => {
  it("accepts kebab-case keys and rejects anything else", () => {
    for (const key of ["app", "eibi", "hfcc", "data-sources", "a1"]) {
      expect(catalogKeySchema.safeParse(key).success).toBe(true);
    }
    for (const key of ["", "App", "1app", "a_b", "a--b", "a-", "a.b"]) {
      expect(catalogKeySchema.safeParse(key).success).toBe(false);
    }
  });

  it("accepts lower-case 64-digit hex digests", () => {
    // SHA-256 of the empty string (FIPS 180-4 test vector).
    const empty =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(sha256HexSchema.parse(empty)).toBe(empty);
    expect(sha256HexSchema.safeParse(empty.toUpperCase()).success).toBe(false);
    expect(sha256HexSchema.safeParse(empty.slice(1)).success).toBe(false);
  });
});

describe("frequencyHzSchema", () => {
  it("accepts whole hertz and types the result as FrequencyHz", () => {
    const value = frequencyHzSchema.parse(14_074_000);
    expect(value).toBe(14_074_000);
    expectTypeOf(value).toEqualTypeOf<FrequencyHz>();
  });

  it.each([
    [-1, "frequency.negative"],
    [7.5, "frequency.not-integer"],
    [Number.MAX_SAFE_INTEGER + 1, "frequency.too-large"],
  ])("rejects %s with %s", (value, code) => {
    expect(codes(frequencyHzSchema, value)).toEqual([code]);
  });

  it("rejects NaN, infinities, strings and missing values as invalid types", () => {
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "14074000",
      null,
      undefined,
    ]) {
      expect(codes(frequencyHzSchema, value)).toEqual(["zod.invalid_type"]);
    }
  });
});

describe("callsignSchema", () => {
  it("normalises and brands", () => {
    const value = callsignSchema.parse(" iz0abc/p ");
    expect(value).toBe("IZ0ABC/P");
    expectTypeOf(value).toEqualTypeOf<Callsign>();
  });

  it("is idempotent on canonical values", () => {
    expect(callsignSchema.parse(callsignSchema.parse("hb9/iz0abc"))).toBe(
      "HB9/IZ0ABC",
    );
  });

  it("reports domain codes", () => {
    expect(codes(callsignSchema, "")).toEqual(["callsign.empty"]);
    expect(codes(callsignSchema, "IZ0-ABC")).toEqual([
      "callsign.invalid-characters",
    ]);
    expect(codes(callsignSchema, "ABC")).toEqual(["callsign.invalid-format"]);
    expect(codes(callsignSchema, null)).toEqual(["zod.invalid_type"]);
  });

  it("keeps the domain code in message and params", () => {
    const result = callsignSchema.safeParse("ABC");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      code: "custom",
      message: "callsign.invalid-format",
      params: { code: "callsign.invalid-format" },
    });
  });
});

describe("locatorSchema", () => {
  it("normalises 4, 6 and 8 characters", () => {
    expect(locatorSchema.parse("jn45")).toBe("JN45");
    expect(locatorSchema.parse("JN45DL")).toBe("JN45dl");
    const value = locatorSchema.parse("jn45dl12");
    expect(value).toBe("JN45dl12");
    expectTypeOf(value).toEqualTypeOf<Locator>();
  });

  it("rejects invalid locators", () => {
    for (const value of ["JN4", "JN45d", "SN45", "JN45dl1"]) {
      expect(codes(locatorSchema, value)).toEqual(["locator.invalid-format"]);
    }
  });
});

describe("signal report schemas", () => {
  it("infers the kind or enforces the given one", () => {
    expect(signalReportSchema.parse("59")).toBe("59");
    expect(signalReportSchema.parse("-5")).toBe("-05");
    expect(signalReportSchemaFor("rst").parse("599")).toBe("599");
    expect(codes(signalReportSchemaFor("rs"), "599")).toEqual([
      "report.kind-mismatch",
    ]);
    expect(codes(signalReportSchemaFor("db"), "59")).toEqual([
      "report.kind-mismatch",
    ]);
    expect(codes(signalReportSchema, "69")).toEqual(["report.out-of-range"]);
  });

  it("validates and normalises SINPO codes", () => {
    expect(sinpoCodeSchema.parse(" 45434 ")).toBe("45434");
    expect(codes(sinpoCodeSchema, "45634")).toEqual(["sinpo.out-of-range"]);
    expect(codes(sinpoCodeSchema, "4543")).toEqual(["sinpo.invalid-format"]);
    // The offending field is kept in the issue params.
    expect(sinpoCodeSchema.safeParse("45604").error?.issues[0]).toMatchObject({
      code: "custom",
      params: { code: "sinpo.out-of-range", field: "noise" },
    });
  });
});

describe("coordinate schemas", () => {
  it("validates the WGS84 ranges", () => {
    expect(latitudeSchema.parse(-90)).toBe(-90);
    expect(latitudeSchema.parse(90)).toBe(90);
    expect(codes(latitudeSchema, 90.5)).toEqual([
      "coordinates.latitude-out-of-range",
    ]);
    expect(longitudeSchema.parse(-180)).toBe(-180);
    expect(codes(longitudeSchema, -180.1)).toEqual([
      "coordinates.longitude-out-of-range",
    ]);
  });

  it("stores longitude 180 as -180", () => {
    expect(longitudeSchema.parse(180)).toBe(-180);
    expect(coordinatesSchema.parse({ lat: 0, lon: 180 })).toEqual({
      lat: 0,
      lon: -180,
    });
  });

  it("reports each invalid field with its path", () => {
    const result = coordinatesSchema.safeParse({ lat: 100, lon: "9" });
    expect(result.error?.issues.map((i) => [i.path, issueCode(i)])).toEqual([
      [["lat"], "coordinates.latitude-out-of-range"],
      [["lon"], "zod.invalid_type"],
    ]);
  });

  it("rejects missing fields and non-finite numbers", () => {
    expect(codes(coordinatesSchema, { lat: 45 })).toEqual(["zod.invalid_type"]);
    expect(codes(coordinatesSchema, { lat: Number.NaN, lon: 0 })).toEqual([
      "zod.invalid_type",
    ]);
    expect(codes(coordinatesSchema, null)).toEqual(["zod.invalid_type"]);
  });
});

describe("time schemas", () => {
  it("normalises instants to UTC with Z, to the second", () => {
    const value = utcDateTimeSchema.parse("2026-10-17T15:21:30.250+02:00");
    expect(value).toBe("2026-10-17T13:21:30Z");
    expectTypeOf(value).toEqualTypeOf<UtcDateTime>();
  });

  it("rejects local times without offset and impossible dates", () => {
    expect(codes(utcDateTimeSchema, "2026-10-17T13:21:00")).toEqual([
      "time.missing-offset",
    ]);
    expect(codes(utcDateTimeSchema, "2026-02-30T13:21:00Z")).toEqual([
      "time.invalid-date",
    ]);
    expect(codes(utcDateSchema, "2026-02-29")).toEqual(["time.invalid-date"]);
    expect(utcDateSchema.parse("2024-02-29")).toBe("2024-02-29");
  });

  it("bounds minutes of day to 0–1440", () => {
    expect(minuteOfDaySchema.parse(0)).toBe(0);
    expect(minuteOfDaySchema.parse(1440)).toBe(1440);
    expect(codes(minuteOfDaySchema, 1441)).toEqual(["zod.too_big"]);
    expect(codes(minuteOfDaySchema, -1)).toEqual(["zod.too_small"]);
    expect(codes(minuteOfDaySchema, 1.5)).toEqual(["zod.invalid_type"]);
  });
});

describe("common metadata", () => {
  it("indexed flags are 0 | 1, not booleans", () => {
    expect(indexedFlagSchema.parse(0)).toBe(0);
    expect(indexedFlagSchema.parse(1)).toBe(1);
    expect(indexedFlagSchema.safeParse(true).success).toBe(false);
    expect(indexedFlagSchema.safeParse(2).success).toBe(false);
  });

  it("isSample is 1 or absent", () => {
    expect(sampleFlagSchema.parse(undefined)).toBeUndefined();
    expect(sampleFlagSchema.parse(1)).toBe(1);
    expect(sampleFlagSchema.safeParse(0).success).toBe(false);
  });

  it("timestamps require updatedAt ≥ createdAt", () => {
    expect(
      timestampsSchema.parse({
        createdAt: "2026-10-17T13:21:00Z",
        updatedAt: "2026-10-17T13:21:00Z",
      }),
    ).toEqual({
      createdAt: "2026-10-17T13:21:00Z",
      updatedAt: "2026-10-17T13:21:00Z",
    });
    const result = timestampsSchema.safeParse({
      createdAt: "2026-10-17T13:21:00Z",
      updatedAt: "2026-10-17T13:20:59Z",
    });
    expect(result.error?.issues.map((i) => [i.path, issueCode(i)])).toEqual([
      [["updatedAt"], "timestamps.updated-before-created"],
    ]);
  });

  it("compares timestamps after normalisation to UTC", () => {
    // 15:00+02:00 is 13:00Z, earlier than 13:30Z although "15" > "13".
    expect(
      timestampsSchema.safeParse({
        createdAt: "2026-10-17T13:30:00Z",
        updatedAt: "2026-10-17T15:00:00+02:00",
      }).success,
    ).toBe(false);
  });

  it("provenance fields are optional and validated when present", () => {
    expect(provenanceSchema.parse({})).toEqual({});
    expect(
      provenanceSchema.parse({
        sourceKey: "eibi",
        importJobId: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
      }),
    ).toEqual({
      sourceKey: "eibi",
      importJobId: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
    });
    expect(provenanceSchema.safeParse({ sourceKey: "EiBi" }).success).toBe(
      false,
    );
  });
});

describe("composition into an entity schema", () => {
  // Illustrative only: real entity schemas are defined by their modules (M3+).
  const exampleSchema = z.object({
    id: uuidSchema,
    callsign: callsignSchema,
    frequencyHz: frequencyHzSchema,
    gridsquare: locatorSchema.optional(),
    datetimeOn: utcDateTimeSchema,
  });

  it("derives branded field types with z.infer", () => {
    type Example = z.infer<typeof exampleSchema>;
    expectTypeOf<Example["callsign"]>().toEqualTypeOf<Callsign>();
    expectTypeOf<Example["frequencyHz"]>().toEqualTypeOf<FrequencyHz>();
    expectTypeOf<Example["gridsquare"]>().toEqualTypeOf<Locator | undefined>();
  });

  it("reports every invalid field in one pass", () => {
    const result = exampleSchema.safeParse({
      id: "x",
      callsign: "ABC",
      frequencyHz: -1,
      gridsquare: "ZZ99",
      datetimeOn: "2026-10-17T13:21:00",
    });
    expect(result.error?.issues.map((i) => [i.path[0], issueCode(i)])).toEqual([
      ["id", "zod.invalid_format"],
      ["callsign", "callsign.invalid-format"],
      ["frequencyHz", "frequency.negative"],
      ["gridsquare", "locator.invalid-format"],
      ["datetimeOn", "time.missing-offset"],
    ]);
  });
});
