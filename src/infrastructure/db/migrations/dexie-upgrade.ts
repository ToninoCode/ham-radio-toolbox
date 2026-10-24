import type { Transaction } from "dexie";
import type { RecordMigration } from "./record-migration";

/**
 * Dexie `upgrade()` callback that applies a pure record migration to the
 * stored data, inside the version-change transaction: if any step throws,
 * IndexedDB aborts the whole upgrade and the database stays at the previous
 * version with its data unchanged.
 */
export function toDexieUpgrade(migration: RecordMigration) {
  return async (tx: Transaction): Promise<void> => {
    for (const [table, transform] of Object.entries(migration.tables)) {
      if (!transform) continue;
      await tx
        .table(table)
        .toCollection()
        .modify((value: Record<string, unknown>, ref: { value?: unknown }) => {
          const next = transform(value);
          if (next === null) delete ref.value;
          else ref.value = next;
        });
    }
  };
}
