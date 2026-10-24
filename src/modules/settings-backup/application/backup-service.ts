import { DEFAULT_MAX_ATTACHMENT_BYTES } from "@/core/attachment";
import {
  MAX_IMPORT_ERRORS,
  truncateImportErrors,
  type ImportCounts,
  type ImportErrorEntry,
} from "@/core/import-job";
import {
  ABORTED,
  TABLE_NAMES,
  isAborted,
  type BackupGateway,
  type Clock,
  type ContentHasher,
  type IdGenerator,
  type ImportJobRepository,
  type StoredRecord,
  type TableName,
  type UnitOfWork,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DEFAULT_MAX_BACKUP_BYTES,
  backupFileName,
  type BackupManifest,
} from "../domain/backup-manifest";
import type {
  BackupCodec,
  BackupContent,
  BackupError,
  BackupReadEvent,
  BackupService,
  InvalidStoredRecord,
  RestoreAnalysis,
  RestoreOutcome,
  RestorePlan,
} from "./backup-ports";
import { isPlainRecord, primaryKeyOf, validateRecord } from "./backup-records";
import {
  checkBackupReferences,
  planRestore,
  sameEffects,
} from "./restore-planner";

/*
 * Backup and restore use cases (BL-M2-08, FR-SET-05/06, DATABASE.md § 9,
 * ADR-0015). Files are processed progressively; every asynchronous step
 * (file reads, attachment hashing) happens outside transactions, and the
 * restore is a single unit of work (ADR-0014).
 */

export interface BackupLimits {
  /** Largest backup file written or read (ADR-0015). */
  readonly maxBackupBytes: number;
  /** Largest attachment content (ADR-0009). */
  readonly maxAttachmentBytes: number;
}

export interface BackupServiceDeps {
  readonly gateway: BackupGateway;
  readonly codec: BackupCodec;
  readonly unitOfWork: UnitOfWork;
  readonly importJobs: ImportJobRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly hasher: ContentHasher;
  readonly appVersion: string;
  readonly limits?: Partial<BackupLimits>;
}

/** Longest JSON text of a record that is not an attachment. */
const MAX_RECORD_CHARS = 1024 * 1024;
/** JSON overhead of an attachment record around its base64 content. */
const ATTACHMENT_RECORD_OVERHEAD = 64 * 1024;
/** Invalid stored records listed in `backup.source-invalid`. */
const MAX_INVALID_LISTED = 100;

function base64Length(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

function emptyTables(): Record<TableName, StoredRecord[]> {
  const tables = {} as Record<TableName, StoredRecord[]>;
  for (const table of TABLE_NAMES) tables[table] = [];
  return tables;
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return JSON.stringify(error) ?? String(error);
}

function codeOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    if (typeof code === "string") return code;
  }
  return "backup.restore-failed";
}

export function createBackupService(deps: BackupServiceDeps): BackupService {
  const { gateway, codec, unitOfWork, importJobs, clock, ids, hasher } = deps;
  const limits: BackupLimits = {
    maxBackupBytes: deps.limits?.maxBackupBytes ?? DEFAULT_MAX_BACKUP_BYTES,
    maxAttachmentBytes:
      deps.limits?.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES,
  };

  function restoreJob(
    analysis: RestoreAnalysis,
    status: "committed" | "failed" | "cancelled",
    counts: ImportCounts,
    errors: readonly ImportErrorEntry[],
    options: Record<string, string | number | boolean> = {},
  ) {
    const truncated = truncateImportErrors(errors);
    const { manifest } = analysis;
    return {
      kind: "backup" as const,
      fileName: analysis.fileName,
      status,
      startedAt: analysis.startedAt,
      finishedAt: clock.now(),
      counts,
      errors: truncated.errors,
      ...(truncated.errorsTruncated || analysis.errorsTruncated
        ? { errorsTruncated: true as const }
        : {}),
      options: {
        backupId: manifest.backupId,
        backupExportedAt: manifest.exportedAt,
        backupSchemaVersion: manifest.schemaVersion,
        backupAppVersion: manifest.appVersion,
        includesAttachments: manifest.includesAttachments,
        ...options,
      },
    };
  }

  function unwrittenCounts(analysis: RestoreAnalysis): ImportCounts {
    return {
      total: analysis.recordCount,
      valid: analysis.recordCount - analysis.invalidCount,
      invalid: analysis.invalidCount,
      duplicates: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }

  /**
   * Job counts (schema v1 `import_jobs.counts`): `duplicates` are backup
   * records whose key exists locally; `skipped` those not written (local
   * kept, conflict, dropped by a migration). Deletions are recorded in the
   * job options.
   */
  function committedCounts(
    analysis: RestoreAnalysis,
    plan: RestorePlan,
  ): ImportCounts {
    let inserted = 0;
    let updated = 0;
    let skipped = analysis.droppedByMigration;
    for (const table of TABLE_NAMES) {
      const effects = plan.effects[table];
      inserted += effects.inserted;
      updated += effects.updated;
      skipped += effects.unchanged + effects.skipped;
    }
    return {
      total: analysis.recordCount,
      valid: analysis.recordCount - analysis.invalidCount,
      invalid: analysis.invalidCount,
      duplicates: plan.mode === "merge" ? updated + skipped : 0,
      inserted,
      updated,
      skipped,
    };
  }

  async function recordFailure(
    analysis: RestoreAnalysis,
    mode: string,
    failure: ImportErrorEntry,
  ): Promise<void> {
    try {
      await importJobs.create(
        restoreJob(
          analysis,
          "failed",
          unwrittenCounts(analysis),
          [failure, ...analysis.errors],
          { mode },
        ),
      );
    } catch {
      // The storage itself is failing: the original error is reported.
    }
  }

  return {
    async createBackup({ includeAttachments, signal }) {
      if (isAborted(signal)) return err(ABORTED);
      const info = await gateway.inspect();
      if (!info.ok) return info;
      if (includeAttachments) {
        const estimatedBytes = base64Length(info.value.attachmentBytes);
        if (estimatedBytes > limits.maxBackupBytes) {
          return err({
            code: "backup.export-too-large",
            estimatedBytes,
            limitBytes: limits.maxBackupBytes,
          });
        }
      }

      const tables = (gateway.tablesOf(gateway.schemaVersion) ?? []).filter(
        (table) => includeAttachments || table !== "attachments",
      );
      const header = {
        format: BACKUP_FORMAT,
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: gateway.schemaVersion,
        appVersion: deps.appVersion,
        backupId: ids.newId(),
        exportedAt: clock.now(),
        includesAttachments: includeAttachments,
      } satisfies Omit<BackupManifest, "counts">;
      const writer = codec.createWriter(header, tables);

      const invalid: InvalidStoredRecord[] = [];
      let invalidCount = 0;
      let stop: BackupError | undefined;
      const tooLarge = (): boolean => {
        if (writer.bytesWritten <= limits.maxBackupBytes) return false;
        stop = {
          code: "backup.export-too-large",
          estimatedBytes: writer.bytesWritten,
          limitBytes: limits.maxBackupBytes,
        };
        return true;
      };
      const reject = (
        table: TableName,
        key: string,
        issues: InvalidStoredRecord["issues"],
      ) => {
        invalidCount++;
        if (invalid.length < MAX_INVALID_LISTED)
          invalid.push({ table, key, issues });
      };

      const exported = await gateway.exportSnapshot(
        {
          record(table, record) {
            if (isAborted(signal)) {
              stop = ABORTED;
              return false;
            }
            // Validation before export: a record that fails its schema
            // would make the backup impossible to restore.
            const valid = validateRecord(table, record);
            if (!valid.ok) {
              reject(table, primaryKeyOf(table, record), valid.error);
              return true;
            }
            if (invalidCount > 0) return true;
            writer.record(table, valid.value);
            return !tooLarge();
          },
          async attachment(metadata, content) {
            if (isAborted(signal)) {
              stop = ABORTED;
              return false;
            }
            const valid = validateRecord("attachments", {
              ...metadata,
              blob: content,
            });
            if (!valid.ok) {
              reject("attachments", metadata.id, valid.error);
              return true;
            }
            if (invalidCount > 0) return true;
            const written = await writer.attachment(metadata, content);
            if (!written.ok) {
              stop = written.error;
              return false;
            }
            return !tooLarge();
          },
        },
        { includeAttachments },
      );
      if (!exported.ok) return exported;
      if (stop) return err(stop);
      if (invalidCount > 0) {
        return err({
          code: "backup.source-invalid",
          invalidCount,
          records: invalid,
        });
      }
      const { blob, counts } = writer.finish();
      const manifest: BackupManifest = {
        ...header,
        counts: Object.fromEntries(
          tables.map((table) => [table, counts[table] ?? 0]),
        ),
      };
      return ok({
        blob,
        sizeBytes: blob.size,
        fileName: backupFileName(header.exportedAt),
        manifest,
      });
    },

    async analyzeBackup(file, options = {}) {
      const { signal } = options;
      const startedAt = clock.now();
      const sizeBytes = file.content.size;
      if (sizeBytes === 0) return err({ code: "backup.empty" });
      if (sizeBytes > limits.maxBackupBytes) {
        return err({
          code: "backup.too-large",
          sizeBytes,
          limitBytes: limits.maxBackupBytes,
        });
      }

      let manifest: BackupManifest | undefined;
      let expected: readonly TableName[] = [];
      const seen = new Set<TableName>();
      const tables = emptyTables();
      const errors: ImportErrorEntry[] = [];
      let recordCount = 0;
      let invalidCount = 0;
      let dropped = 0;
      const addError = (entry: ImportErrorEntry) => {
        if (errors.length <= MAX_IMPORT_ERRORS) errors.push(entry);
      };

      const onEvent = async (
        event: BackupReadEvent,
      ): Promise<Result<void, BackupError>> => {
        if (isAborted(signal)) return err(ABORTED);
        switch (event.type) {
          case "header": {
            manifest = event.manifest;
            const current = gateway.schemaVersion;
            if (manifest.schemaVersion > current) {
              return err({
                code: "backup.schema-newer",
                found: manifest.schemaVersion,
                current,
              });
            }
            const migration = gateway.checkMigration(manifest.schemaVersion);
            const known = gateway.tablesOf(manifest.schemaVersion);
            if (!migration.ok || !known) {
              return err({
                code: "backup.migration-unavailable",
                from: migration.ok
                  ? manifest.schemaVersion
                  : migration.error.from,
                to: migration.ok ? current : migration.error.to,
              });
            }
            const includes = manifest.includesAttachments;
            expected = known.filter(
              (table) => includes || table !== "attachments",
            );
            const declared = Object.keys(manifest.counts);
            const unknown = declared.find(
              (table) => !expected.includes(table as TableName),
            );
            if (unknown !== undefined) {
              return err(
                unknown === "attachments"
                  ? { code: "backup.attachments-mismatch" }
                  : { code: "backup.unknown-table", table: unknown },
              );
            }
            const missing = expected.find((table) => !declared.includes(table));
            if (missing !== undefined) {
              return err({ code: "backup.table-missing", table: missing });
            }
            return ok(undefined);
          }
          case "table-start":
            if (!expected.includes(event.table as TableName)) {
              return err(
                event.table === "attachments"
                  ? { code: "backup.attachments-mismatch" }
                  : { code: "backup.unknown-table", table: event.table },
              );
            }
            return ok(undefined);
          case "record": {
            const table = event.table as TableName;
            const location = `${table}[${event.index}]`;
            recordCount++;
            const reject = (field: string | undefined, code: string) =>
              addError({
                location,
                ...(field ? { field } : {}),
                code,
                message: "",
              });
            if (event.contentError) {
              invalidCount++;
              reject("dataBase64", event.contentError);
              return ok(undefined);
            }
            if (!isPlainRecord(event.value)) {
              invalidCount++;
              reject(undefined, "backup.record-not-object");
              return ok(undefined);
            }
            const migrated =
              manifest && manifest.schemaVersion < gateway.schemaVersion
                ? gateway.migrateRecord(
                    table,
                    event.value,
                    manifest.schemaVersion,
                  )
                : event.value;
            if (migrated === null) {
              dropped++;
              return ok(undefined);
            }
            const valid = validateRecord(table, migrated);
            if (!valid.ok) {
              invalidCount++;
              for (const issue of valid.error) reject(issue.path, issue.code);
              return ok(undefined);
            }
            if (table === "attachments") {
              const blob = valid.value["blob"] as Blob;
              if (blob.size > limits.maxAttachmentBytes) {
                invalidCount++;
                reject("sizeBytes", "attachment.too-large");
                return ok(undefined);
              }
              // Asynchronous, outside any transaction (ADR-0014).
              if ((await hasher.sha256(blob)) !== valid.value["sha256"]) {
                invalidCount++;
                reject("sha256", "attachment.sha256-mismatch");
                return ok(undefined);
              }
            }
            // Once a record is invalid the backup cannot be restored:
            // stop keeping records, only the report goes on.
            if (invalidCount === 0) tables[table].push(valid.value);
            return ok(undefined);
          }
          case "table-end": {
            const table = event.table as TableName;
            const declared = manifest?.counts[table];
            if (declared !== event.count) {
              return err({
                code: "backup.count-mismatch",
                table,
                declared,
                found: event.count,
              });
            }
            seen.add(table);
            return ok(undefined);
          }
        }
      };

      const read = await codec.read(file.content, onEvent, {
        ...(signal ? { signal } : {}),
        recordCharLimit: (table) =>
          table === "attachments"
            ? base64Length(limits.maxAttachmentBytes) +
              ATTACHMENT_RECORD_OVERHEAD
            : MAX_RECORD_CHARS,
      });
      if (!read.ok) return read;
      if (!manifest) return err({ code: "backup.not-a-backup" });
      const missing = expected.find((table) => !seen.has(table));
      if (missing !== undefined) {
        return err({ code: "backup.table-missing", table: missing });
      }

      let content: BackupContent | undefined;
      if (invalidCount === 0) {
        content = { includesAttachments: manifest.includesAttachments, tables };
        for (const entry of checkBackupReferences(content)) addError(entry);
        if (errors.length > 0) content = undefined;
      }
      const truncated = truncateImportErrors(errors);
      return ok({
        fileName: file.name,
        sizeBytes,
        startedAt,
        manifest,
        recordCount,
        droppedByMigration: dropped,
        invalidCount,
        errors: truncated.errors,
        ...(truncated.errorsTruncated
          ? { errorsTruncated: true as const }
          : {}),
        ...(content ? { content } : {}),
      });
    },

    async previewRestore(analysis, mode) {
      const { content } = analysis;
      if (!content) return err({ code: "backup.has-errors" });
      const local = await gateway.readLocalState();
      if (!local.ok) return local;
      return ok({
        ...planRestore(content, local.value, mode),
        analysis: { ...analysis, content },
      });
    },

    async commitRestore(preview) {
      const { analysis } = preview;
      let result: Result<RestoreOutcome, BackupError>;
      try {
        result = await unitOfWork.run(
          async (): Promise<Result<RestoreOutcome, BackupError>> => {
            // Only database requests from here on: the content was read,
            // decoded and hashed during the analysis.
            const local = await gateway.readLocalState();
            if (!local.ok) return local;
            const plan = planRestore(
              analysis.content,
              local.value,
              preview.mode,
            );
            if (!sameEffects(plan, preview)) {
              return err({ code: "backup.preview-stale" });
            }
            const counts = await gateway.applyRestore(plan.writes);
            if (!counts.ok) return counts;
            for (const table of TABLE_NAMES) {
              if (counts.value[table] !== plan.expectedCounts[table]) {
                return err({
                  code: "backup.verification-failed",
                  table,
                  expected: plan.expectedCounts[table],
                  found: counts.value[table],
                });
              }
            }
            const deleted = TABLE_NAMES.reduce(
              (sum, table) => sum + plan.effects[table].deleted,
              0,
            );
            const job = await importJobs.create(
              restoreJob(
                analysis,
                "committed",
                committedCounts(analysis, plan),
                analysis.errors,
                { mode: plan.mode, deleted, conflicts: plan.conflicts.length },
              ),
            );
            if (!job.ok) return job;
            return ok({
              job: job.value,
              effects: plan.effects,
              counts: {
                ...counts.value,
                import_jobs: counts.value.import_jobs + 1,
              },
            });
          },
        );
      } catch (error) {
        await recordFailure(analysis, preview.mode, {
          location: "commit",
          code: "backup.unexpected-error",
          message: describe(error),
        });
        throw error;
      }
      if (!result.ok) {
        await recordFailure(analysis, preview.mode, {
          location: "commit",
          code: codeOf(result.error),
          message: describe(result.error),
        });
      }
      return result;
    },

    cancelRestore(analysis) {
      return importJobs.create(
        restoreJob(
          analysis,
          "cancelled",
          unwrittenCounts(analysis),
          analysis.errors,
        ),
      );
    },
  };
}
