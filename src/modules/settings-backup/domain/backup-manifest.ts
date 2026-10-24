import { z } from "zod";
import type { UtcDateTime } from "@/core/time";
import {
  patternSchema,
  sha256HexSchema,
  utcDateTimeSchema,
  uuidSchema,
} from "@/core/validation";

/*
 * Backup file format v1 (DATABASE.md § 9.1, ADR-0015): one JSON object whose
 * root members are, in this order, the header fields, `tables` and
 * `integrity`. The header precedes the data so that a reader can refuse an
 * unsupported file before parsing any record; `integrity` follows it
 * because its checksums are computed while the tables are written.
 */

/** `format` field of every backup file. */
export const BACKUP_FORMAT = "ham-radio-toolbox-backup";

/** Version of the container format (independent of the schema version). */
export const BACKUP_FORMAT_VERSION = 1;

/** Checksum algorithm of the `integrity` member. */
export const BACKUP_HASH_ALGORITHM = "SHA-256";

/** Root members before `tables`, in file order. */
export const BACKUP_HEADER_FIELDS = [
  "format",
  "backupFormatVersion",
  "schemaVersion",
  "appVersion",
  "backupId",
  "exportedAt",
  "includesAttachments",
  "counts",
] as const;

/**
 * Operational size limit of a backup file (ADR-0015), verified on desktop
 * Chromium; configurable. Larger backups need the staging restore proposed
 * for M13.
 */
export const DEFAULT_MAX_BACKUP_BYTES = 100 * 1024 * 1024;

/** Table name as written in the file (`snake_case`, DATABASE.md § 1). */
const tableNameSchema = patternSchema(
  /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/,
  "backup.table-name",
);

const countSchema = z.number().int().nonnegative();

export const backupManifestSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  backupFormatVersion: z.number().int().positive(),
  /** Database schema version at export time. */
  schemaVersion: z.number().int().positive(),
  appVersion: z.string().trim().min(1).max(64),
  backupId: uuidSchema,
  exportedAt: utcDateTimeSchema,
  includesAttachments: z.boolean(),
  /** Records per table in the file: every table of the file appears. */
  counts: z.record(tableNameSchema, countSchema),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

/**
 * Checksums of the tables: SHA-256 of the UTF-8 text of each table's JSON
 * array exactly as written in the file, from `[` to `]`.
 */
export const backupIntegritySchema = z.strictObject({
  algorithm: z.literal(BACKUP_HASH_ALGORITHM),
  tables: z.record(tableNameSchema, sha256HexSchema),
});

export type BackupIntegrity = z.infer<typeof backupIntegritySchema>;

/** Download name `hrt-backup-YYYYMMDD-HHMMZ.json` (DATABASE.md § 9.1). */
export function backupFileName(exportedAt: UtcDateTime): string {
  const date = exportedAt.slice(0, 10).replaceAll("-", "");
  const time = `${exportedAt.slice(11, 13)}${exportedAt.slice(14, 16)}`;
  return `hrt-backup-${date}-${time}Z.json`;
}
