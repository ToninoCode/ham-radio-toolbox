// @vitest-environment node
import { IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppBackupService } from "@/app/backup-wiring";
import { AppDatabase, DexieUnitOfWork } from "@/infrastructure/db";
import { DexieImportJobRepository } from "@/infrastructure/db/repositories";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import type { BackupService, RestoreAnalysis } from "@/modules/settings-backup";
import { DexieBackupGateway } from "@/infrastructure/db/dexie-backup-gateway";
import {
  createBackupService,
  type BackupLimits,
} from "@/modules/settings-backup/application/backup-service";
import { jsonBackupCodec } from "@/modules/settings-backup/infrastructure/json-backup-codec";
import { TABLE_NAMES, type RestoreMode } from "@/shared/application";
import {
  parseBackup,
  snapshotTables,
  syntheticTables,
  uuidFor,
  writeBackupFile,
} from "../../support/backup";
import {
  createTestDatabase,
  databaseOptions,
  type TestDatabase,
} from "../../support/database";
import {
  attachmentInput,
  expectErr,
  expectOk,
  qslDraft,
  seedOwners,
} from "../../support/records";

/*
 * BL-M2-08: backup and restore on fake-indexeddb with the real gateway,
 * codec and unit of work (DATABASE.md § 9, ADR-0015).
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Backup service on the test database. The gateway, the unit of work and
 * the job repository must share one AppDatabase instance, so that the
 * restore's writes join the unit's transaction.
 */
function serviceFor(
  test: TestDatabase,
  limits?: Partial<BackupLimits>,
): BackupService {
  const database = new AppDatabase(databaseOptions(test));
  const deps = { clock: test.clock, ids: cryptoIdGenerator };
  return createAppBackupService({
    database,
    unitOfWork: new DexieUnitOfWork(database),
    importJobs: new DexieImportJobRepository(database, deps),
    clock: test.clock,
    ids: cryptoIdGenerator,
    contentHasher: webCryptoContentHasher,
    appVersion: "0.2.0-test",
    ...(limits ? { limits } : {}),
  });
}

/** Every table of schema v1 with related records, through the repositories. */
async function seedAll(test: TestDatabase) {
  const { repositories } = test.container;
  const { profile, qso, reception } = await seedOwners(test.container);
  const qsl = expectOk(
    await repositories.qslRecords.create(qslDraft("qso", qso.id)),
  );
  for (const [ownerType, ownerId, text] of [
    ["qso", qso.id, "audio del QSO"],
    ["swl_reception", reception.id, "registrazione"],
    ["qsl", qsl.id, "scansione QSL"],
  ] as const) {
    const sha256 = await webCryptoContentHasher.sha256(new Blob([text]));
    expectOk(
      await repositories.attachments.create(
        attachmentInput(ownerType, ownerId, text, sha256),
      ),
    );
  }
  expectOk(
    await repositories.dataSources.save({
      key: "eibi",
      accessMode: "manual-import",
      datasetVersion: "A26",
    }),
  );
  expectOk(
    await repositories.importJobs.create({
      kind: "adif",
      status: "cancelled",
      startedAt: "2026-10-24T09:00:00Z",
      finishedAt: "2026-10-24T09:00:05Z",
      counts: {
        total: 1,
        valid: 1,
        invalid: 0,
        duplicates: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
      },
      errors: [],
    }),
  );
  await test.db.settings.put({
    key: "app",
    value: { theme: "dark" },
    updatedAt: "2026-10-24T09:00:00Z" as never,
  });
  return { profile, qso, reception, qsl };
}

async function restore(
  service: BackupService,
  file: Blob,
  mode: RestoreMode = "replace",
  name = "backup.json",
) {
  const analysis = expectOk(
    await service.analyzeBackup({ name, content: file }),
  );
  const preview = expectOk(await service.previewRestore(analysis, mode));
  return { analysis, preview, outcome: await service.commitRestore(preview) };
}

/** Tables without the job written by a restore. */
async function dataOf(test: TestDatabase) {
  const snapshot = await snapshotTables(test.db);
  return {
    ...snapshot,
    import_jobs: snapshot.import_jobs.filter(
      (job) => (job as { kind: string }).kind !== "backup",
    ),
  };
}

describe("backup", () => {
  it("exports every table with manifest, counts and checksums", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const backup = expectOk(
      await serviceFor(test).createBackup({ includeAttachments: true }),
    );

    expect(backup.fileName).toMatch(/^hrt-backup-\d{8}-\d{4}Z\.json$/);
    expect(backup.sizeBytes).toBe(backup.blob.size);
    expect(backup.manifest).toMatchObject({
      format: "ham-radio-toolbox-backup",
      backupFormatVersion: 1,
      schemaVersion: 1,
      appVersion: "0.2.0-test",
      includesAttachments: true,
      counts: {
        station_profiles: 1,
        qso_logs: 1,
        swl_receptions: 1,
        reception_details: 1,
        qsl_records: 1,
        attachments: 3,
        settings: 1,
        data_sources: 1,
        import_jobs: 1,
      },
    });
    const file = await parseBackup(backup.blob);
    expect(file["backupId"]).toBe(backup.manifest.backupId);
    const attachments = (
      file["tables"] as Record<string, Record<string, unknown>[]>
    )["attachments"]!;
    expect(
      attachments.map((a) => atob(String(a["dataBase64"]))).sort(),
    ).toEqual(["audio del QSO", "registrazione", "scansione QSL"]);
    expect(attachments[0]).not.toHaveProperty("blob");
  });

  it("orders records by key: two exports of the same data have the same tables", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const one = await parseBackup(
      expectOk(await service.createBackup({ includeAttachments: true })).blob,
    );
    const two = await parseBackup(
      expectOk(await service.createBackup({ includeAttachments: true })).blob,
    );
    expect(two["tables"]).toEqual(one["tables"]);
    expect(two["integrity"]).toEqual(one["integrity"]);
    expect(two["backupId"]).not.toBe(one["backupId"]);
  });

  it("leaves attachments out unless asked", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const backup = expectOk(
      await serviceFor(test).createBackup({ includeAttachments: false }),
    );
    const file = await parseBackup(backup.blob);
    expect(file["includesAttachments"]).toBe(false);
    expect(Object.keys(file["tables"] as object)).not.toContain("attachments");
    expect(backup.manifest.counts).not.toHaveProperty("attachments");
  });

  it("refuses to export a stored record that fails its schema", async () => {
    const test = createTestDatabase();
    const { qso } = await seedAll(test);
    // Corruption outside the repositories (e.g. a bug of an older version).
    await test.db.qso_logs.update(qso.id, { frequencyHz: -5 as never });
    const error = expectErr(
      await serviceFor(test).createBackup({ includeAttachments: false }),
    );
    expect(error).toEqual({
      code: "backup.source-invalid",
      invalidCount: 1,
      records: [
        {
          table: "qso_logs",
          key: qso.id,
          issues: [{ path: "frequencyHz", code: "frequency.negative" }],
        },
      ],
    });
  });

  it("refuses a backup over the size limit, before or while writing it", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    expect(
      expectErr(
        await serviceFor(test, { maxBackupBytes: 10 }).createBackup({
          includeAttachments: true,
        }),
      ),
    ).toMatchObject({ code: "backup.export-too-large", limitBytes: 10 });
    expect(
      expectErr(
        await serviceFor(test, { maxBackupBytes: 300 }).createBackup({
          includeAttachments: false,
        }),
      ),
    ).toMatchObject({ code: "backup.export-too-large", limitBytes: 300 });
  });

  it("stops when aborted", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const controller = new AbortController();
    controller.abort();
    expect(
      expectErr(
        await serviceFor(test).createBackup({
          includeAttachments: true,
          signal: controller.signal,
        }),
      ),
    ).toEqual({ code: "operation.aborted" });
  });

  it("is loaded lazily by the container, once", async () => {
    const test = createTestDatabase();
    const first = await test.container.loadBackupService();
    expect(await test.container.loadBackupService()).toBe(first);
    await seedAll(test);
    const backup = expectOk(
      await first.createBackup({ includeAttachments: false }),
    );
    expect(backup.manifest.appVersion).toBe(__APP_VERSION__);
  });
});

describe("restore round-trip", () => {
  it.each([true, false])(
    "restores identical data into an empty database (attachments: %s)",
    async (includeAttachments) => {
      const source = createTestDatabase();
      await seedAll(source);
      const backup = expectOk(
        await serviceFor(source).createBackup({ includeAttachments }),
      );

      const target = createTestDatabase();
      const { outcome, analysis } = await restore(
        serviceFor(target),
        backup.blob,
      );
      const { job, counts } = expectOk(outcome);

      const expected = await dataOf(source);
      if (!includeAttachments) expected.attachments = [];
      expect(await dataOf(target)).toEqual(expected);
      expect(job).toMatchObject({
        kind: "backup",
        status: "committed",
        fileName: "backup.json",
        options: {
          mode: "replace",
          backupId: backup.manifest.backupId,
          includesAttachments: includeAttachments,
        },
      });
      expect(job.counts.inserted).toBe(analysis.recordCount);
      expect(counts.import_jobs).toBe(2);

      // Exporting the restored data gives the same tables, byte for byte.
      const again = await parseBackup(
        expectOk(await serviceFor(target).createBackup({ includeAttachments }))
          .blob,
      );
      const original = await parseBackup(backup.blob);
      const digests = (file: Record<string, unknown>) =>
        (file["integrity"] as { tables: Record<string, string> }).tables;
      for (const table of TABLE_NAMES) {
        if (
          table === "import_jobs" ||
          (!includeAttachments && table === "attachments")
        )
          continue;
        expect(digests(again)[table], table).toBe(digests(original)[table]);
      }
    },
  );

  it("replaces the local data atomically and keeps related records consistent", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: true }),
    );
    const before = await dataOf(test);
    // Local changes after the backup are replaced.
    const { qso } = await seedOwners(test.container);
    expect(await test.db.qso_logs.count()).toBe(2);

    const { preview, outcome } = await restore(service, backup.blob, "replace");
    expect(preview.effects.qso_logs).toMatchObject({ inserted: 1, deleted: 2 });
    expectOk(outcome);
    expect(await dataOf(test)).toEqual(before);
    expect(await test.db.qso_logs.get(qso.id)).toBeUndefined();
  });

  it("restoring the same backup twice gives the same data; merge then changes nothing", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: true }),
    );
    expectOk((await restore(service, backup.blob)).outcome);
    const once = await dataOf(test);
    expectOk((await restore(service, backup.blob)).outcome);
    expect(await dataOf(test)).toEqual(once);

    const { preview, outcome } = await restore(service, backup.blob, "merge");
    expect(preview.writes.puts).toEqual({});
    expect(expectOk(outcome).job.counts).toMatchObject({
      inserted: 0,
      updated: 0,
    });
    expect(await dataOf(test)).toEqual(once);
  });

  it("merges into local data: newer records win, nothing local is lost", async () => {
    const source = createTestDatabase();
    await seedAll(source);
    const backup = expectOk(
      await serviceFor(source).createBackup({ includeAttachments: true }),
    );

    const target = createTestDatabase();
    const local = await seedOwners(target.container);
    const { preview, outcome } = await restore(
      serviceFor(target),
      backup.blob,
      "merge",
    );
    expect(preview.effects.station_profiles.inserted).toBe(1);
    expectOk(outcome);
    expect(await target.db.qso_logs.count()).toBe(2);
    expect(await target.db.qso_logs.get(local.qso.id)).toBeDefined();
    // One default profile: the local one.
    const defaults = (await target.db.station_profiles.toArray()).filter(
      (p) => p.isDefault === 1,
    );
    expect(defaults.map((p) => p.id)).toEqual([local.profile.id]);
  });
});

describe("restore: the local data is preserved on failure", () => {
  it("when the storage fails in the middle of the commit", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: true }),
    );
    await seedOwners(test.container);
    const before = await snapshotTables(test.db);

    const analysis = expectOk(
      await service.analyzeBackup({ name: "b.json", content: backup.blob }),
    );
    const preview = expectOk(await service.previewRestore(analysis, "replace"));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "qsl_records")
        throw new DOMException("quota", "QuotaExceededError");
      return put.apply(this, args);
    });
    expect(expectErr(await service.commitRestore(preview))).toEqual({
      code: "persistence.quota-exceeded",
    });
    vi.restoreAllMocks();

    const after = await snapshotTables(test.db);
    const failedJobs = after.import_jobs.filter(
      (job) => (job as { status: string }).status === "failed",
    );
    expect({
      ...after,
      import_jobs: after.import_jobs.filter((job) => !failedJobs.includes(job)),
    }).toEqual(before);
    expect(failedJobs).toHaveLength(1);
    expect(failedJobs[0]).toMatchObject({
      kind: "backup",
      errors: [{ location: "commit", code: "persistence.quota-exceeded" }],
    });
  });

  it("when an unexpected exception is thrown inside the transaction", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const before = await snapshotTables(test.db);
    const analysis = expectOk(
      await service.analyzeBackup({ name: "b.json", content: backup.blob }),
    );
    const preview = expectOk(await service.previewRestore(analysis, "replace"));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "settings") throw new TypeError("bug");
      return put.apply(this, args);
    });
    await expect(service.commitRestore(preview)).rejects.toThrow("bug");
    vi.restoreAllMocks();
    const after = await snapshotTables(test.db);
    expect(after.import_jobs).toHaveLength(before.import_jobs.length + 1);
    expect({ ...after, import_jobs: before.import_jobs }).toEqual(before);
  });

  it("when the local data changed after the preview", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const analysis = expectOk(
      await service.analyzeBackup({ name: "b.json", content: backup.blob }),
    );
    const preview = expectOk(await service.previewRestore(analysis, "merge"));
    await seedOwners(test.container);
    const before = await dataOf(test);
    expect(expectErr(await service.commitRestore(preview))).toEqual({
      code: "backup.preview-stale",
    });
    expect(await dataOf(test)).toEqual(before);
  });

  it("when the backup has errors: no preview, no commit", async () => {
    const test = createTestDatabase();
    const tables = syntheticTables({ qsos: 2 });
    tables.qso_logs[0] = { ...tables.qso_logs[0]!, frequencyHz: -1 };
    const analysis = expectOk(
      await serviceFor(test).analyzeBackup({
        name: "b.json",
        content: await writeBackupFile(tables),
      }),
    );
    expect(analysis.content).toBeUndefined();
    expect(
      expectErr(await serviceFor(test).previewRestore(analysis, "replace")),
    ).toEqual({
      code: "backup.has-errors",
    });
    const job = expectOk(await serviceFor(test).cancelRestore(analysis));
    expect(job).toMatchObject({
      kind: "backup",
      status: "cancelled",
      counts: { invalid: 1 },
    });
  });
});

describe("restore: untrusted files", () => {
  async function analyze(
    blob: Blob,
    test = createTestDatabase(),
    limits?: Partial<BackupLimits>,
  ) {
    return serviceFor(test, limits).analyzeBackup({
      name: "b.json",
      content: blob,
    });
  }

  async function edit(
    tables = syntheticTables({ qsos: 3 }),
    change: (text: string) => string,
  ) {
    return new Blob([change(await (await writeBackupFile(tables)).text())]);
  }

  function errorsOf(analysis: RestoreAnalysis) {
    return analysis.errors.map(
      (e) => `${e.location} ${e.field ?? ""} ${e.code}`,
    );
  }

  it("rejects a wrong checksum and leaves the database untouched", async () => {
    const test = createTestDatabase();
    await seedAll(test);
    const before = await snapshotTables(test.db);
    const altered = await edit(undefined, (text) =>
      text.replace('"callsign":"I0XYZ"', '"callsign":"I0XYW"'),
    );
    expect(expectErr(await analyze(altered, test))).toEqual({
      code: "backup.checksum-mismatch",
      tables: ["qso_logs"],
    });
    expect(await snapshotTables(test.db)).toEqual(before);
  });

  it("rejects an incomplete backup", async () => {
    const text = await (
      await writeBackupFile(syntheticTables({ qsos: 3 }))
    ).text();
    expect(
      expectErr(await analyze(new Blob([text.slice(0, text.length / 2)]))),
    ).toEqual({
      code: "backup.truncated",
    });
    // A table removed together with its count and checksum.
    const file = await parseBackup(new Blob([text]));
    delete (file["tables"] as Record<string, unknown>)["qsl_records"];
    delete (file["counts"] as Record<string, unknown>)["qsl_records"];
    delete (file["integrity"] as { tables: Record<string, unknown> }).tables[
      "qsl_records"
    ];
    expect(expectErr(await analyze(new Blob([JSON.stringify(file)])))).toEqual({
      code: "backup.table-missing",
      table: "qsl_records",
    });
  });

  it("rejects a count that does not match the records", async () => {
    const blob = await edit(undefined, (text) =>
      text.replace('"qso_logs":3', '"qso_logs":4'),
    );
    expect(expectErr(await analyze(blob))).toEqual({
      code: "backup.count-mismatch",
      table: "qso_logs",
      declared: 4,
      found: 3,
    });
  });

  it("rejects a backup of a newer schema", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 1 }), {
      schemaVersion: 2,
    });
    expect(expectErr(await analyze(blob))).toEqual({
      code: "backup.schema-newer",
      found: 2,
      current: 1,
    });
  });

  it("rejects attachments that disagree with includesAttachments", async () => {
    const blob = await edit(
      syntheticTables({ qsos: 1, attachments: 1 }),
      (text) =>
        text.replace(
          '"includesAttachments":true',
          '"includesAttachments":false',
        ),
    );
    expect(expectErr(await analyze(blob))).toEqual({
      code: "backup.attachments-mismatch",
    });
  });

  it("reports unknown fields, wrong types, timestamps, frequencies and duplicate ids", async () => {
    const tables = syntheticTables({ qsos: 4 });
    tables.qso_logs[0] = { ...tables.qso_logs[0]!, extra: "x" };
    tables.qso_logs[1] = { ...tables.qso_logs[1]!, frequencyHz: "14074000" };
    tables.qso_logs[2] = {
      ...tables.qso_logs[2]!,
      datetimeOn: "2026-10-24 10:00",
    };
    tables.qso_logs[3] = { ...tables.qso_logs[3]!, frequencyHz: 14_074_000.5 };
    tables.settings.push({ ...tables.settings[0]! });
    const analysis = expectOk(await analyze(await writeBackupFile(tables)));
    expect(analysis.invalidCount).toBe(4);
    expect(errorsOf(analysis)).toEqual([
      "qso_logs[0]  zod.unrecognized_keys",
      "qso_logs[1] frequencyHz zod.invalid_type",
      "qso_logs[2] datetimeOn time.missing-offset",
      "qso_logs[3] frequencyHz frequency.not-integer",
    ]);
    expect(analysis.content).toBeUndefined();

    // Duplicate keys are found once the records themselves are valid.
    const duplicated = syntheticTables({ qsos: 1 });
    duplicated.settings.push({ ...duplicated.settings[0]! });
    expect(
      errorsOf(expectOk(await analyze(await writeBackupFile(duplicated)))),
    ).toEqual(["settings[1] key backup.duplicate-id"]);
  });

  it("reports missing references", async () => {
    const tables = syntheticTables({ qsos: 1 });
    tables.qso_logs[0] = {
      ...tables.qso_logs[0]!,
      stationProfileId: uuidFor(0xdead),
    };
    expect(
      errorsOf(expectOk(await analyze(await writeBackupFile(tables)))),
    ).toEqual(["qso_logs[0] stationProfileId qso.station-profile-missing"]);
  });

  it("checks attachment contents against their checksum and size limit", async () => {
    const tables = syntheticTables({
      qsos: 1,
      attachments: 1,
      attachmentBytes: 2048,
    });
    tables.attachments[0] = {
      ...tables.attachments[0]!,
      sha256: "f".repeat(64),
    };
    expect(
      errorsOf(expectOk(await analyze(await writeBackupFile(tables)))),
    ).toEqual(["attachments[0] sha256 attachment.sha256-mismatch"]);
    const fine = syntheticTables({
      qsos: 1,
      attachments: 1,
      attachmentBytes: 2048,
    });
    expect(
      errorsOf(
        expectOk(
          await analyze(await writeBackupFile(fine), undefined, {
            maxAttachmentBytes: 1024,
          }),
        ),
      ),
    ).toEqual(["attachments[0] sizeBytes attachment.too-large"]);
  });

  it("rejects a file over the operational limit before reading it", async () => {
    const blob = await writeBackupFile(syntheticTables({ qsos: 3 }));
    expect(
      expectErr(await analyze(blob, undefined, { maxBackupBytes: 100 })),
    ).toEqual({
      code: "backup.too-large",
      sizeBytes: blob.size,
      limitBytes: 100,
    });
  });

  it("does not let a record set keys outside its schema (prototype included)", async () => {
    const tables = syntheticTables({ qsos: 1 });
    // An own `__proto__` key, as JSON.parse creates it from a file.
    tables.settings[0] = JSON.parse(
      `{"__proto__":{"polluted":true},${JSON.stringify(tables.settings[0]).slice(1)}`,
    ) as (typeof tables.settings)[number];
    const analysis = expectOk(await analyze(await writeBackupFile(tables)));
    expect(errorsOf(analysis)).toEqual(["settings[0]  zod.unrecognized_keys"]);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("stops when aborted during the analysis", async () => {
    const controller = new AbortController();
    controller.abort();
    const test = createTestDatabase();
    const result = await serviceFor(test).analyzeBackup(
      {
        name: "b.json",
        content: await writeBackupFile(syntheticTables({ qsos: 2 })),
      },
      { signal: controller.signal },
    );
    expect(expectErr(result)).toEqual({ code: "operation.aborted" });
    expect(await test.db.import_jobs.count()).toBe(0);
  });
});

describe("restore of older schema versions", () => {
  it("applies the pure migrations record by record before validating", async () => {
    // Synthetic "v1 → v2": the gateway pretends to be at v2 and renames a
    // field that did not exist in v1 files of this test.
    const test = createTestDatabase();
    const service = serviceFor(test);
    const tables = syntheticTables({ qsos: 2 });
    tables.qso_logs = tables.qso_logs.map(({ comment, ...qso }) => ({
      ...qso,
      remark: comment,
    }));
    tables.qso_logs.push({
      ...tables.qso_logs[0]!,
      id: uuidFor(0x5a),
      isSample: 1,
    });
    const blob = await writeBackupFile(tables);

    const database = new AppDatabase(databaseOptions(test));
    const real = new DexieBackupGateway(database);
    const gateway = Object.assign(Object.create(real) as typeof real, {
      schemaVersion: 2,
      tablesOf: (version: number) => (version <= 2 ? TABLE_NAMES : undefined),
      checkMigration: (from: number) =>
        from === 1
          ? { ok: true as const, value: undefined }
          : real.checkMigration(from),
      migrateRecord: (table: string, record: Record<string, unknown>) => {
        if (table !== "qso_logs") return record;
        if (record["isSample"] === 1) return null;
        const { remark, ...rest } = record;
        return { ...rest, comment: remark };
      },
    });
    const migrating = createBackupService({
      gateway,
      codec: jsonBackupCodec,
      unitOfWork: new DexieUnitOfWork(database),
      importJobs: new DexieImportJobRepository(database, {
        ids: cryptoIdGenerator,
      }),
      clock: test.clock,
      ids: cryptoIdGenerator,
      hasher: webCryptoContentHasher,
      appVersion: "test",
    });
    const analysis = expectOk(
      await migrating.analyzeBackup({ name: "old.json", content: blob }),
    );
    expect(analysis.errors).toEqual([]);
    expect(analysis.droppedByMigration).toBe(1);
    expect(
      analysis.content?.tables.qso_logs.map((qso) => qso["comment"]),
    ).toEqual(["QSO numero 0 – tnx 73 📻", "QSO numero 1 – tnx 73 📻"]);
    // Without the migration the same file is invalid for the current schema.
    expect(
      expectOk(await service.analyzeBackup({ name: "old.json", content: blob }))
        .invalidCount,
    ).toBe(3);
  });
});
