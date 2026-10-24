import { decodeBase64 } from "@/infrastructure/files/base64";
import { ABORTED, isAborted, validationIssues } from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type {
  BackupCodec,
  BackupError,
  BackupFileError,
  BackupReadEvent,
  BackupReadHandler,
  BackupReadOptions,
} from "../application/backup-ports";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_HEADER_FIELDS,
  backupIntegritySchema,
  backupManifestSchema,
  type BackupIntegrity,
} from "../domain/backup-manifest";
import {
  BackupJsonScanner,
  BackupScanError,
  type ScanEvent,
} from "./backup-json-scanner";
import { JsonBackupWriter } from "./backup-json-writer";

/*
 * Codec of backup format v1 (ADR-0015). Reading streams the file through a
 * strict UTF-8 decoder into the scanner: memory holds one chunk and one
 * record at a time (plus what the use case keeps), never the whole text.
 */

/** Longest root value: header fields and `integrity`. */
const MAX_MEMBER_CHARS = 64 * 1024;

function readFailed(error: unknown): BackupFileError {
  const cause = error instanceof Error ? error.name : String(error);
  return { code: "backup.read-failed", cause };
}

function fromScan(error: BackupScanError): BackupFileError {
  const { code, detail } = error;
  switch (code) {
    case "backup.json-invalid":
      return { code, location: String(detail["location"] ?? "") };
    case "backup.unknown-field":
      return { code, field: String(detail["field"] ?? "") };
    case "backup.layout-invalid":
      return { code, reason: String(detail["reason"] ?? "") };
    case "backup.table-duplicate":
      return { code, table: String(detail["table"] ?? "") };
    case "backup.record-too-large":
      return {
        code,
        location: String(detail["location"] ?? ""),
        limitChars: Number(detail["limitChars"] ?? 0),
      };
    default:
      return { code };
  }
}

/** Attachment record: `dataBase64` decoded into a Blob of the declared type. */
function attachmentEvent(
  table: string,
  index: number,
  value: unknown,
): BackupReadEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { type: "record", table, index, value };
  }
  const { dataBase64, ...metadata } = value as Record<string, unknown>;
  if (typeof dataBase64 !== "string") {
    return {
      type: "record",
      table,
      index,
      value: metadata,
      contentError: "attachment.content-missing",
    };
  }
  const bytes = decodeBase64(dataBase64);
  if (!bytes.ok) {
    return {
      type: "record",
      table,
      index,
      value: metadata,
      contentError: "attachment.content-invalid",
    };
  }
  const type =
    typeof metadata["mimeType"] === "string" ? metadata["mimeType"] : "";
  return {
    type: "record",
    table,
    index,
    value: { ...metadata, blob: new Blob([bytes.value], { type }) },
  };
}

async function readBackup(
  file: Blob,
  onEvent: BackupReadHandler,
  options: BackupReadOptions,
): Promise<Result<{ readonly integrity: BackupIntegrity }, BackupError>> {
  const scanner = new BackupJsonScanner({
    headerFields: BACKUP_HEADER_FIELDS,
    maxMemberChars: MAX_MEMBER_CHARS,
    recordChars: options.recordCharLimit,
  });
  const header: Record<string, unknown> = {};
  const digests = new Map<string, string>();
  let integrity: unknown;
  let hasIntegrity = false;
  let hasTables = false;

  let reader: ReadableStreamDefaultReader<string>;
  try {
    reader = file
      .stream()
      .pipeThrough(new TextDecoderStream("utf-8", { fatal: true }))
      .getReader();
  } catch (error) {
    return err(readFailed(error));
  }
  const stop = async <E>(
    result: Result<never, E>,
  ): Promise<Result<never, E>> => {
    // Releases the file and the decoder; nothing else was allocated.
    await reader.cancel().catch(() => undefined);
    return result;
  };

  const handle = (
    event: ScanEvent,
  ): Result<void, BackupError> | Promise<Result<void, BackupError>> => {
    switch (event.type) {
      case "member":
        if (event.key === "integrity") {
          integrity = event.value;
          hasIntegrity = true;
          return ok(undefined);
        }
        if (event.key === "format" && event.value !== BACKUP_FORMAT) {
          return err({ code: "backup.not-a-backup" });
        }
        if (
          event.key === "backupFormatVersion" &&
          event.value !== BACKUP_FORMAT_VERSION
        ) {
          return err({
            code: "backup.format-version-unsupported",
            found: event.value,
            supported: BACKUP_FORMAT_VERSION,
          });
        }
        header[event.key] = event.value;
        return ok(undefined);
      case "tables-start": {
        hasTables = true;
        const manifest = backupManifestSchema.safeParse(header);
        if (!manifest.success) {
          return err({
            code: "backup.manifest-invalid",
            issues: validationIssues(manifest.error),
          });
        }
        return onEvent({ type: "header", manifest: manifest.data });
      }
      case "table-start":
        return onEvent(event);
      case "record": {
        let value: unknown;
        try {
          value = JSON.parse(event.text);
        } catch {
          return err({
            code: "backup.json-invalid",
            location: `${event.table}[${event.index}]`,
          });
        }
        return onEvent(
          event.table === "attachments"
            ? attachmentEvent(event.table, event.index, value)
            : { type: "record", table: event.table, index: event.index, value },
        );
      }
      case "table-end":
        digests.set(event.table, event.sha256);
        return onEvent({
          type: "table-end",
          table: event.table,
          count: event.count,
        });
    }
  };

  try {
    for (;;) {
      if (isAborted(options.signal)) return stop(err(ABORTED));
      let chunk: ReadableStreamReadResult<string>;
      try {
        chunk = await reader.read();
      } catch (error) {
        // The strict decoder rejects invalid UTF-8 with a TypeError; a file
        // changed on disk after being chosen fails with NotReadableError.
        return err(
          error instanceof TypeError
            ? { code: "backup.encoding-invalid" }
            : readFailed(error),
        );
      }
      if (chunk.done) break;
      for (const event of scanner.write(chunk.value)) {
        const handled = await handle(event);
        if (!handled.ok) return stop(handled);
      }
    }
    scanner.end();
  } catch (error) {
    if (error instanceof BackupScanError) return stop(err(fromScan(error)));
    throw error;
  }

  if (!hasTables)
    return err({ code: "backup.layout-invalid", reason: "tables-missing" });
  if (!hasIntegrity) return err({ code: "backup.integrity-missing" });
  const parsed = backupIntegritySchema.safeParse(integrity);
  if (!parsed.success) return err({ code: "backup.integrity-invalid" });
  const declared = parsed.data.tables;
  const mismatched = new Set<string>();
  for (const [table, digest] of digests) {
    if (declared[table] !== digest) mismatched.add(table);
  }
  for (const table of Object.keys(declared)) {
    if (!digests.has(table)) mismatched.add(table);
  }
  if (mismatched.size > 0) {
    return err({
      code: "backup.checksum-mismatch",
      tables: [...mismatched].sort(),
    });
  }
  return ok({ integrity: parsed.data });
}

export const jsonBackupCodec: BackupCodec = {
  createWriter: (header, tables) => new JsonBackupWriter(header, tables),
  read: readBackup,
};
