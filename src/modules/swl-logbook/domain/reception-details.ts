import { z } from "zod";
import {
  callsignSchema,
  checkTimestamps,
  locatorSchema,
  optionalTextSchema,
  textSchema,
  timestampFields,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";
import type { SwlCategory } from "./swl-reception";

/*
 * Category-specific data of a reception (DATABASE.md `reception_details`),
 * 1:1 with `swl_receptions`, discriminated on `category`, which must equal
 * the reception's category (checked by the repository).
 *
 * Every `data` object is strict: unknown fields are rejected. For
 * aeronautical and maritime listening this is the enforcement of FR-SWL-04
 * and CON-08: there is no field for the content of the communications, nor
 * for identifiers of private vessels, and none can be added by an import.
 */

const optionalNonNegative = z.number().nonnegative().optional();

export const broadcastDetailsSchema = z.strictObject({
  programme: optionalTextSchema,
  targetArea: optionalTextSchema,
  transmitterSite: optionalTextSchema,
  powerKw: optionalNonNegative,
  scheduleSource: z.enum(["eibi", "hfcc", "manual"]).optional(),
  qslRequested: z.boolean().optional(),
});

export const amateurDetailsSchema = z.strictObject({
  callsignHeard: callsignSchema,
  workingCallsign: callsignSchema.optional(),
  amateurMode: optionalTextSchema,
  heardLocator: locatorSchema.optional(),
});

export const utilityDetailsSchema = z.strictObject({
  serviceType: z
    .enum(["time-signal", "beacon", "weather", "navtex", "military", "other"])
    .optional(),
  identifier: optionalTextSchema,
  scheduleNote: optionalTextSchema,
});

export const digitalDetailsSchema = z.strictObject({
  digitalMode: textSchema,
  baudRate: z.number().positive().optional(),
  shiftHz: z.number().int().nonnegative().optional(),
  decoderSoftware: optionalTextSchema,
  decoded: z.boolean().optional(),
});

export const aeronauticalDetailsSchema = z.strictObject({
  service: z.enum(["volmet", "hf-atc", "hfdl", "acars", "other"]).optional(),
  groundStation: optionalTextSchema,
  region: optionalTextSchema,
});

export const maritimeDetailsSchema = z.strictObject({
  service: z
    .enum(["coast-station", "navtex", "dsc", "weather", "other"])
    .optional(),
  coastStation: optionalTextSchema,
  navtexId: optionalTextSchema,
});

export const satelliteDetailsSchema = z.strictObject({
  satelliteName: textSchema,
  noradId: z.number().int().positive().optional(),
  downlinkMode: optionalTextSchema,
  aos: utcDateTimeSchema.optional(),
  los: utcDateTimeSchema.optional(),
  maxElevationDeg: z.number().min(0).max(90).optional(),
});

/** Schema of `data` for each category. */
export const RECEPTION_DETAILS_DATA_SCHEMAS = {
  broadcast: broadcastDetailsSchema,
  amateur: amateurDetailsSchema,
  utility: utilityDetailsSchema,
  digital: digitalDetailsSchema,
  aeronautical: aeronauticalDetailsSchema,
  maritime: maritimeDetailsSchema,
  satellite: satelliteDetailsSchema,
} as const satisfies Record<SwlCategory, z.ZodType>;

const commonFields = {
  id: uuidSchema,
  receptionId: uuidSchema,
  ...timestampFields,
};

function variant<C extends SwlCategory>(category: C) {
  return z.strictObject({
    ...commonFields,
    category: z.literal(category),
    data: RECEPTION_DETAILS_DATA_SCHEMAS[category],
  });
}

export const receptionDetailsSchema = z
  .discriminatedUnion("category", [
    variant("broadcast"),
    variant("amateur"),
    variant("utility"),
    variant("digital"),
    variant("aeronautical"),
    variant("maritime"),
    variant("satellite"),
  ])
  .superRefine(checkTimestamps);

export type ReceptionDetails = z.infer<typeof receptionDetailsSchema>;
export type ReceptionDetailsInput = z.input<typeof receptionDetailsSchema>;

type DistributivePick<T, K extends keyof T> = T extends unknown
  ? Pick<T, K>
  : never;

/**
 * Category and data of a reception's details, as given by callers: each
 * category with its own data shape (`{ category: "amateur", data: {
 * callsignHeard… } }`).
 */
export type ReceptionDetailsData = DistributivePick<
  ReceptionDetailsInput,
  "category" | "data"
>;
