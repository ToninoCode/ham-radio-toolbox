import type { AttachmentMetadata } from "@/core/attachment";
import type { DomainError, Result } from "@/shared/types";
import type { PersistenceError } from "./persistence-error";
import type { TableName } from "./tables";

/*
 * Database side of backup and restore (DATABASE.md § 9, FR-SET-05/06,
 * ADR-0015). The file format and the use cases belong to the
 * settings-backup module; this port is what they need from the storage:
 * a consistent snapshot to export, the local state to plan a restore, the
 * atomic write of a restore and the pure schema migrations (ADR-0006).
 */

/** A stored record as read from IndexedDB or from a backup file. */
export type StoredRecord = Readonly<Record<string, unknown>>;

/** Records per table, as stored (camelCase fields, ADR-0006). */
export type TableRecords = Partial<Record<TableName, readonly unknown[]>>;

/** Number of records of every table. */
export type TableCounts = Readonly<Record<TableName, number>>;

/**
 * `replace` (default, FR-SET-06): the tables of the backup replace the
 * local ones. `merge`: records are upserted by key, the most recent
 * `updatedAt` wins, nothing local is deleted (rules in DATABASE.md § 9.2).
 */
export type RestoreMode = "replace" | "merge";

/** Failure of migrating stored records between schema versions. */
export type MigrationError = DomainError<
  "migration.newer-version" | "migration.missing-step"
> & {
  readonly from: number;
  readonly to: number;
};

/**
 * Receives the records of a consistent snapshot of the database.
 * `record` is called synchronously inside the read transaction (it must not
 * await anything), table by table in backup order and by primary key;
 * `attachment` is called after the transaction, by id, with the content.
 * Returning `false` stops the export (limit reached, aborted).
 */
export interface BackupRecordSink {
  record(table: TableName, record: StoredRecord): boolean;
  attachment(metadata: AttachmentMetadata, content: Blob): Promise<boolean>;
}

/** Sizes known without reading any content. */
export interface DatabaseSnapshotInfo {
  readonly counts: TableCounts;
  /** Sum of `attachments.sizeBytes`. */
  readonly attachmentBytes: number;
}

/** Projections of the local records that a restore plan depends on. */
export interface LocalDataState {
  readonly counts: TableCounts;
  /** Primary key → `updatedAt` (`undefined` where the table has none). */
  readonly versions: Readonly<
    Record<TableName, ReadonlyMap<string, string | undefined>>
  >;
  readonly defaultStationProfileId?: string;
  /** Reception id → category. */
  readonly receptionCategories: ReadonlyMap<string, string>;
  readonly receptionDetails: readonly {
    readonly id: string;
    readonly receptionId: string;
  }[];
  readonly qslRecords: readonly {
    readonly id: string;
    readonly subjectType: string;
    readonly subjectId: string;
    readonly channel: string;
  }[];
  readonly attachments: readonly {
    readonly id: string;
    readonly ownerType: string;
    readonly ownerId: string;
    readonly sha256: string;
  }[];
}

/**
 * Writes of a restore, applied in this order in one transaction: clear the
 * listed tables, delete the listed keys, put the records (validated).
 */
export interface RestoreWritePlan {
  readonly clear: readonly TableName[];
  readonly deletes: Readonly<Partial<Record<TableName, readonly string[]>>>;
  readonly puts: Readonly<Partial<Record<TableName, readonly StoredRecord[]>>>;
}

export interface BackupGateway {
  /** Schema version of the running app. */
  readonly schemaVersion: number;
  /**
   * Tables of a backup made at the given schema version, in file order;
   * `undefined` for a version this app does not know.
   */
  tablesOf(schemaVersion: number): readonly TableName[] | undefined;
  /** Whether records of `fromVersion` can be brought to the current one. */
  checkMigration(fromVersion: number): Result<void, MigrationError>;
  /**
   * One record of `fromVersion` brought to the current schema with the
   * pure migrations, or `null` if a migration drops it. Call
   * `checkMigration` first: a missing step is a programming error here.
   */
  migrateRecord(
    table: TableName,
    record: StoredRecord,
    fromVersion: number,
  ): StoredRecord | null;
  inspect(): Promise<Result<DatabaseSnapshotInfo, PersistenceError>>;
  /** Streams a consistent snapshot to the sink (see BackupRecordSink). */
  exportSnapshot(
    sink: BackupRecordSink,
    options: { readonly includeAttachments: boolean },
  ): Promise<Result<{ readonly completed: boolean }, PersistenceError>>;
  /** Reads the local state; inside a unit of work it joins the transaction. */
  readLocalState(): Promise<Result<LocalDataState, PersistenceError>>;
  /**
   * Applies the plan in one transaction (joining the ambient unit of work)
   * and returns the counts of every table after the writes.
   */
  applyRestore(
    plan: RestoreWritePlan,
  ): Promise<Result<TableCounts, PersistenceError>>;
}
