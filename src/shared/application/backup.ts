import type { DomainError, Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";
import type { DeletionReport } from "./repository";
import type { TableName } from "./tables";

/*
 * Contract of backup and restore (DATABASE.md § 9, FR-SET-05/06), prepared
 * in Block B so that the schema migrations and the database adapter share
 * the same vocabulary.
 *
 * TODO(M2): Block C — envelope schema and validation, attachments as base64,
 * size limit (Q-M2-04), adapter of BackupGateway, backup/restore use cases,
 * fixtures in tests/fixtures/backup/.
 */

/** `format` field of every backup file. */
export const BACKUP_FORMAT = "ham-radio-toolbox-backup";

/** Version of the container format (independent of the schema version). */
export const BACKUP_FORMAT_VERSION = 1;

/** Records per table, as stored (camelCase fields, ADR-0006). */
export type TableRecords = Partial<Record<TableName, readonly unknown[]>>;

/** Backup file (DATABASE.md § 9.1). */
export interface BackupEnvelope {
  readonly format: typeof BACKUP_FORMAT;
  /** Database schema version at export time. */
  readonly schemaVersion: number;
  readonly backupFormatVersion: number;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly includesAttachments: boolean;
  readonly tables: TableRecords;
  readonly counts: Readonly<Partial<Record<TableName, number>>>;
}

/** `replace` empties the user tables first; `merge` upserts by key. */
export type RestoreMode = "replace" | "merge";

/** Failure of migrating stored records between schema versions. */
export type MigrationError = DomainError<
  "migration.newer-version" | "migration.missing-step"
> & {
  readonly from: number;
  readonly to: number;
};

/** Database side of backup and restore, implemented in infrastructure. */
export interface BackupGateway {
  /** Schema version of the running app. */
  readonly schemaVersion: number;
  /** Brings records exported at `fromVersion` to the current schema. */
  migrate(
    tables: TableRecords,
    fromVersion: number,
  ): Result<TableRecords, MigrationError>;
  readTables(options: {
    readonly includeAttachments: boolean;
  }): Promise<Result<TableRecords, PersistenceError>>;
  /** Writes validated records in one transaction over every table. */
  writeTables(
    tables: TableRecords,
    mode: RestoreMode,
  ): Promise<Result<DeletionReport, PersistenceError>>;
}
