// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  migrateTableRecords,
  migrateTables,
  type RecordMigration,
} from "./record-migration";

/*
 * Pure record migrations (ADR-0006, DATABASE.md § 7). Schema v1 has no
 * migration: these tests use synthetic steps to check the mechanism that v2
 * (M5) and the restore of old backups (Block C) will rely on.
 */

/** v1 → v2 (synthetic): `comment` becomes `notes`, sample QSO are dropped. */
const v1ToV2: RecordMigration = {
  from: 1,
  to: 2,
  tables: {
    qso_logs: (record) => {
      if (record["isSample"] === 1) return null;
      if (!("comment" in record)) return { ...record };
      const { comment, ...rest } = record;
      return { ...rest, notes: comment };
    },
  },
};

/** v2 → v3 (synthetic): settings get a `scope`. */
const v2ToV3: RecordMigration = {
  from: 2,
  to: 3,
  tables: {
    settings: (record) => ({ scope: "app", ...record }),
  },
};

describe("migrateTables", () => {
  const tables = {
    qso_logs: [
      { id: "a", comment: "tnx" },
      { id: "b", isSample: 1 },
      { id: "c" },
    ],
    settings: [{ key: "app", value: {} }],
  };

  it("applies every step in order and leaves other tables as they are", () => {
    const result = migrateTables(tables, 1, 3, [v2ToV3, v1ToV2]);
    expect(result).toEqual({
      ok: true,
      value: {
        qso_logs: [{ id: "a", notes: "tnx" }, { id: "c" }],
        settings: [{ scope: "app", key: "app", value: {} }],
      },
    });
  });

  it("does not modify its input", () => {
    const snapshot = structuredClone(tables);
    migrateTables(tables, 1, 3, [v1ToV2, v2ToV3]);
    expect(tables).toEqual(snapshot);
  });

  it("is the identity when the versions are equal", () => {
    expect(migrateTables(tables, 3, 3, [])).toEqual({
      ok: true,
      value: tables,
    });
  });

  it("is idempotent for idempotent transforms", () => {
    const once = migrateTables(tables, 1, 2, [v1ToV2]);
    if (!once.ok) throw new Error("migration failed");
    const twice = migrateTables(once.value, 1, 2, [v1ToV2]);
    expect(twice).toEqual(once);
  });

  it("refuses data of a newer schema", () => {
    expect(migrateTables(tables, 4, 3, [])).toEqual({
      ok: false,
      error: { code: "migration.newer-version", from: 4, to: 3 },
    });
  });

  it("reports a missing step", () => {
    expect(migrateTables(tables, 1, 3, [v1ToV2])).toEqual({
      ok: false,
      error: { code: "migration.missing-step", from: 2, to: 3 },
    });
  });
});

describe("migrateTableRecords", () => {
  it("keeps values that are not records, for the validation to report them", () => {
    const transform = (record: Readonly<Record<string, unknown>>) => ({
      ...record,
      seen: true,
    });
    expect(migrateTableRecords([null, 1, [2], { id: "a" }], transform)).toEqual(
      [null, 1, [2], { id: "a", seen: true }],
    );
  });
});
