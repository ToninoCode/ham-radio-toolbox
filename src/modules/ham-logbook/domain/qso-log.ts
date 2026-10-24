import { z } from "zod";
import {
  addDomainIssue,
  callsignSchema,
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
  timestampFields,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * Persisted QSO (DATABASE.md `qso_logs`). This schema checks what every
 * stored record must satisfy, whatever its origin (form, ADIF, restore).
 *
 * TODO(M3): BL-M3-01 adds the logbook rules on top of it: band derived from
 * the frequency with the IARU R1 plan (and checked against it), ADIF
 * `MODE`/`SUBMODE` and `BAND` enumerations, RST validated for the mode
 * (`reportKindForMode`), POTA/SOTA reference formats, duplicate policy.
 */

export const CONTINENTS = ["AF", "AN", "AS", "EU", "NA", "OC", "SA"] as const;

export const QSO_ORIGINS = ["manual", "adif-import", "restore"] as const;
export type QsoOrigin = (typeof QSO_ORIGINS)[number];

/** ADIF band name as stored (`20m`, `70cm`, `1.25m`, `submm`). */
const bandSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:\d+(?:\.\d+)?(?:mm|cm|m)|submm)$/, { message: "band.invalid" });

/** ADIF mode/submode: upper case, no spaces (`SSB`, `FT8`, `USB`). */
const modeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, { message: "mode.invalid" });

export const qsoLogSchema = z
  .strictObject({
    id: uuidSchema,
    stationProfileId: uuidSchema,
    callsign: callsignSchema,
    datetimeOn: utcDateTimeSchema,
    datetimeOff: utcDateTimeSchema.optional(),
    frequencyHz: frequencyHzSchema,
    frequencyRxHz: frequencyHzSchema.optional(),
    band: bandSchema,
    mode: modeSchema,
    submode: modeSchema.optional(),
    rstSent: signalReportSchema.optional(),
    rstRcvd: signalReportSchema.optional(),
    txPowerW: z.number().nonnegative().optional(),
    name: optionalTextSchema,
    qth: optionalTextSchema,
    gridsquare: locatorSchema.optional(),
    lat: latitudeSchema.optional(),
    lon: longitudeSchema.optional(),
    country: optionalTextSchema,
    dxcc: z.number().int().nonnegative().optional(),
    cqZone: z.number().int().min(1).max(40).optional(),
    ituZone: z.number().int().min(1).max(90).optional(),
    continent: z.enum(CONTINENTS).optional(),
    potaRef: optionalTextSchema,
    sotaRef: optionalTextSchema,
    myPotaRef: optionalTextSchema,
    mySotaRef: optionalTextSchema,
    contestId: optionalTextSchema,
    comment: optionalTextSchema,
    notes: optionalTextSchema,
    adifExtra: z.record(z.string().min(1), z.string()).optional(),
    origin: z.enum(QSO_ORIGINS),
    importJobId: uuidSchema.optional(),
    isSample: sampleFlagSchema,
    ...timestampFields,
  })
  .superRefine((value, ctx) => {
    checkTimestamps(value, ctx);
    checkNotBefore(
      value,
      "datetimeOn",
      "datetimeOff",
      ctx,
      "qso.off-before-on",
    );
    checkTogether(value, ["lat", "lon"], ctx);
    // FR-HAM-04: frequency > 0 (0 Hz is a valid FrequencyHz, not a QSO).
    if (value.frequencyHz === 0) {
      addDomainIssue(ctx, ["frequencyHz"], "qso.frequency-zero");
    }
  });

export type QsoLog = z.infer<typeof qsoLogSchema>;
export type QsoLogInput = z.input<typeof qsoLogSchema>;
