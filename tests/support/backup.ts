import { jsonBackupCodec } from "@/modules/settings-backup/infrastructure/json-backup-codec";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from "@/modules/settings-backup/domain/backup-manifest";
import type { BackupHeader } from "@/modules/settings-backup/application/backup-ports";
import type { AttachmentMetadata } from "@/core/attachment";
import type { UtcDateTime } from "@/core/time";
import {
  TABLE_NAMES,
  type StoredRecord,
  type TableName,
} from "@/shared/application";
import { sha256Hex } from "@/infrastructure/files/sha256";

/*
 * Synthetic datasets and backup files for tests (Vitest and the Chromium
 * harness). Values are invented and already canonical (the form the entity
 * schemas output), so a restore followed by an export gives back the same
 * text. Ids are derived from a counter: deterministic, valid UUID v4.
 */

export type Tables = Record<TableName, StoredRecord[]>;

/** Deterministic UUID v4 from a number. */
export function uuidFor(n: number): string {
  const hex = n.toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}

/** Deterministic pseudo-random bytes (xorshift32), for attachment contents. */
export function pseudoRandomBytes(
  size: number,
  seed: number,
): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  let x = (seed * 2 + 1) >>> 0;
  for (let i = 0; i < size; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    bytes[i] = x & 0xff;
  }
  return bytes;
}

export function emptyTables(): Tables {
  const tables = {} as Tables;
  for (const table of TABLE_NAMES) tables[table] = [];
  return tables;
}

export interface SyntheticOptions {
  readonly qsos: number;
  /** Attachments on the first QSO, each of `attachmentBytes`. */
  readonly attachments?: number;
  readonly attachmentBytes?: number;
}

const instant = (seconds: number) =>
  new Date(Date.UTC(2026, 0, 1) + seconds * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

/**
 * A consistent dataset: 2 profiles, `qsos` QSO, one reception (with
 * details) every 4 QSO, one QSL every 10 QSO, settings, a data source, an
 * import job and optional attachments. Records sorted by primary key.
 */
export function syntheticTables(options: SyntheticOptions): Tables {
  const tables = emptyTables();
  let next = 1;
  const id = () => uuidFor(next++);
  const created = instant(0);

  const home = id();
  const portable = id();
  tables.station_profiles.push(
    {
      id: home,
      name: "Casa",
      kind: "both",
      callsign: "IZ1ABC",
      locator: "JN45dl",
      isDefault: 1,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: portable,
      name: "Portatile",
      kind: "swl",
      swlId: "I-12345",
      isDefault: 0,
      createdAt: created,
      updatedAt: created,
    },
  );

  for (let i = 0; i < options.qsos; i++) {
    const qsoId = id();
    const on = instant(3600 + i * 60);
    tables.qso_logs.push({
      id: qsoId,
      stationProfileId: home,
      callsign: `I${i % 10}XYZ`,
      datetimeOn: on,
      frequencyHz: 14_074_000 + (i % 100) * 10,
      band: "20m",
      mode: "FT8",
      rstSent: "-10",
      rstRcvd: "-12",
      comment: `QSO numero ${i} – tnx 73 📻`,
      origin: "manual",
      createdAt: on,
      updatedAt: on,
    });
    if (i % 4 === 0) {
      const receptionId = id();
      tables.swl_receptions.push({
        id: receptionId,
        stationProfileId: portable,
        category: "broadcast",
        datetimeStart: on,
        frequencyHz: 6_070_000,
        modulation: "AM",
        stationName: `Radio ${i}`,
        sinpo: "45444",
        createdAt: on,
        updatedAt: on,
      });
      tables.reception_details.push({
        id: id(),
        receptionId,
        category: "broadcast",
        data: { programme: "Notiziario", qslRequested: true },
        createdAt: on,
        updatedAt: on,
      });
    }
    if (i % 10 === 0) {
      tables.qsl_records.push({
        id: id(),
        subjectType: "qso",
        subjectId: qsoId,
        channel: "paper",
        status: "sent",
        sentAt: on,
        origin: "manual",
        createdAt: on,
        updatedAt: on,
      });
    }
  }

  const firstQso = tables.qso_logs[0];
  for (let i = 0; i < (options.attachments ?? 0); i++) {
    if (!firstQso) break;
    const bytes = pseudoRandomBytes(options.attachmentBytes ?? 1024, i + 1);
    tables.attachments.push({
      id: id(),
      ownerType: "qso",
      ownerId: firstQso["id"],
      fileName: `allegato-${i}.bin`,
      mimeType: "audio/ogg",
      sizeBytes: bytes.length,
      sha256: sha256Hex(bytes),
      blob: new Blob([bytes], { type: "audio/ogg" }),
      createdAt: created,
    });
  }

  tables.settings.push({
    key: "app",
    value: { theme: "dark" },
    updatedAt: created,
  });
  tables.data_sources.push({ key: "eibi", accessMode: "manual-import" });
  tables.import_jobs.push({
    id: id(),
    kind: "csv",
    status: "cancelled",
    startedAt: created,
    finishedAt: created,
    counts: {
      total: 0,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
    },
    errors: [],
  });

  for (const table of TABLE_NAMES) {
    const key = table === "settings" || table === "data_sources" ? "key" : "id";
    tables[table].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1));
  }
  return tables;
}

export interface BackupFileOptions {
  readonly includeAttachments?: boolean;
  readonly schemaVersion?: number;
  readonly backupId?: string;
  readonly exportedAt?: string;
  readonly appVersion?: string;
}

/** A backup file of format v1 written with the production writer. */
export async function writeBackupFile(
  tables: Tables,
  options: BackupFileOptions = {},
): Promise<Blob> {
  const includeAttachments =
    options.includeAttachments ?? tables.attachments.length > 0;
  const header: BackupHeader = {
    format: BACKUP_FORMAT,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: options.schemaVersion ?? 1,
    appVersion: options.appVersion ?? "0.0.0-test",
    backupId: options.backupId ?? uuidFor(0xbac0),
    exportedAt: (options.exportedAt ?? "2026-10-24T10:00:00Z") as UtcDateTime,
    includesAttachments: includeAttachments,
  };
  const included = TABLE_NAMES.filter(
    (table) => includeAttachments || table !== "attachments",
  );
  const writer = jsonBackupCodec.createWriter(header, included);
  for (const table of included) {
    if (table === "attachments") continue;
    for (const record of tables[table]) writer.record(table, record);
  }
  if (includeAttachments) {
    for (const { blob, ...metadata } of tables.attachments) {
      const written = await writer.attachment(
        metadata as unknown as AttachmentMetadata,
        blob as Blob,
      );
      if (!written.ok) throw new Error(written.error.code);
    }
  }
  return writer.finish().blob;
}

/** Root members of a backup file, parsed (small files only). */
export async function parseBackup(
  blob: Blob,
): Promise<Record<string, unknown>> {
  return JSON.parse(await blob.text()) as Record<string, unknown>;
}

/** Every table of a database, records sorted by key, Blobs as bytes. */
export async function snapshotTables(db: {
  table(name: string): { toArray(): Promise<unknown[]> };
}): Promise<Record<TableName, unknown[]>> {
  const snapshot = {} as Record<TableName, unknown[]>;
  for (const table of TABLE_NAMES) {
    const key = table === "settings" || table === "data_sources" ? "key" : "id";
    const records = (await db.table(table).toArray()) as Record<
      string,
      unknown
    >[];
    const plain = await Promise.all(
      records.map(async (record) =>
        record["blob"] instanceof Blob
          ? {
              ...record,
              blob: Array.from(
                new Uint8Array(await record["blob"].arrayBuffer()),
              ),
              blobType: record["blob"].type,
            }
          : record,
      ),
    );
    snapshot[table] = plain.sort((a, b) =>
      String(a[key]) < String(b[key]) ? -1 : 1,
    );
  }
  return snapshot;
}
