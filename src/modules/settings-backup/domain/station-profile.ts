import { z } from "zod";
import {
  addDomainIssue,
  callsignSchema,
  checkTimestamps,
  checkTogether,
  indexedFlagSchema,
  latitudeSchema,
  locatorSchema,
  longitudeSchema,
  optionalTextSchema,
  textSchema,
  timestampFields,
  uuidSchema,
} from "@/core/validation";

/*
 * Station profile (DATABASE.md `station_profiles`, FR-SET-01): fixed,
 * portable or SWL station. Exactly one profile is the default when at least
 * one exists; the repository keeps that invariant.
 *
 * TODO(M3): derive `lat`/`lon` from the locator (`positionSource:
 * 'locator'`) in the profile form use case.
 */

export const STATION_PROFILE_KINDS = ["ham", "swl", "both"] as const;
export type StationProfileKind = (typeof STATION_PROFILE_KINDS)[number];

export const POSITION_SOURCES = ["locator", "manual", "gps"] as const;

export const stationEquipmentSchema = z.strictObject({
  rig: optionalTextSchema,
  receiver: optionalTextSchema,
  antenna: optionalTextSchema,
  powerW: z.number().nonnegative().optional(),
});

export const stationProfileSchema = z
  .strictObject({
    id: uuidSchema,
    name: textSchema,
    kind: z.enum(STATION_PROFILE_KINDS),
    callsign: callsignSchema.optional(),
    swlId: optionalTextSchema,
    operatorName: optionalTextSchema,
    locator: locatorSchema.optional(),
    lat: latitudeSchema.optional(),
    lon: longitudeSchema.optional(),
    positionSource: z.enum(POSITION_SOURCES).optional(),
    altitudeM: z.number().finite().optional(),
    qth: optionalTextSchema,
    country: optionalTextSchema,
    dxcc: z.number().int().nonnegative().optional(),
    cqZone: z.number().int().min(1).max(40).optional(),
    ituZone: z.number().int().min(1).max(90).optional(),
    equipment: stationEquipmentSchema.optional(),
    isDefault: indexedFlagSchema,
    ...timestampFields,
  })
  .superRefine((value, ctx) => {
    checkTimestamps(value, ctx);
    checkTogether(value, ["lat", "lon"], ctx);
    if (value.kind !== "swl" && value.callsign === undefined) {
      addDomainIssue(ctx, ["callsign"], "station-profile.callsign-required");
    }
    if (value.positionSource !== undefined && value.lat === undefined) {
      addDomainIssue(ctx, ["positionSource"], "fields.incomplete-group");
    }
  });

export type StationProfile = z.infer<typeof stationProfileSchema>;
export type StationProfileInput = z.input<typeof stationProfileSchema>;
