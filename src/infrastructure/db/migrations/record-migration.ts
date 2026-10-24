import type {
  MigrationError,
  StoredRecord,
  TableName,
  TableRecords,
} from "@/shared/application";
import { err, ok, type Result } from "@/shared/types";

/*
 * Data migrations between schema versions as pure functions (ADR-0006,
 * DATABASE.md § 7). The same functions are applied by the Dexie upgrade
 * (dexie-upgrade.ts) to the stored records and by the restore to the
 * records of an older backup (one at a time, `migrateRecord`), so this file
 * has no dependency on Dexie or on the browser.
 */

export type { StoredRecord };

/**
 * Transforms one record of a table to the next version, or drops it
 * (`null`). Must be pure: no mutation of the argument, no I/O, no clock.
 * Should be idempotent (applying it to an already migrated record changes
 * nothing), so that a partially migrated backup can be migrated again.
 */
export type RecordTransform = (
  record: StoredRecord,
) => Record<string, unknown> | null;

/** Data changes from version `from` to `from + 1`, per table. */
export interface RecordMigration {
  readonly from: number;
  readonly to: number;
  readonly tables: Readonly<Partial<Record<TableName, RecordTransform>>>;
}

function isRecord(value: unknown): value is StoredRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Applies one transform to a table's records; non-objects are kept as-is. */
export function migrateTableRecords(
  records: readonly unknown[],
  transform: RecordTransform,
): unknown[] {
  const migrated: unknown[] = [];
  for (const record of records) {
    if (!isRecord(record)) {
      migrated.push(record);
      continue;
    }
    const next = transform(record);
    if (next !== null) migrated.push(next);
  }
  return migrated;
}

/**
 * Brings records exported at schema version `from` to version `to`,
 * applying every step in order. The input is not modified. Errors:
 * `migration.newer-version` when `from > to` (backup of a newer app),
 * `migration.missing-step` when a step between the two is not defined.
 */
export function migrateTables(
  tables: TableRecords,
  from: number,
  to: number,
  migrations: readonly RecordMigration[],
): Result<TableRecords, MigrationError> {
  if (from > to) return err({ code: "migration.newer-version", from, to });
  let current: TableRecords = tables;
  for (let version = from; version < to; version++) {
    const step = migrations.find(
      (migration) => migration.from === version && migration.to === version + 1,
    );
    if (!step) {
      return err({
        code: "migration.missing-step",
        from: version,
        to: version + 1,
      });
    }
    const next: Partial<Record<TableName, unknown[]>> = {};
    for (const [table, records] of Object.entries(current) as [
      TableName,
      readonly unknown[],
    ][]) {
      const transform = step.tables[table];
      next[table] = transform
        ? migrateTableRecords(records, transform)
        : [...records];
    }
    current = next;
  }
  return ok(current);
}

/**
 * Brings one record of `table` from version `from` to `to` (restore of a
 * backup, record by record), or `null` if a step drops it. Same errors as
 * {@link migrateTables}.
 */
export function migrateRecord(
  table: TableName,
  record: StoredRecord,
  from: number,
  to: number,
  migrations: readonly RecordMigration[],
): Result<Record<string, unknown> | null, MigrationError> {
  if (from > to) return err({ code: "migration.newer-version", from, to });
  let current: Record<string, unknown> | null = { ...record };
  for (let version = from; version < to; version++) {
    const step = migrations.find(
      (migration) => migration.from === version && migration.to === version + 1,
    );
    if (!step) {
      return err({
        code: "migration.missing-step",
        from: version,
        to: version + 1,
      });
    }
    const transform = step.tables[table];
    if (transform && current) current = transform(current);
  }
  return ok(current);
}
