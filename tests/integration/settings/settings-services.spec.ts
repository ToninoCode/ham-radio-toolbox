// @vitest-environment node
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createContainer } from "@/app/container";
import {
  APP_PREFERENCES,
  DASHBOARD_PREFERENCES,
  createPreferencesService,
  createStationProfileService,
  createStorageService,
} from "@/modules/settings-backup";
import {
  silentDataChangeNotifier,
  type DataChange,
  type DataChangeNotifier,
  type DatabaseLifecycleEvent,
} from "@/shared/application";
import { fakeStorageInfo } from "../../support/app-services";
import { createTestDatabase, FakeClock } from "../../support/database";
import {
  expectErr,
  expectOk,
  qsoDraft,
  stationProfileDraft,
} from "../../support/records";

/*
 * BL-M2-09: use cases of Settings on fake-indexeddb (profiles, preferences,
 * storage status) and the behaviour of a tab whose connection is closed by
 * an upgrade from another tab.
 */

function recordingNotifier(): DataChangeNotifier & { changes: DataChange[] } {
  const changes: DataChange[] = [];
  return {
    changes,
    publish: (change) => changes.push(change),
    subscribe: () => () => undefined,
  };
}

describe("station profiles", () => {
  it("a new database without profiles is valid", async () => {
    const test = createTestDatabase();
    expectOk(await test.container.connect());
    expect(
      expectOk(await test.container.services.stationProfiles.list()),
    ).toEqual([]);
    expect(
      expectOk(await test.container.repositories.stationProfiles.getDefault()),
    ).toBeUndefined();
    // Preferences and backup work without profiles too.
    expectOk(await test.container.services.preferences.load());
    const backup = await test.container.loadBackupService();
    expectOk(await backup.createBackup({ includeAttachments: false }));
  });

  it("the first profile becomes the default; the default can change", async () => {
    const test = createTestDatabase();
    const notifier = recordingNotifier();
    const service = createStationProfileService({
      profiles: test.container.repositories.stationProfiles,
      notifier,
    });
    const first = expectOk(
      await service.create(stationProfileDraft({ name: "Casa" })),
    );
    expect(first.isDefault).toBe(1);
    const second = expectOk(
      await service.create(
        stationProfileDraft({ name: "SWL", kind: "swl", callsign: undefined }),
      ),
    );
    expect(second.isDefault).toBe(0);
    expectOk(await service.setDefault(second.id));
    const defaults = expectOk(await service.list()).filter(
      (p) => p.isDefault === 1,
    );
    expect(defaults.map((p) => p.name)).toEqual(["SWL"]);
    expect(notifier.changes).toEqual([
      { scope: "station-profiles" },
      { scope: "station-profiles" },
      { scope: "station-profiles" },
    ]);
  });

  it("validation errors carry domain codes and nothing is written", async () => {
    const test = createTestDatabase();
    const service = test.container.services.stationProfiles;
    const error = expectErr(
      await service.create({ name: " ", kind: "ham", locator: "ZZ99" }),
    );
    expect(error).toMatchObject({ code: "persistence.invalid-input" });
    const codes =
      error.code === "persistence.invalid-input"
        ? error.issues.map((issue) => `${issue.path}:${issue.code}`)
        : [];
    expect(codes).toEqual(
      expect.arrayContaining([
        "name:text.empty",
        "locator:locator.invalid-format",
      ]),
    );
    expect(codes.some((code) => code.includes("invalid_format"))).toBe(false);
    // Rules between fields come once the fields are valid (DATABASE.md DB-11).
    expect(
      expectErr(await service.create({ name: "Casa", kind: "ham" })),
    ).toMatchObject({
      issues: [{ path: "callsign", code: "station-profile.callsign-required" }],
    });
    expect(expectOk(await service.list())).toEqual([]);
  });

  it("deletion respects references and the last profile; the default moves", async () => {
    const test = createTestDatabase();
    const service = test.container.services.stationProfiles;
    const home = expectOk(
      await service.create(stationProfileDraft({ name: "Casa" })),
    );
    expect(expectErr(await service.remove(home.id))).toMatchObject({
      code: "persistence.conflict",
      rule: "station-profile.last",
    });
    const portable = expectOk(
      await service.create(stationProfileDraft({ name: "Portatile" })),
    );
    expectOk(
      await test.container.repositories.qsoLogs.create(qsoDraft(portable.id)),
    );
    expect(expectErr(await service.remove(portable.id))).toMatchObject({
      code: "persistence.conflict",
      rule: "station-profile.referenced",
    });
    expectOk(await service.remove(home.id));
    const [left] = expectOk(await service.list());
    expect(left).toMatchObject({ id: portable.id, isDefault: 1 });
  });

  it("an edit can clear optional fields", async () => {
    const test = createTestDatabase();
    const service = test.container.services.stationProfiles;
    const profile = expectOk(
      await service.create(stationProfileDraft({ qth: "Torino" })),
    );
    const edited = expectOk(
      await service.update(profile.id, { qth: undefined }),
    );
    expect(edited.qth).toBeUndefined();
    expect("qth" in edited).toBe(false);
  });
});

describe("preferences", () => {
  it("start from the defaults and persist theme and favourites", async () => {
    const test = createTestDatabase();
    const notifier = recordingNotifier();
    const service = createPreferencesService({
      settings: test.container.repositories.settings,
      notifier,
    });
    expect(expectOk(await service.load())).toEqual({
      preferences: { theme: "system", favorites: [] },
      invalid: [],
    });
    expectOk(await service.saveTheme("dark"));
    expectOk(await service.saveFavorites(["propagation", "ham-logbook"]));
    expect(expectOk(await service.load()).preferences).toEqual({
      theme: "dark",
      favorites: ["propagation", "ham-logbook"],
    });
    // Stored under the documented keys (DATABASE.md `settings`).
    expect(await test.db.settings.get("app")).toMatchObject({
      value: { theme: "dark" },
    });
    expect(await test.db.settings.get("dashboard")).toMatchObject({
      value: { favorites: ["propagation", "ham-logbook"] },
    });
    expect(notifier.changes).toHaveLength(2);
  });

  it("refuse invalid values with domain codes", async () => {
    const test = createTestDatabase();
    const { preferences } = test.container.services;
    const repeated = expectErr(await preferences.saveFavorites(["a", "a"]));
    expect(repeated).toMatchObject({
      code: "persistence.invalid-input",
      issues: [{ path: "favorites.1", code: "dashboard.favorite-repeated" }],
    });
    const badKey = expectErr(await preferences.saveFavorites(["Not A Key"]));
    expect(badKey).toMatchObject({
      issues: [{ path: "favorites.0", code: "catalog-key.invalid" }],
    });
    expect(await test.db.settings.count()).toBe(0);
  });

  it("an unreadable stored value falls back to the default and is reported", async () => {
    const test = createTestDatabase();
    await test.db.settings.put({
      key: APP_PREFERENCES.key,
      value: { theme: "neon", font: "big" },
      updatedAt: "2026-10-24T09:00:00Z" as never,
    });
    expectOk(
      await test.container.repositories.settings.write(DASHBOARD_PREFERENCES, {
        favorites: ["rf-calculators"],
      }),
    );
    expect(expectOk(await test.container.services.preferences.load())).toEqual({
      preferences: { theme: "system", favorites: ["rf-calculators"] },
      invalid: ["app"],
    });
  });

  it("a storage failure is returned, never hidden", async () => {
    const test = createTestDatabase();
    expectOk(await test.container.connect());
    test.container.dispose();
    const closed = createPreferencesService({
      settings: test.container.repositories.settings,
      notifier: silentDataChangeNotifier,
    });
    expect(expectErr(await closed.load())).toMatchObject({
      code: "persistence.unavailable",
      reason: "closed",
    });
  });
});

describe("storage status", () => {
  it("reports database, estimate with the 80 % warning and persistence", async () => {
    const test = createTestDatabase();
    const storage = fakeStorageInfo({
      estimate: { usageBytes: 850, quotaBytes: 1000 },
      persisted: false,
      grant: false,
    });
    const service = createStorageService({
      storage,
      database: test.container.database,
    });
    const status = await service.status();
    expect(status.database.ok).toBe(true);
    expect(status.usage).toMatchObject({ usageRatio: 0.85, nearQuota: true });
    expect(status.persistence).toBe("best-effort");
    expect(await service.requestPersistence()).toBe("denied");
  });

  it("reads the persistence state without ever asking for it", async () => {
    const test = createTestDatabase();
    const storage = fakeStorageInfo({ persisted: false, grant: true });
    const service = createStorageService({
      storage,
      database: test.container.database,
    });
    expect(await service.persistenceState()).toBe("best-effort");
    await service.status();
    expect(storage.requests).toBe(0);
    // Only the explicit request calls persist().
    expect(await service.requestPersistence()).toBe("granted");
    expect(storage.requests).toBe(1);
    expect(await service.persistenceState()).toBe("persisted");
    const none = createStorageService({
      storage: fakeStorageInfo(),
      database: test.container.database,
    });
    expect(await none.persistenceState()).toBe("unsupported");
    expect(await none.requestPersistence()).toBe("unsupported");
    expect((await none.status()).usage).toBeUndefined();
  });

  it("reports an unavailable database (storage blocked)", async () => {
    const container = createContainer({
      database: {
        name: "blocked",
        indexedDB: {
          open: () => {
            throw new DOMException("blocked", "SecurityError");
          },
        } as unknown as IDBFactory,
        IDBKeyRange,
      },
      dataChanges: silentDataChangeNotifier,
      storageInfo: fakeStorageInfo(),
    });
    const status = await container.services.storage.status();
    expect(status.database.ok).toBe(false);
    expect(container.services.storage).toBeDefined();
    const prefs = await container.services.preferences.load();
    expect(prefs.ok).toBe(false);
  });
});

describe("an upgrade from another tab (versionchange)", () => {
  function open(indexedDB: IDBFactory, name: string) {
    return createContainer({
      database: { name, indexedDB, IDBKeyRange },
      clock: new FakeClock(),
      dataChanges: silentDataChangeNotifier,
      storageInfo: fakeStorageInfo(),
    });
  }

  /** Another tab opening a newer schema (IndexedDB version 20 = Dexie v2). */
  function upgradeElsewhere(
    indexedDB: IDBFactory,
    name: string,
  ): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 20);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function countIn(db: IDBDatabase, store: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  it("keeps committed data, notifies, and refuses later writes", async () => {
    const indexedDB = new IDBFactory();
    const name = `hrt-vc-${crypto.randomUUID()}`;
    const tab = open(indexedDB, name);
    const events: DatabaseLifecycleEvent[] = [];
    tab.databaseLifecycle.subscribe((event) => events.push(event));
    expectOk(await tab.services.stationProfiles.create(stationProfileDraft()));

    const other = await upgradeElsewhere(indexedDB, name);
    expect(events).toEqual([{ type: "version-change" }]);
    expect(await countIn(other, "station_profiles")).toBe(1);

    expect(
      expectErr(
        await tab.services.stationProfiles.create(
          stationProfileDraft({ name: "Dopo" }),
        ),
      ),
    ).toMatchObject({ code: "persistence.unavailable", reason: "closed" });
    expect(
      expectErr(await tab.services.preferences.saveTheme("dark")),
    ).toMatchObject({
      code: "persistence.unavailable",
    });
    expect(await countIn(other, "station_profiles")).toBe(1);
    other.close();
  });

  it("a write racing the upgrade is either committed or reported, never lost silently", async () => {
    const indexedDB = new IDBFactory();
    const name = `hrt-vc-${crypto.randomUUID()}`;
    const tab = open(indexedDB, name);
    expectOk(await tab.connect());
    const racing = tab.services.stationProfiles.create(stationProfileDraft());
    const other = await upgradeElsewhere(indexedDB, name);
    const result = await racing;
    const stored = await countIn(other, "station_profiles");
    if (result.ok) {
      expect(stored).toBe(1);
    } else {
      expect(result.error).toMatchObject({ code: "persistence.unavailable" });
      expect(stored).toBe(0);
    }
    other.close();
  });
});
