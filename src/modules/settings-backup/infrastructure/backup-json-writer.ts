import type { AttachmentMetadata } from "@/core/attachment";
import { encodeBase64Bytes } from "@/infrastructure/files/base64";
import { canonicalJson } from "@/infrastructure/files/canonical-json";
import { Sha256 } from "@/infrastructure/files/sha256";
import type { StoredRecord, TableName } from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type {
  BackupFileError,
  BackupFileWriter,
  BackupHeader,
} from "../application/backup-ports";
import { BACKUP_HASH_ALGORITHM } from "../domain/backup-manifest";

/*
 * Progressive writer of format v1 (DATABASE.md § 9.1, ADR-0015). Records are
 * serialised one at a time (canonical JSON, one record per line), encoded to
 * UTF-8, hashed and stored as Blob parts of about 512 KiB: the file is never
 * a single string in memory, and an attachment is read one at a time.
 */

/** Characters buffered before a part is encoded, hashed and stored. */
const FLUSH_CHARS = 512 * 1024;
/** Attachment bytes encoded to base64 per part (multiple of 3). */
const BASE64_CHUNK_BYTES = 3 * 256 * 1024;
/** Key replaced by the attachment's content in its JSON text. */
const CONTENT_MARKER = '"dataBase64":""';

const encoder = new TextEncoder();

/** The JSON array of one table, hashed exactly as written. */
class TableSection {
  readonly #hash = new Sha256();
  readonly parts: Blob[] = [];
  #pending: string[] = [];
  #pendingChars = 0;
  count = 0;
  bytes = 0;
  digest: string | undefined;

  get pendingChars(): number {
    return this.#pendingChars;
  }

  /** Separator before the next record. */
  open(): string {
    return this.count === 0 ? "[\n" : ",\n";
  }

  write(text: string): void {
    this.#pending.push(text);
    this.#pendingChars += text.length;
    if (this.#pendingChars >= FLUSH_CHARS) this.flush();
  }

  writeBytes(bytes: Uint8Array<ArrayBuffer>): void {
    this.flush();
    this.#store(bytes);
  }

  flush(): void {
    if (this.#pending.length === 0) return;
    const bytes = encoder.encode(this.#pending.join(""));
    this.#pending = [];
    this.#pendingChars = 0;
    this.#store(bytes);
  }

  close(): void {
    this.write(this.count === 0 ? "[]" : "\n]");
    this.flush();
    this.digest = this.#hash.hex();
  }

  #store(bytes: Uint8Array<ArrayBuffer>): void {
    this.#hash.update(bytes);
    this.parts.push(new Blob([bytes]));
    this.bytes += bytes.length;
  }
}

export class JsonBackupWriter implements BackupFileWriter {
  readonly #header: BackupHeader;
  readonly #tables: readonly TableName[];
  readonly #sections = new Map<TableName, TableSection>();
  #finished = false;

  constructor(header: BackupHeader, tables: readonly TableName[]) {
    this.#header = header;
    this.#tables = tables;
    for (const table of tables) this.#sections.set(table, new TableSection());
  }

  get bytesWritten(): number {
    let bytes = 0;
    for (const section of this.#sections.values()) {
      bytes += section.bytes + section.pendingChars;
    }
    return bytes;
  }

  record(table: TableName, record: StoredRecord): void {
    this.#assertOpen();
    const section = this.#section(table);
    section.write(section.open() + canonicalJson(record));
    section.count++;
  }

  async attachment(
    metadata: AttachmentMetadata,
    content: Blob,
  ): Promise<Result<void, BackupFileError>> {
    this.#assertOpen();
    const section = this.#section("attachments");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await content.arrayBuffer());
    } catch (error) {
      const cause = error instanceof Error ? error.name : String(error);
      return err({ code: "backup.read-failed", cause });
    }
    // Canonical text with an empty `dataBase64`, split where the content
    // goes: the base64 is streamed into the section without one big string.
    const json = canonicalJson({ ...metadata, dataBase64: "" });
    const split = json.indexOf(CONTENT_MARKER) + CONTENT_MARKER.length - 1;
    section.write(section.open() + json.slice(0, split));
    for (let start = 0; start < bytes.length; start += BASE64_CHUNK_BYTES) {
      section.writeBytes(
        encodeBase64Bytes(bytes.subarray(start, start + BASE64_CHUNK_BYTES)),
      );
    }
    section.write(json.slice(split));
    section.count++;
    return ok(undefined);
  }

  finish(): {
    readonly blob: Blob;
    readonly counts: Readonly<Partial<Record<TableName, number>>>;
  } {
    this.#assertOpen();
    this.#finished = true;
    const counts: Partial<Record<TableName, number>> = {};
    const digests: Partial<Record<TableName, string>> = {};
    for (const table of this.#tables) {
      const section = this.#section(table);
      section.close();
      counts[table] = section.count;
      digests[table] = section.digest;
    }

    const h = this.#header;
    const ordered = (values: Partial<Record<TableName, unknown>>) =>
      `{${this.#tables
        .map(
          (table) =>
            `${JSON.stringify(table)}:${JSON.stringify(values[table])}`,
        )
        .join(",")}}`;
    const head =
      `{"format":${JSON.stringify(h.format)}` +
      `,"backupFormatVersion":${JSON.stringify(h.backupFormatVersion)}` +
      `,"schemaVersion":${JSON.stringify(h.schemaVersion)}` +
      `,"appVersion":${JSON.stringify(h.appVersion)}` +
      `,"backupId":${JSON.stringify(h.backupId)}` +
      `,"exportedAt":${JSON.stringify(h.exportedAt)}` +
      `,"includesAttachments":${JSON.stringify(h.includesAttachments)}` +
      `,"counts":${ordered(counts)}` +
      `,"tables":{\n`;
    const parts: BlobPart[] = [head];
    this.#tables.forEach((table, index) => {
      parts.push(`${index === 0 ? "" : ",\n"}${JSON.stringify(table)}:`);
      parts.push(...this.#section(table).parts);
    });
    parts.push(
      `\n},"integrity":{"algorithm":${JSON.stringify(BACKUP_HASH_ALGORITHM)}` +
        `,"tables":${ordered(digests)}}}\n`,
    );
    return {
      blob: new Blob(parts, { type: "application/json" }),
      counts,
    };
  }

  #section(table: TableName): TableSection {
    const section = this.#sections.get(table);
    if (!section) throw new Error(`Table ${table} is not part of this backup`);
    return section;
  }

  #assertOpen(): void {
    if (this.#finished) throw new Error("Backup writer already finished");
  }
}
