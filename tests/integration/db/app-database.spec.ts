// @vitest-environment node
import Dexie from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import {
  AppDatabase,
  CURRENT_SCHEMA_VERSION,
  DATABASE_NAME,
} from "@/infrastructure/db";
import { TABLE_NAMES } from "@/shared/application";
import { createTestDatabase, databaseOptions } from "../../support/database";
import {
  expectErr,
  expectOk,
  qsoDraft,
  seedOwners,
  stationProfileDraft,
} from "../../support/records";

/*
 * BL-M2-05: AppDatabase and schema v1 against DATABASE.md § 3/§ 5, on an
 * isolated fake-indexeddb per test. fake-indexeddb implements the IndexedDB
 * specification in memory: real browsers (Chrome for Android) are covered
 * by the manual checks listed in DATABASE.md § 10.1.
 */

interface PhysicalIndex {
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

interface PhysicalStore {
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: Record<string, PhysicalIndex>;
}

const index = (keyPath: string | string[], unique = false): PhysicalIndex => ({
  keyPath,
  unique,
  multiEntry: false,
});

/**
 * Physical schema v1 as created in IndexedDB. Changing it breaks the stored
 * data of every user: only a new schema version may do it (ADR-0006).
 */
const EXPECTED_V1: Record<string, PhysicalStore> = {
  station_profiles: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      callsign: index("callsign"),
      isDefault: index("isDefault"),
      kind: index("kind"),
    },
  },
  qso_logs: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      "[band+mode]": index(["band", "mode"]),
      "[callsign+datetimeOn]": index(["callsign", "datetimeOn"]),
      "[stationProfileId+datetimeOn]": index([
        "stationProfileId",
        "datetimeOn",
      ]),
      band: index("band"),
      callsign: index("callsign"),
      datetimeOn: index("datetimeOn"),
      dxcc: index("dxcc"),
      importJobId: index("importJobId"),
      mode: index("mode"),
      stationProfileId: index("stationProfileId"),
    },
  },
  swl_receptions: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      "[category+datetimeStart]": index(["category", "datetimeStart"]),
      category: index("category"),
      country: index("country"),
      datetimeStart: index("datetimeStart"),
      frequencyHz: index("frequencyHz"),
      language: index("language"),
      stationName: index("stationName"),
      stationProfileId: index("stationProfileId"),
    },
  },
  reception_details: {
    keyPath: "id",
    autoIncrement: false,
    indexes: { receptionId: index("receptionId", true) },
  },
  qsl_records: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      "[channel+status]": index(["channel", "status"]),
      "[subjectType+subjectId]": index(["subjectType", "subjectId"]),
      channel: index("channel"),
      status: index("status"),
    },
  },
  attachments: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      "[ownerType+ownerId]": index(["ownerType", "ownerId"]),
      sha256: index("sha256"),
    },
  },
  settings: { keyPath: "key", autoIncrement: false, indexes: {} },
  data_sources: { keyPath: "key", autoIncrement: false, indexes: {} },
  import_jobs: {
    keyPath: "id",
    autoIncrement: false,
    indexes: {
      kind: index("kind"),
      startedAt: index("startedAt"),
      status: index("status"),
    },
  },
};

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Reads the physical schema with the raw IndexedDB API (no Dexie). */
async function physicalSchema(factory: IDBFactory, name: string) {
  const raw = await request(factory.open(name));
  const stores: Record<string, PhysicalStore> = {};
  const names = Array.from(raw.objectStoreNames);
  const tx = raw.transaction(names, "readonly");
  for (const storeName of names) {
    const store = tx.objectStore(storeName);
    const indexes: Record<string, PhysicalIndex> = {};
    for (const indexName of Array.from(store.indexNames)) {
      const idx = store.index(indexName);
      indexes[indexName] = {
        keyPath: idx.keyPath,
        unique: idx.unique,
        multiEntry: idx.multiEntry,
      };
    }
    stores[storeName] = {
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes,
    };
  }
  const version = raw.version;
  raw.close();
  return { version, stores };
}

describe("AppDatabase: creation and schema v1", () => {
  it("uses the application name by default and declares version 1", () => {
    const db = new AppDatabase({ indexedDB: new IDBFactory(), IDBKeyRange });
    expect(db.name).toBe(DATABASE_NAME);
    expect(db.verno).toBe(1);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("opens with exactly the nine tables of DATABASE.md", async () => {
    const { container, db } = createTestDatabase();
    expectOk(await container.connect());
    await db.open();
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [...TABLE_NAMES].sort(),
    );
  });

  it("declares primary keys and indexes as DATABASE.md § 5 (Dexie view)", async () => {
    const { db } = createTestDatabase();
    await db.open();
    const declared = Object.fromEntries(
      db.tables.map((table) => [
        table.name,
        {
          primaryKey: table.schema.primKey.keyPath,
          indexes: table.schema.indexes
            .map((idx) => `${idx.unique ? "&" : ""}${idx.name}`)
            .sort(),
        },
      ]),
    );
    expect(declared).toEqual({
      station_profiles: {
        primaryKey: "id",
        indexes: ["callsign", "isDefault", "kind"],
      },
      qso_logs: {
        primaryKey: "id",
        indexes: [
          "[band+mode]",
          "[callsign+datetimeOn]",
          "[stationProfileId+datetimeOn]",
          "band",
          "callsign",
          "datetimeOn",
          "dxcc",
          "importJobId",
          "mode",
          "stationProfileId",
        ],
      },
      swl_receptions: {
        primaryKey: "id",
        indexes: [
          "[category+datetimeStart]",
          "category",
          "country",
          "datetimeStart",
          "frequencyHz",
          "language",
          "stationName",
          "stationProfileId",
        ],
      },
      reception_details: { primaryKey: "id", indexes: ["&receptionId"] },
      qsl_records: {
        primaryKey: "id",
        indexes: [
          "[channel+status]",
          "[subjectType+subjectId]",
          "channel",
          "status",
        ],
      },
      attachments: {
        primaryKey: "id",
        indexes: ["[ownerType+ownerId]", "sha256"],
      },
      settings: { primaryKey: "key", indexes: [] },
      data_sources: { primaryKey: "key", indexes: [] },
      import_jobs: {
        primaryKey: "id",
        indexes: ["kind", "startedAt", "status"],
      },
    });
  });

  it("creates the same physical schema in IndexedDB (index compatibility)", async () => {
    const test = createTestDatabase();
    expectOk(await test.container.connect());
    test.container.dispose();
    const physical = await physicalSchema(test.indexedDB, test.name);
    // Dexie stores version n as IndexedDB version n × 10.
    expect(physical.version).toBe(10);
    expect(physical.stores).toEqual(EXPECTED_V1);
  });
});

describe("AppDatabase: persistence", () => {
  it("keeps the data after closing and reopening in the same environment", async () => {
    const first = createTestDatabase();
    const { profile, qso, reception } = await seedOwners(first.container);

    const second = first.reopen();
    const repositories = second.container.repositories;
    expect(
      expectOk(await repositories.stationProfiles.get(profile.id)),
    ).toEqual(profile);
    expect(expectOk(await repositories.qsoLogs.get(qso.id))).toEqual(qso);
    expect(
      expectOk(await repositories.swlReceptions.get(reception.id)).reception,
    ).toEqual(reception);
  });

  it("isolates test databases from each other", async () => {
    const a = createTestDatabase();
    const b = createTestDatabase();
    expectOk(
      await a.container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    expect(
      expectOk(await b.container.repositories.stationProfiles.list()),
    ).toEqual([]);
  });

  it("stores optional fields as absent, never as undefined", async () => {
    const { container, db } = createTestDatabase();
    const profile = expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft({ qth: "   ", operatorName: undefined }),
      ),
    );
    const qso = expectOk(
      await container.repositories.qsoLogs.create(
        qsoDraft(profile.id, { notes: "", name: undefined }),
      ),
    );
    const stored = await db.qso_logs.get(qso.id);
    expect(stored && Object.keys(stored)).not.toContain("notes");
    expect(stored && Object.keys(stored)).not.toContain("name");
    const storedProfile = await db.station_profiles.get(profile.id);
    expect(storedProfile && "qth" in storedProfile).toBe(false);
  });
});

describe("AppDatabase: indexes used by the planned queries", () => {
  it("orders the history of a callsign with [callsign+datetimeOn]", async () => {
    const { container, db } = createTestDatabase();
    const profile = expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    for (const datetimeOn of [
      "2026-10-24T12:00:00Z",
      "2025-01-01T00:00:00Z",
      "2026-10-24T09:30:00Z",
    ]) {
      expectOk(
        await container.repositories.qsoLogs.create(
          qsoDraft(profile.id, { datetimeOn }),
        ),
      );
    }
    expectOk(
      await container.repositories.qsoLogs.create(
        qsoDraft(profile.id, { callsign: "IK0AAA" }),
      ),
    );

    const history = await db.qso_logs
      .where("[callsign+datetimeOn]")
      .between(["I2XYZ", Dexie.minKey], ["I2XYZ", Dexie.maxKey])
      .toArray();
    expect(history.map((qso) => qso.datetimeOn)).toEqual([
      "2025-01-01T00:00:00Z",
      "2026-10-24T09:30:00Z",
      "2026-10-24T12:00:00Z",
    ]);
    expect(
      await db.qso_logs.where("[band+mode]").equals(["20m", "FT8"]).count(),
    ).toBe(4);
  });

  it("finds the default profile through the 0|1 isDefault index", async () => {
    const { container, db } = createTestDatabase();
    const first = expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft({ name: "Portatile" }),
      ),
    );
    const defaults = await db.station_profiles
      .where("isDefault")
      .equals(1)
      .toArray();
    expect(defaults.map((profile) => profile.id)).toEqual([first.id]);
  });

  it("keeps optional indexed fields sparse (absent values are not indexed)", async () => {
    const { container, db } = createTestDatabase();
    const profile = expectOk(
      await container.repositories.stationProfiles.create(
        stationProfileDraft(),
      ),
    );
    const importJobId = crypto.randomUUID();
    expectOk(
      await container.repositories.qsoLogs.create(
        qsoDraft(profile.id, { origin: "adif-import", importJobId }),
      ),
    );
    expectOk(await container.repositories.qsoLogs.create(qsoDraft(profile.id)));
    expect(await db.qso_logs.orderBy("importJobId").count()).toBe(1);
    expect(await db.qso_logs.count()).toBe(2);
  });

  it("queries receptions by category and start time", async () => {
    const { container, db } = createTestDatabase();
    const { reception } = await seedOwners(container);
    const found = await db.swl_receptions
      .where("[category+datetimeStart]")
      .between(
        ["broadcast", "2026-10-24T00:00:00Z"],
        ["broadcast", "2026-10-25T00:00:00Z"],
      )
      .primaryKeys();
    expect(found).toEqual([reception.id]);
  });
});

describe("AppDatabase: storage errors", () => {
  it("reports an IndexedDB that cannot be opened as unavailable", async () => {
    const failing = {
      open() {
        throw new DOMException("blocked by the browser", "InvalidStateError");
      },
      deleteDatabase() {
        throw new DOMException("blocked by the browser", "InvalidStateError");
      },
      cmp: () => 0,
      databases: async () => [],
    } as unknown as IDBFactory;
    const db = new AppDatabase({ indexedDB: failing, IDBKeyRange });
    expect(expectErr(await db.connect())).toMatchObject({
      code: "persistence.unavailable",
      reason: "open-failed",
    });
  });

  it("refuses a stored schema newer than the app (downgrade)", async () => {
    // Dexie warns that it adds the v1 tables missing from the newer schema.
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const test = createTestDatabase();
    const newer = new Dexie(test.name, {
      indexedDB: test.indexedDB,
      IDBKeyRange,
    });
    newer.version(1).stores({ settings: "key" });
    newer.version(2).stores({ settings: "key" });
    await newer.open();
    newer.close();

    expect(expectErr(await test.container.connect())).toMatchObject({
      code: "persistence.unavailable",
      reason: "newer-version",
    });
    expect(
      expectErr(await test.container.repositories.stationProfiles.list()),
    ).toMatchObject({ code: "persistence.unavailable" });
  });
});

describe("AppDatabase: lifecycle events (Q-M2-03)", () => {
  it("closes and notifies when another tab opens a newer schema", async () => {
    const test = createTestDatabase();
    expectOk(await test.container.connect());
    const events: string[] = [];
    test.container.databaseLifecycle.subscribe((event) =>
      events.push(event.type),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    test.db.close();

    const newer = new Dexie(test.name, databaseOptions(test));
    newer.version(1).stores({ settings: "key" });
    newer.version(2).stores({ settings: "key, updatedAt" });
    await newer.open();

    expect(events).toEqual(["version-change"]);
    expect(
      expectErr(await test.container.repositories.stationProfiles.list()),
    ).toMatchObject({ code: "persistence.unavailable", reason: "closed" });
    newer.close();
  });

  it("notifies when its upgrade is blocked by an old connection", async () => {
    const test = createTestDatabase();
    test.db.close();
    // A connection at an older version that ignores versionchange.
    const old = await request(test.indexedDB.open(test.name, 1));
    const events: string[] = [];
    test.container.databaseLifecycle.subscribe((event) =>
      events.push(event.type),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const connecting = test.container.connect();
    await vi.waitFor(() => expect(events).toEqual(["blocked"]));
    old.close();
    expectOk(await connecting);
  });

  it("stops notifying an unsubscribed listener", async () => {
    const test = createTestDatabase();
    expectOk(await test.container.connect());
    const listener = vi.fn();
    const unsubscribe = test.container.databaseLifecycle.subscribe(listener);
    unsubscribe();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    test.db.close();
    const newer = new Dexie(test.name, databaseOptions(test));
    newer.version(2).stores({ settings: "key" });
    await newer.open();
    expect(listener).not.toHaveBeenCalled();
    newer.close();
  });
});
