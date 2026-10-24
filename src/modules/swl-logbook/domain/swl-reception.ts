import { z } from "zod";
import {
  addDomainIssue,
  checkNotBefore,
  checkTimestamps,
  checkTogether,
  frequencyHzSchema,
  latitudeSchema,
  locatorSchema,
  longitudeSchema,
  optionalTextSchema,
  sampleFlagSchema,
  signalReportSchema,
  sinpoCodeSchema,
  textSchema,
  timestampFields,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * Persisted SWL reception (DATABASE.md `swl_receptions`). Category-specific
 * data live in `reception_details` (1:1, see reception-details.ts).
 * `stationId`, `scheduleId` and `satelliteId` point to tables of later
 * schema versions (M5, M8): references not checked, orphans tolerated
 * (DATABASE.md § 6).
 *
 * TODO(M4): band derivation and the category-specific form rules.
 */

export const SWL_CATEGORIES = [
  "broadcast",
  "amateur",
  "utility",
  "digital",
  "aeronautical",
  "maritime",
  "satellite",
] as const;
export type SwlCategory = (typeof SWL_CATEGORIES)[number];

export const swlCategorySchema = z.enum(SWL_CATEGORIES);

export const swlEquipmentSchema = z.strictObject({
  receiver: optionalTextSchema,
  antenna: optionalTextSchema,
  software: optionalTextSchema,
});

export const swlReceptionSchema = z
  .strictObject({
    id: uuidSchema,
    stationProfileId: uuidSchema,
    category: swlCategorySchema,
    datetimeStart: utcDateTimeSchema,
    datetimeEnd: utcDateTimeSchema.optional(),
    frequencyHz: frequencyHzSchema,
    band: optionalTextSchema,
    modulation: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9 /-]*$/, { message: "modulation.invalid" }),
    stationName: textSchema,
    stationId: uuidSchema.optional(),
    country: optionalTextSchema,
    language: optionalTextSchema,
    sinpo: sinpoCodeSchema.optional(),
    rst: signalReportSchema.optional(),
    receiverLocator: locatorSchema.optional(),
    receiverLat: latitudeSchema.optional(),
    receiverLon: longitudeSchema.optional(),
    equipment: swlEquipmentSchema.optional(),
    notes: optionalTextSchema,
    scheduleId: uuidSchema.optional(),
    satelliteId: uuidSchema.optional(),
    isSample: sampleFlagSchema,
    ...timestampFields,
  })
  .superRefine((value, ctx) => {
    checkTimestamps(value, ctx);
    checkNotBefore(
      value,
      "datetimeStart",
      "datetimeEnd",
      ctx,
      "swl.end-before-start",
    );
    checkTogether(value, ["receiverLat", "receiverLon"], ctx);
    if (value.frequencyHz === 0) {
      addDomainIssue(ctx, ["frequencyHz"], "swl.frequency-zero");
    }
  });

export type SwlReception = z.infer<typeof swlReceptionSchema>;
export type SwlReceptionInput = z.input<typeof swlReceptionSchema>;
