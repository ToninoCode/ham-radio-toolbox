import type { AttachmentMetadata } from "@/core/attachment";
import type { ImportErrorEntry, ImportJob } from "@/core/import-job";
import type { UtcDateTime } from "@/core/time";
import type {
  AbortedError,
  PersistenceError,
  RestoreMode,
  RestoreWritePlan,
  StoredRecord,
  TableCounts,
  TableName,
  ValidationIssue,
} from "@/shared/application";
import type { DomainError, Result } from "@/shared/types";
import type {
  BackupIntegrity,
  BackupManifest,
} from "../domain/backup-manifest";

/*
 * Contracts of backup and restore (FR-SET-05/06, DATABASE.md § 9,
 * ADR-0015): the file codec implemented in infrastructure, the errors and
 * the results of the use cases. Error codes are stable and translated by
 * presentation (Block D); `cause`, `location` and `message` fields are
 * technical diagnostics.
 */

/** Problems of the file as a container (format v1). */
export type BackupFileError =
  | DomainError<"backup.empty">
  | (DomainError<"backup.too-large"> & {
      readonly sizeBytes: number;
      readonly limitBytes: number;
    })
  | (DomainError<"backup.read-failed"> & { readonly cause: string })
  | DomainError<"backup.encoding-invalid">
  | DomainError<"backup.not-a-backup">
  | (DomainError<"backup.json-invalid"> & { readonly location: string })
  | (DomainError<"backup.unknown-field"> & { readonly field: string })
  | (DomainError<"backup.layout-invalid"> & { readonly reason: string })
  | DomainError<"backup.truncated">
  | (DomainError<"backup.format-version-unsupported"> & {
      readonly found: unknown;
      readonly supported: number;
    })
  | (DomainError<"backup.manifest-invalid"> & {
      readonly issues: readonly ValidationIssue[];
    })
  | (DomainError<"backup.table-duplicate"> & { readonly table: string })
  | (DomainError<"backup.record-too-large"> & {
      readonly location: string;
      readonly limitChars: number;
    })
  | DomainError<"backup.integrity-missing">
  | DomainError<"backup.integrity-invalid">
  | (DomainError<"backup.checksum-mismatch"> & {
      readonly tables: readonly string[];
    })
  | AbortedError;

/** A stored record that fails its schema and cannot be exported. */
export interface InvalidStoredRecord {
  readonly table: TableName;
  readonly key: string;
  readonly issues: readonly ValidationIssue[];
}

export type BackupError =
  | BackupFileError
  | (DomainError<"backup.schema-newer"> & {
      readonly found: number;
      readonly current: number;
    })
  | (DomainError<"backup.migration-unavailable"> & {
      readonly from: number;
      readonly to: number;
    })
  | (DomainError<"backup.unknown-table"> & { readonly table: string })
  | (DomainError<"backup.table-missing"> & { readonly table: string })
  /** `includesAttachments` disagrees with the presence of the table. */
  | DomainError<"backup.attachments-mismatch">
  | (DomainError<"backup.count-mismatch"> & {
      readonly table: string;
      readonly declared: number | undefined;
      readonly found: number;
    })
  /** The analysis found invalid records or references: no restore. */
  | DomainError<"backup.has-errors">
  /** The local data changed after the preview: preview again. */
  | DomainError<"backup.preview-stale">
  | (DomainError<"backup.verification-failed"> & {
      readonly table: TableName;
      readonly expected: number;
      readonly found: number;
    })
  | (DomainError<"backup.export-too-large"> & {
      readonly estimatedBytes: number;
      readonly limitBytes: number;
    })
  | (DomainError<"backup.source-invalid"> & {
      readonly invalidCount: number;
      /** The first invalid records (at most 100). */
      readonly records: readonly InvalidStoredRecord[];
    })
  /** The generated file does not read back as written: not offered. */
  | (DomainError<"backup.export-unverified"> & { readonly reason: string })
  /** An exception escaped a use case (reported by presentation). */
  | DomainError<"backup.unexpected-error">
  | PersistenceError;

/** Header fields chosen by the export; `counts` are added by the writer. */
export type BackupHeader = Omit<BackupManifest, "counts">;

/**
 * Progressive writer of one backup file. `record` is synchronous (called
 * inside the database snapshot); attachments are added after it. Tables
 * can be filled in any order; the file lists them in the order given to
 * `createWriter`.
 */
export interface BackupFileWriter {
  /** Bytes produced so far (for the size limit). */
  readonly bytesWritten: number;
  record(table: TableName, record: StoredRecord): void;
  attachment(
    metadata: AttachmentMetadata,
    content: Blob,
  ): Promise<Result<void, BackupFileError>>;
  /**
   * Closes the tables and assembles the file; the writer is then spent.
   * `counts` has an entry for every table of the file.
   */
  finish(): {
    readonly blob: Blob;
    readonly counts: Readonly<Partial<Record<TableName, number>>>;
  };
}

/** Events of a progressive read, in file order. */
export type BackupReadEvent =
  | { readonly type: "header"; readonly manifest: BackupManifest }
  | { readonly type: "table-start"; readonly table: string }
  | {
      readonly type: "record";
      readonly table: string;
      readonly index: number;
      /** Parsed JSON; attachments carry `blob` instead of `dataBase64`. */
      readonly value: unknown;
      /** Code of an attachment content that could not be decoded. */
      readonly contentError?: string;
    }
  | {
      readonly type: "table-end";
      readonly table: string;
      readonly count: number;
    };

export type BackupReadHandler = (
  event: BackupReadEvent,
) => Result<void, BackupError> | Promise<Result<void, BackupError>>;

export interface BackupReadOptions {
  readonly signal?: AbortSignal;
  /** Longest JSON text accepted for one record of a table, in characters. */
  readonly recordCharLimit: (table: string) => number;
}

/** File format v1: writer and progressive reader (ADR-0015). */
export interface BackupCodec {
  createWriter(
    header: BackupHeader,
    tables: readonly TableName[],
  ): BackupFileWriter;
  /**
   * Reads the file progressively, never holding its whole text: structure,
   * header, records and finally the checksums. A handler error stops the
   * read and is returned as is.
   */
  read(
    file: Blob,
    onEvent: BackupReadHandler,
    options: BackupReadOptions,
  ): Promise<Result<{ readonly integrity: BackupIntegrity }, BackupError>>;
}

/** A generated backup, ready to be saved by presentation. */
export interface BackupFile {
  readonly blob: Blob;
  readonly sizeBytes: number;
  readonly fileName: string;
  readonly manifest: BackupManifest;
}

/** What an export would contain, known without reading any content. */
export interface BackupInventory {
  /** Records per table in the database. */
  readonly counts: TableCounts;
  /** Records of every table except `attachments`. */
  readonly recordCount: number;
  readonly attachmentCount: number;
  /** Sum of the attachment sizes (`sizeBytes`). */
  readonly attachmentBytes: number;
  /** Size of the attachment contents in base64 (+33 %), a lower bound. */
  readonly attachmentBase64Bytes: number;
  /** Operational size limit of a backup file (ADR-0015). */
  readonly limitBytes: number;
}

/** A generated backup read back: structure, counts and checksums match. */
export interface BackupVerification {
  readonly recordCount: number;
  /** Tables whose checksum was verified. */
  readonly tableCount: number;
}

/** Validated content of a backup, held in memory until the commit. */
export interface BackupContent {
  readonly includesAttachments: boolean;
  /** Every table of the file, records in file order (validated, current schema). */
  readonly tables: Readonly<Record<TableName, readonly StoredRecord[]>>;
}

/** Result of reading and validating a backup file: no writes. */
export interface RestoreAnalysis {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly startedAt: UtcDateTime;
  readonly manifest: BackupManifest;
  /** Records in the file. */
  readonly recordCount: number;
  /** Records dropped by a schema migration. */
  readonly droppedByMigration: number;
  readonly invalidCount: number;
  /** Invalid records and broken references (first 500). */
  readonly errors: readonly ImportErrorEntry[];
  readonly errorsTruncated?: true;
  /** Present only when the backup can be restored. */
  readonly content?: BackupContent;
}

/** Effect of a restore on one table. */
export interface TableEffects {
  readonly inserted: number;
  readonly updated: number;
  readonly deleted: number;
  /** Local record kept (equal or more recent, merge mode). */
  readonly unchanged: number;
  /** Backup record not applied because of a conflict. */
  readonly skipped: number;
}

/** Backup record not applied in merge mode, with the reason. */
export interface RestoreConflict {
  readonly table: TableName;
  readonly key: string;
  readonly code: string;
}

/** Writes of a restore and their effects, computed from the local state. */
export interface RestorePlan {
  readonly mode: RestoreMode;
  readonly writes: RestoreWritePlan;
  readonly effects: Readonly<Record<TableName, TableEffects>>;
  readonly conflicts: readonly RestoreConflict[];
  /** Records per table after the restore (before its job is written). */
  readonly expectedCounts: TableCounts;
}

export interface RestorePreview extends RestorePlan {
  readonly analysis: RestoreAnalysis & { readonly content: BackupContent };
}

export interface RestoreOutcome {
  readonly job: ImportJob;
  readonly effects: Readonly<Record<TableName, TableEffects>>;
  /** Records per table after the restore, verified inside the transaction. */
  readonly counts: TableCounts;
}

/** Use cases of backup and restore. */
export interface BackupService {
  /** Record counts and attachment sizes of the database. No writes. */
  inspectBackup(): Promise<Result<BackupInventory, BackupError>>;
  /** Exports every user table (attachments only on request). */
  createBackup(options: {
    readonly includeAttachments: boolean;
    readonly signal?: AbortSignal;
  }): Promise<Result<BackupFile, BackupError>>;
  /**
   * Reads a generated file back (structure, header, counts, checksums)
   * without keeping its records: offer the file only after this check.
   */
  verifyBackup(
    file: BackupFile,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Result<BackupVerification, BackupError>>;
  /** Reads, verifies, migrates and validates a backup file. No writes. */
  analyzeBackup(
    file: { readonly name: string; readonly content: Blob },
    options?: { readonly signal?: AbortSignal },
  ): Promise<Result<RestoreAnalysis, BackupError>>;
  /** Plans the restore against the local data. No writes. */
  previewRestore(
    analysis: RestoreAnalysis,
    mode: RestoreMode,
  ): Promise<Result<RestorePreview, BackupError>>;
  /** Applies a confirmed preview atomically and records the job. */
  commitRestore(
    preview: RestorePreview,
  ): Promise<Result<RestoreOutcome, BackupError>>;
  /** Records that the user cancelled the restore. */
  cancelRestore(
    analysis: RestoreAnalysis,
  ): Promise<Result<ImportJob, PersistenceError>>;
}
