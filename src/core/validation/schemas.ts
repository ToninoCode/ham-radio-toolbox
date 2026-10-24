// Must stay first: configures Zod before any schema is built.
import "./zod-config";
import { z } from "zod";
import { ok } from "@/shared/types";
import { parseCallsign } from "@/core/callsign";
import { frequencyHz } from "@/core/frequency";
import { coordinates, parseLocator } from "@/core/locator";
import {
  normalizeSignalReport,
  parseSinpo,
  formatSinpo,
  type ReportKind,
} from "@/core/reports";
import { MINUTES_PER_DAY, parseUtcDate, parseUtcDateTime } from "@/core/time";
import { domainSchema } from "./domain-schema";

/*
 * Reusable schemas for persisted fields (ADR-0005, DATABASE.md § 1).
 *
 * Every schema accepts the representations users and files produce and
 * outputs the canonical one (normalised, branded), so the same schema works
 * for forms, imports and backup restore. Canonical values pass unchanged:
 * parsing stored data is idempotent.
 */

// --- Identifiers ------------------------------------------------------------

/**
 * String matching `pattern`, with the domain `code` on failure. Zod's
 * `.regex()` reports `invalid_format` and keeps the code only in the
 * message, so `issueCode()` would return `zod.invalid_format`: a custom
 * refinement carries the code in `params`, like {@link domainSchema}.
 */
export function patternSchema(pattern: RegExp, code: string) {
  return z.string().refine((text) => pattern.test(text), {
    message: code,
    params: { code },
  });
}

/** Entity id: UUID v4 from `crypto.randomUUID()` (ADR-0005). */
export const uuidSchema = z.uuidv4();

/**
 * Stable catalog key, the documented exception to UUIDs (`settings.key`,
 * `data_sources.key`): lower-case kebab-case, e.g. `app`, `eibi`, `hfcc`.
 */
export const catalogKeySchema = patternSchema(
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
  "catalog-key.invalid",
);

/** SHA-256 digest as lower-case hex (attachments, `import_jobs.fileSha256`). */
export const sha256HexSchema = patternSchema(
  /^[0-9a-f]{64}$/,
  "sha256.invalid",
);

// --- Radio domain -----------------------------------------------------------

/** Frequency in whole hertz (safe, non-negative integer). */
export const frequencyHzSchema = domainSchema(z.number(), frequencyHz);

/** Callsign: normalised to upper case, syntax checked (`core/callsign`). */
export const callsignSchema = domainSchema(z.string(), (text: string) => {
  const result = parseCallsign(text);
  return result.ok ? ok(result.value.callsign) : result;
});

/** Maidenhead locator, 4/6/8 characters, normalised (`JN45dl`). */
export const locatorSchema = domainSchema(z.string(), parseLocator);

/** RS/RST/dB report with the kind inferred from the text. */
export const signalReportSchema = domainSchema(z.string(), (text: string) =>
  normalizeSignalReport(text),
);

/** RS/RST/dB report of the given kind (from `reportKindForMode`). */
export function signalReportSchemaFor(kind: ReportKind) {
  return domainSchema(z.string(), (text: string) =>
    normalizeSignalReport(text, kind),
  );
}

/** SINPO as persisted: five digits 1–5 (`swl_receptions.sinpo`). */
export const sinpoCodeSchema = domainSchema(z.string(), (text: string) => {
  const result = parseSinpo(text);
  return result.ok ? ok(formatSinpo(result.value)) : result;
});

// --- Position ---------------------------------------------------------------

/** Latitude, WGS84 decimal degrees, [-90, 90]. */
export const latitudeSchema = domainSchema(z.number(), (lat: number) => {
  const result = coordinates(lat, 0);
  return result.ok ? ok(result.value.lat) : result;
});

/** Longitude, WGS84 decimal degrees; accepts [-180, 180], stores [-180, 180). */
export const longitudeSchema = domainSchema(z.number(), (lon: number) => {
  const result = coordinates(0, lon);
  return result.ok ? ok(result.value.lon) : result;
});

/** `{ lat, lon }` validated together (WGS84 decimal degrees). */
export const coordinatesSchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
});

// --- Time -------------------------------------------------------------------

/**
 * Instant normalised to `YYYY-MM-DDTHH:MM:SSZ`. Accepts ISO 8601 with an
 * explicit offset; rejects local times without offset (ADR-0005).
 */
export const utcDateTimeSchema = domainSchema(z.string(), parseUtcDateTime);

/** Calendar date `YYYY-MM-DD`. */
export const utcDateSchema = domainSchema(z.string(), parseUtcDate);

/** Minutes from 00:00 UTC, 0–1440 (schedules; 1440 = end of day). */
export const minuteOfDaySchema = z.number().int().min(0).max(MINUTES_PER_DAY);

// --- Common metadata (DATABASE.md § 1) --------------------------------------

/** Flag usable in an IndexedDB index: `0 | 1`, never boolean (ADR-0005). */
export const indexedFlagSchema = z.union([z.literal(0), z.literal(1)]);

/** `isSample: 1` on demonstration records (FR-GEN-04); absent otherwise. */
export const sampleFlagSchema = z.literal(1).optional();

/**
 * Adds a domain-coded issue at `path` from a refinement (same shape as the
 * issues of {@link domainSchema}: `message` and `params.code` are the code).
 */
export function addDomainIssue(
  ctx: z.RefinementCtx,
  path: readonly PropertyKey[],
  code: string,
): void {
  ctx.addIssue({
    code: "custom",
    path: [...path],
    message: code,
    params: { code },
  });
}

/**
 * Refinement: `end`, when present, is not earlier than `start` (UTC
 * instants compare as strings). Issue on `endKey`.
 */
export function checkNotBefore<K extends string>(
  value: Readonly<Partial<Record<K, string>>>,
  startKey: K,
  endKey: K,
  ctx: z.RefinementCtx,
  code: string,
): void {
  const start = value[startKey];
  const end = value[endKey];
  if (start !== undefined && end !== undefined && end < start) {
    addDomainIssue(ctx, [endKey], code);
  }
}

/**
 * Refinement: the listed fields are all present or all absent (e.g. `lat`
 * and `lon`). Issue `fields.incomplete-group` on each missing field.
 */
export function checkTogether<K extends string>(
  value: Readonly<Partial<Record<K, unknown>>>,
  keys: readonly K[],
  ctx: z.RefinementCtx,
): void {
  const present = keys.filter((key) => value[key] !== undefined);
  if (present.length === 0 || present.length === keys.length) return;
  for (const key of keys) {
    if (value[key] === undefined) {
      addDomainIssue(ctx, [key], "fields.incomplete-group");
    }
  }
}

/** Fields of {@link timestampsSchema}, for entity schemas that extend it. */
export const timestampFields = {
  createdAt: utcDateTimeSchema,
  updatedAt: utcDateTimeSchema,
};

/** Refinement of {@link timestampsSchema}: `updatedAt ≥ createdAt`. */
export function checkTimestamps(
  value: { readonly createdAt: string; readonly updatedAt: string },
  ctx: z.RefinementCtx,
): void {
  checkNotBefore(
    value,
    "createdAt",
    "updatedAt",
    ctx,
    "timestamps.updated-before-created",
  );
}

/** `createdAt` / `updatedAt` of every user entity, `updatedAt ≥ createdAt`. */
export const timestampsSchema = z
  .object(timestampFields)
  .superRefine(checkTimestamps);

// --- Free text --------------------------------------------------------------

/** Required text: trimmed, not empty (`text.empty`). */
export const textSchema = z
  .string()
  .trim()
  .refine((text) => text !== "", {
    message: "text.empty",
    params: { code: "text.empty" },
  });

/**
 * Optional text: trimmed; an empty string (blank form field) becomes
 * absent, never `""` (DATABASE.md § 1: optional fields are absent).
 */
export const optionalTextSchema = z
  .string()
  .trim()
  .transform((text) => (text === "" ? undefined : text))
  .optional();

/** Provenance of imported records: source and import job (DATABASE.md § 1). */
export const provenanceSchema = z.object({
  sourceKey: catalogKeySchema.optional(),
  importJobId: uuidSchema.optional(),
});

// --- Derived types ----------------------------------------------------------

export type Uuid = z.infer<typeof uuidSchema>;
export type CatalogKey = z.infer<typeof catalogKeySchema>;
export type IndexedFlag = z.infer<typeof indexedFlagSchema>;
export type Timestamps = z.infer<typeof timestampsSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
