// @vitest-environment node
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import {
  AppDatabase,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_V1,
  SCHEMA_VERSIONS,
  applySchemaVersions,
  recordMigrations,
  type SchemaVersion,
} from "@/infrastructure/db";
import { createTestDatabase, databaseOptions } from "../../support/database";
import { expectOk, qsoDraft, seedOwners } from "../../support/records";

/*
 * Incremental schema strategy (ADR-0006, DATABASE.md § 7). No real v2 exists
 * before M5: a synthetic v2 declared only here proves that a database
 * populated at v1 is upgraded, transformed and re-indexed, and that a
 * failing upgrade leaves v1 and its data untouched.
 */

/** Synthetic v2: new index on qso_logs.contestId, `comment` → `notes`. */
const TEST_V2: SchemaVersion = {
  version: 2,
  stores: {
    qso_logs:
      "id, stationProfileId, callsign, datetimeOn, band, mode, dxcc, importJobId, contestId, " +
      "[band+mode], [callsign+datetimeOn], [stationProfileId+datetimeOn]",
  },
  migration: {
    from: 1,
    to: 2,
    tables: {
      qso_logs: (record) => {
        if (!("comment" in record)) return { ...record };
        const { comment, ...rest } = record;
        return { ...rest, notes: `migrated: ${String(comment)}` };
      },
    },
  },
};

function openWith(
  test: ReturnType<typeof createTestDatabase>,
  versions: readonly SchemaVersion[],
): Dexie {
  const db = new Dexie(test.name, databaseOptions(test));
  applySchemaVersions(db, versions);
  return db;
}

describe("schema versions", () => {
  it("v1 is the only version and matches DATABASE.md § 5 verbatim", () => {
    expect(SCHEMA_VERSIONS).toEqual([SCHEMA_V1]);
    expect(CURRENT_SCHEMA_VERSION).toBe(SCHEMA_VERSIONS.length);
    expect(SCHEMA_V1.migration).toBeUndefined();
    expect(SCHEMA_V1.stores).toEqual({
      station_profiles: "id, kind, callsign, isDefault",
      qso_logs:
        "id, stationProfileId, callsign, datetimeOn, band, mode, dxcc, importJobId, " +
        "[band+mode], [callsign+datetimeOn], [stationProfileId+datetimeOn]",
      swl_receptions:
        "id, stationProfileId, category, datetimeStart, frequencyHz, stationName, country, language, " +
        "[category+datetimeStart]",
      reception_details: "id, &receptionId",
      qsl_records:
        "id, channel, status, [subjectType+subjectId], [channel+status]",
      attachments: "id, sha256, [ownerType+ownerId]",
      settings: "key",
      data_sources: "key",
      import_jobs: "id, kind, status, startedAt",
    });
  });

  it("is frozen, so released versions cannot be edited at runtime", () => {
    expect(Object.isFrozen(SCHEMA_V1)).toBe(true);
    expect(Object.isFrozen(SCHEMA_V1.stores)).toBe(true);
    expect(Object.isFrozen(SCHEMA_VERSIONS)).toBe(true);
  });

  it("collects no record migration for v1", () => {
    expect(recordMigrations()).toEqual([]);
    expect(recordMigrations([SCHEMA_V1, TEST_V2])).toEqual([TEST_V2.migration]);
  });

  it("rejects non-consecutive versions and misplaced migrations", () => {
    const db = () => new Dexie("unused");
    expect(() => applySchemaVersions(db(), [TEST_V2])).toThrow(
      /consecutive from 1/,
    );
    expect(() =>
      applySchemaVersions(db(), [
        SCHEMA_V1,
        { ...TEST_V2, migration: { from: 0, to: 1, tables: {} } },
      ]),
    ).toThrow(/does not lead to version 2/);
  });
});

describe("upgrade from a previous schema (synthetic v2)", () => {
  it("transforms the stored records and builds the new index", async () => {
    const test = createTestDatabase();
    const { profile, qso } = await seedOwners(test.container);
    const withComment = expectOk(
      await test.container.repositories.qsoLogs.create(
        qsoDraft(profile.id, { comment: "tnx", contestId: "CQ-WW-SSB" }),
      ),
    );
    test.container.dispose();
    test.db.close();

    const upgraded = openWith(test, [SCHEMA_V1, TEST_V2]);
    await upgraded.open();
    expect(upgraded.verno).toBe(2);

    const table = upgraded.table("qso_logs");
    const { comment: _comment, ...withoutComment } = withComment;
    expect(await table.get(withComment.id)).toEqual({
      ...withoutComment,
      notes: "migrated: tnx",
    });
    expect(await table.get(qso.id)).toEqual(qso);
    // New index usable, old indexes kept, other tables untouched.
    expect(
      await table.where("contestId").equals("CQ-WW-SSB").primaryKeys(),
    ).toEqual([withComment.id]);
    expect(
      await table.where("[band+mode]").equals(["20m", "FT8"]).count(),
    ).toBe(2);
    expect(await upgraded.table("swl_receptions").count()).toBe(1);
    upgraded.close();
  });

  it("rolls back a failing upgrade: v1 and its data stay as they were", async () => {
    const test = createTestDatabase();
    const { qso } = await seedOwners(test.container);
    test.container.dispose();
    test.db.close();

    const failing = openWith(test, [
      SCHEMA_V1,
      {
        ...TEST_V2,
        migration: {
          from: 1,
          to: 2,
          tables: {
            qso_logs: () => {
              throw new Error("corrupt record");
            },
          },
        },
      },
    ]);
    await expect(failing.open()).rejects.toThrow("corrupt record");
    failing.close();

    const reopened = test.reopen();
    expectOk(await reopened.container.connect());
    await reopened.db.open();
    expect(reopened.db.verno).toBe(1);
    expect(reopened.db.backendDB().version).toBe(10);
    expect(
      expectOk(await reopened.container.repositories.qsoLogs.get(qso.id)),
    ).toEqual(qso);
  });

  it("reports a failing upgrade of the app database as unavailable", async () => {
    // AppDatabase declares only v1: a synthetic v2 with a failing upgrade is
    // declared on top of it, before opening, to check connect().
    const test = createTestDatabase();
    await seedOwners(test.container);
    test.container.dispose();
    test.db.close();

    const failing = new AppDatabase(databaseOptions(test));
    failing
      .version(2)
      .stores(TEST_V2.stores)
      .upgrade(() => {
        throw new Error("corrupt record");
      });
    expect(await failing.connect()).toMatchObject({
      ok: false,
      error: { code: "persistence.unavailable", reason: "upgrade-failed" },
    });
  });
});
