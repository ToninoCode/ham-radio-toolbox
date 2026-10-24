import { z } from "zod";
import {
  catalogKeySchema,
  checkNotBefore,
  optionalTextSchema,
  sha256HexSchema,
  textSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * Import job: the record of one import attempt (DATABASE.md `import_jobs`,
 * § 8). It is written in the same transaction as the imported data, or on
 * its own when the import fails or is cancelled. The preview writes nothing.
 */

export const IMPORT_JOB_KINDS = [
  "adif",
  "eibi",
  "hfcc",
  "tle",
  "omm",
  "satnogs",
  "raindrop",
  "csv",
  "backup",
] as const;
export type ImportJobKind = (typeof IMPORT_JOB_KINDS)[number];

export const IMPORT_JOB_STATUSES = [
  "committed",
  "failed",
  "cancelled",
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

/** Errors kept per job; the rest is only counted (`errorsTruncated`). */
export const MAX_IMPORT_ERRORS = 500;

const countSchema = z.number().int().nonnegative();

export const importCountsSchema = z.strictObject({
  total: countSchema,
  valid: countSchema,
  invalid: countSchema,
  duplicates: countSchema,
  inserted: countSchema,
  updated: countSchema,
  skipped: countSchema,
});
export type ImportCounts = z.infer<typeof importCountsSchema>;

/**
 * One problem found in the imported file. `location` identifies the record
 * in the source (`record 12`, `line 340`), `code` is a stable code
 * (`callsign.invalid-format`, `zod.invalid_type`…), `message` a technical
 * detail for diagnostics, never shown as UI text.
 */
export const importErrorEntrySchema = z.strictObject({
  location: textSchema,
  field: optionalTextSchema,
  code: textSchema,
  message: z.string(),
});
export type ImportErrorEntry = z.infer<typeof importErrorEntrySchema>;

export const importJobSchema = z
  .strictObject({
    id: uuidSchema,
    kind: z.enum(IMPORT_JOB_KINDS),
    sourceKey: catalogKeySchema.optional(),
    fileName: optionalTextSchema,
    fileSha256: sha256HexSchema.optional(),
    datasetVersion: optionalTextSchema,
    status: z.enum(IMPORT_JOB_STATUSES),
    startedAt: utcDateTimeSchema,
    finishedAt: utcDateTimeSchema,
    counts: importCountsSchema,
    errors: z.array(importErrorEntrySchema).max(MAX_IMPORT_ERRORS),
    errorsTruncated: z.literal(true).optional(),
    options: z.record(z.string(), z.json()).optional(),
  })
  .superRefine((value, ctx) => {
    checkNotBefore(
      value,
      "startedAt",
      "finishedAt",
      ctx,
      "import-job.finished-before-started",
    );
  });

export type ImportJob = z.infer<typeof importJobSchema>;

/** Counts of an import that has not processed anything yet. */
export function emptyImportCounts(): ImportCounts {
  return {
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };
}

/**
 * Keeps the first {@link MAX_IMPORT_ERRORS} errors, flagging the rest as
 * truncated (DATABASE.md `import_jobs.errors`).
 */
export function truncateImportErrors(errors: readonly ImportErrorEntry[]): {
  errors: ImportErrorEntry[];
  errorsTruncated?: true;
} {
  if (errors.length <= MAX_IMPORT_ERRORS) return { errors: [...errors] };
  return { errors: errors.slice(0, MAX_IMPORT_ERRORS), errorsTruncated: true };
}
