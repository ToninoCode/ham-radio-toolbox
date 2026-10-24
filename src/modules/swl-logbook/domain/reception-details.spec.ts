// @vitest-environment node
import { describe, expect, it } from "vitest";
import { issueCode } from "@/core/validation";
import {
  RECEPTION_DETAILS_DATA_SCHEMAS,
  receptionDetailsSchema,
} from "./reception-details";
import { SWL_CATEGORIES, swlReceptionSchema } from "./swl-reception";

const common = {
  id: "2b7a1b7e-4a3f-4c2d-9e8f-0a1b2c3d4e5f",
  receptionId: "3c8b2c8f-5b4a-4d3e-8f9a-1b2c3d4e5f60",
  createdAt: "2026-10-24T10:00:00Z",
  updatedAt: "2026-10-24T10:00:00Z",
};

/** A valid `data` object for each category (DATABASE.md table). */
const SAMPLE_DATA = {
  broadcast: {
    programme: "Notiziario",
    targetArea: "Europa",
    powerKw: 250,
    scheduleSource: "eibi",
    qslRequested: false,
  },
  amateur: {
    callsignHeard: "dl1abc",
    workingCallsign: "iz1abc",
    amateurMode: "SSB",
    heardLocator: "JO62",
  },
  utility: { serviceType: "time-signal", identifier: "DCF77" },
  digital: {
    digitalMode: "RTTY",
    baudRate: 50,
    shiftHz: 450,
    decoderSoftware: "fldigi",
    decoded: true,
  },
  aeronautical: { service: "volmet", groundStation: "Shannon", region: "NAT" },
  maritime: { service: "navtex", coastStation: "Roma", navtexId: "R" },
  satellite: {
    satelliteName: "ISS",
    noradId: 25544,
    downlinkMode: "FM",
    aos: "2026-10-24T18:00:00Z",
    los: "2026-10-24T18:10:00Z",
    maxElevationDeg: 62,
  },
} as const;

const codes = (value: unknown) =>
  receptionDetailsSchema.safeParse(value).error?.issues.map(issueCode) ?? [];

describe("receptionDetailsSchema", () => {
  it("has one data schema per SWL category", () => {
    expect(Object.keys(RECEPTION_DETAILS_DATA_SCHEMAS).sort()).toEqual(
      [...SWL_CATEGORIES].sort(),
    );
  });

  it.each(SWL_CATEGORIES)(
    "accepts and re-accepts valid %s details",
    (category) => {
      const details = receptionDetailsSchema.parse({
        ...common,
        category,
        data: SAMPLE_DATA[category],
      });
      expect(receptionDetailsSchema.parse(details)).toEqual(details);
    },
  );

  it("normalises callsigns and locators of amateur monitoring", () => {
    const details = receptionDetailsSchema.parse({
      ...common,
      category: "amateur",
      data: SAMPLE_DATA.amateur,
    });
    expect(details.data).toEqual({
      callsignHeard: "DL1ABC",
      workingCallsign: "IZ1ABC",
      amateurMode: "SSB",
      heardLocator: "JO62",
    });
  });

  it("validates data against the declared category", () => {
    expect(
      codes({ ...common, category: "broadcast", data: SAMPLE_DATA.digital }),
    ).toEqual(["zod.unrecognized_keys"]);
    expect(codes({ ...common, category: "radar", data: {} })).toEqual([
      "zod.invalid_union",
    ]);
  });

  it.each([
    ["aeronautical", { messageText: "…" }],
    ["aeronautical", { flightNumber: "AZ123" }],
    ["maritime", { messageText: "…" }],
    ["maritime", { vesselName: "Private yacht" }],
  ] as const)(
    "%s details have no place for communication content or private identifiers",
    (category, extra) => {
      expect(
        codes({
          ...common,
          category,
          data: { ...SAMPLE_DATA[category], ...extra },
        }),
      ).toEqual(["zod.unrecognized_keys"]);
    },
  );
});

describe("swlReceptionSchema", () => {
  const reception = {
    id: common.id,
    stationProfileId: common.receptionId,
    category: "utility",
    datetimeStart: "2026-10-24T10:00:00Z",
    frequencyHz: 77_500,
    modulation: "cw",
    stationName: "DCF77",
    sinpo: " 44434 ",
    receiverLat: 45,
    receiverLon: 9,
    createdAt: common.createdAt,
    updatedAt: common.updatedAt,
  };

  it("stores the trimmed SINPO code and is idempotent", () => {
    const parsed = swlReceptionSchema.parse(reception);
    expect(parsed.sinpo).toBe("44434");
    expect(parsed.modulation).toBe("CW");
    expect(swlReceptionSchema.parse(parsed)).toEqual(parsed);
  });

  it("checks end time and receiver position", () => {
    expect(
      swlReceptionSchema
        .safeParse({
          ...reception,
          datetimeEnd: "2026-10-24T09:00:00Z",
          receiverLon: undefined,
        })
        .error?.issues.map((issue) => [issue.path.join("."), issueCode(issue)]),
    ).toEqual([
      ["datetimeEnd", "swl.end-before-start"],
      ["receiverLon", "fields.incomplete-group"],
    ]);
  });
});
