import type { Attachment } from "@/core/attachment";
import {
  TABLE_NAMES,
  type BackupGateway,
  type BackupRecordSink,
  type DatabaseSnapshotInfo,
  type LocalDataState,
  type MigrationError,
  type PersistenceError,
  type RestoreWritePlan,
  type StoredRecord,
  type TableCounts,
  type TableName,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";
import type { AppDatabase } from "./app-database";
import { toPersistenceError } from "./errors";
import {
  migrateRecord,
  migrateTables,
  type RecordMigration,
} from "./migrations/record-migration";
import { CURRENT_SCHEMA_VERSION, recordMigrations } from "./schema";

/*
 * Dexie adapter of BackupGateway (ADR-0015). Reads are consistent snapshots
 * (one read transaction over every table); the restore is one read-write
 * transaction that joins the caller's unit of work.
 */

/** Tables of a backup per schema version, in file order (DATABASE.md § 2). */
const BACKUP_TABLES: Readonly<Record<number, readonly TableName[]>> = {
  1: TABLE_NAMES,
};

/** Tables keyed by a catalog key instead of `id` (DATABASE.md § 1). */
const KEY_FIELD: Readonly<Partial<Record<TableName, string>>> = {
  settings: "key",
  data_sources: "key",
};

function primaryKey(table: TableName, record: StoredRecord): string {
  return String(record[KEY_FIELD[table] ?? "id"]);
}

function emptyCounts(): Record<TableName, number> {
  return Object.fromEntries(TABLE_NAMES.map((table) => [table, 0])) as Record<
    TableName,
    number
  >;
}

/** Storage failures become results; anything else is a bug and propagates. */
async function storage<T>(
  operation: () => Promise<T>,
  table?: () => TableName | undefined,
): Promise<Result<T, PersistenceError>> {
  try {
    return ok(await operation());
  } catch (error) {
    const mapped = toPersistenceError(error, table?.());
    if (!mapped) throw error;
    return err(mapped);
  }
}

export class DexieBackupGateway implements BackupGateway {
  readonly schemaVersion = CURRENT_SCHEMA_VERSION;
  readonly #db: AppDatabase;
  readonly #migrations: readonly RecordMigration[];

  constructor(
    db: AppDatabase,
    migrations: readonly RecordMigration[] = recordMigrations(),
  ) {
    this.#db = db;
    this.#migrations = migrations;
  }

  tablesOf(schemaVersion: number): readonly TableName[] | undefined {
    return BACKUP_TABLES[schemaVersion];
  }

  checkMigration(fromVersion: number): Result<void, MigrationError> {
    const probe = migrateTables(
      {},
      fromVersion,
      this.schemaVersion,
      this.#migrations,
    );
    return probe.ok ? ok(undefined) : probe;
  }

  migrateRecord(
    table: TableName,
    record: StoredRecord,
    fromVersion: number,
  ): StoredRecord | null {
    const migrated = migrateRecord(
      table,
      record,
      fromVersion,
      this.schemaVersion,
      this.#migrations,
    );
    if (!migrated.ok) {
      throw new Error(
        `No migration ${migrated.error.from}→${migrated.error.to}: call checkMigration first`,
      );
    }
    return migrated.value;
  }

  inspect(): Promise<Result<DatabaseSnapshotInfo, PersistenceError>> {
    const db = this.#db;
    return storage(() =>
      db.transaction("r", db.tables, async () => {
        const counts = emptyCounts();
        for (const table of TABLE_NAMES) {
          counts[table] = await db.table(table).count();
        }
        let attachmentBytes = 0;
        await db.attachments.each((attachment) => {
          attachmentBytes += attachment.sizeBytes;
        });
        return { counts, attachmentBytes };
      }),
    );
  }

  async exportSnapshot(
    sink: BackupRecordSink,
    options: { readonly includeAttachments: boolean },
  ): Promise<Result<{ readonly completed: boolean }, PersistenceError>> {
    const db = this.#db;
    const attachments: Attachment[] = [];
    let stopped = false;
    // One read transaction: every table comes from the same snapshot. The
    // sink serialises synchronously, so the transaction never waits for
    // anything but IndexedDB. Attachment contents are read afterwards: the
    // Blobs obtained here stay valid after the transaction.
    const read = await storage(() =>
      db.transaction("r", db.tables, async () => {
        for (const table of TABLE_NAMES) {
          if (stopped) return;
          if (table === "attachments") {
            if (options.includeAttachments) {
              await db.attachments
                .orderBy(":id")
                .each((attachment) => attachments.push(attachment));
            }
            continue;
          }
          await db
            .table(table)
            .orderBy(":id")
            .until(() => stopped)
            .each((record: StoredRecord) => {
              if (!sink.record(table, record)) stopped = true;
            });
        }
      }),
    );
    if (!read.ok) return read;
    if (stopped) return ok({ completed: false });
    for (const { blob, ...metadata } of attachments) {
      if (!(await sink.attachment(metadata, blob))) {
        return ok({ completed: false });
      }
    }
    return ok({ completed: true });
  }

  readLocalState(): Promise<Result<LocalDataState, PersistenceError>> {
    const db = this.#db;
    return storage(() =>
      db.transaction("r", db.tables, async () => {
        const versions = {} as Record<
          TableName,
          Map<string, string | undefined>
        >;
        const receptionCategories = new Map<string, string>();
        const receptionDetails: { id: string; receptionId: string }[] = [];
        const qslRecords: LocalDataState["qslRecords"][number][] = [];
        const localAttachments: LocalDataState["attachments"][number][] = [];
        let defaultStationProfileId: string | undefined;

        for (const table of TABLE_NAMES) {
          const map = new Map<string, string | undefined>();
          versions[table] = map;
          await db.table(table).each((record: StoredRecord) => {
            const key = primaryKey(table, record);
            const updatedAt = record["updatedAt"];
            map.set(key, typeof updatedAt === "string" ? updatedAt : undefined);
            switch (table) {
              case "station_profiles":
                if (record["isDefault"] === 1) defaultStationProfileId = key;
                break;
              case "swl_receptions":
                receptionCategories.set(key, String(record["category"]));
                break;
              case "reception_details":
                receptionDetails.push({
                  id: key,
                  receptionId: String(record["receptionId"]),
                });
                break;
              case "qsl_records":
                qslRecords.push({
                  id: key,
                  subjectType: String(record["subjectType"]),
                  subjectId: String(record["subjectId"]),
                  channel: String(record["channel"]),
                });
                break;
              case "attachments":
                localAttachments.push({
                  id: key,
                  ownerType: String(record["ownerType"]),
                  ownerId: String(record["ownerId"]),
                  sha256: String(record["sha256"]),
                });
                break;
            }
          });
        }

        const counts = emptyCounts();
        for (const table of TABLE_NAMES) counts[table] = versions[table].size;
        return {
          counts,
          versions,
          ...(defaultStationProfileId ? { defaultStationProfileId } : {}),
          receptionCategories,
          receptionDetails,
          qslRecords,
          attachments: localAttachments,
        };
      }),
    );
  }

  applyRestore(
    plan: RestoreWritePlan,
  ): Promise<Result<TableCounts, PersistenceError>> {
    const db = this.#db;
    let current: TableName | undefined;
    // A failure thrown out of this (possibly nested) transaction aborts the
    // ambient unit of work too: nothing of the restore can be committed.
    return storage(
      () =>
        db.transaction("rw", db.tables, async () => {
          for (const table of plan.clear) {
            current = table;
            await db.table(table).clear();
          }
          for (const table of TABLE_NAMES) {
            const keys = plan.deletes[table];
            if (!keys?.length) continue;
            current = table;
            await db.table(table).bulkDelete([...keys]);
          }
          for (const table of TABLE_NAMES) {
            const records = plan.puts[table];
            if (!records?.length) continue;
            current = table;
            await db.table(table).bulkPut([...records]);
          }
          current = undefined;
          const counts = emptyCounts();
          for (const table of TABLE_NAMES) {
            counts[table] = await db.table(table).count();
          }
          return counts;
        }),
      () => current,
    );
  }
}
