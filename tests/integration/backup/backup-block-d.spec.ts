// @vitest-environment node
import { IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppBackupService } from "@/app/backup-wiring";
import { AppDatabase, DexieUnitOfWork } from "@/infrastructure/db";
import { blobImportFileReader } from "@/infrastructure/files/blob-import-file-reader";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import { DexieImportJobRepository } from "@/infrastructure/db/repositories";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import type { BackupService } from "@/modules/settings-backup";
import {
  TABLE_NAMES,
  createImportPipeline,
  type DataChangeNotifier,
  type ImportJobRepository,
  type RestoreMode,
} from "@/shared/application";
import {
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
  sourcesFormat,
  sourcesTarget,
  textFile,
} from "../../support/import-formats";
import {
  attachmentInput,
  expectErr,
  expectOk,
  qsoDraft,
  seedOwners,
} from "../../support/records";

/*
 * Block D checks on the backup and restore of Block C (request § 9): job
 * recording failures, attachments without the backup, preview counts
 * against the real effects, tampered files, verification of the generated
 * file and notification of the other tabs.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

interface ServiceOptions {
  readonly importJobs?: (base: ImportJobRepository) => ImportJobRepository;
  readonly notifier?: DataChangeNotifier;
}

function serviceFor(
  test: TestDatabase,
  options: ServiceOptions = {},
): BackupService {
  const database = new AppDatabase(databaseOptions(test));
  const deps = { clock: test.clock, ids: cryptoIdGenerator };
  const base = new DexieImportJobRepository(database, deps);
  return createAppBackupService({
    database,
    unitOfWork: new DexieUnitOfWork(database),
    importJobs: options.importJobs ? options.importJobs(base) : base,
    clock: test.clock,
    ids: cryptoIdGenerator,
    contentHasher: webCryptoContentHasher,
    appVersion: "0.2.0-test",
    ...(options.notifier ? { notifier: options.notifier } : {}),
  });
}

async function attach(
  test: TestDatabase,
  ownerType: "qso" | "swl_reception",
  ownerId: string,
  text: string,
) {
  const sha256 = await webCryptoContentHasher.sha256(new Blob([text]));
  return expectOk(
    await test.container.repositories.attachments.create(
      attachmentInput(ownerType, ownerId, text, sha256),
    ),
  );
}

async function previewOf(
  service: BackupService,
  blob: Blob,
  mode: RestoreMode,
) {
  const analysis = expectOk(
    await service.analyzeBackup({ name: "b.json", content: blob }),
  );
  return expectOk(await service.previewRestore(analysis, mode));
}

/** Job repository that throws when asked to record a failed job. */
function failingFailedJobs(base: ImportJobRepository): ImportJobRepository {
  return {
    create: (draft) =>
      draft.status === "failed"
        ? Promise.reject(new Error("job store broken"))
        : base.create(draft),
    get: (id) => base.get(id),
    listRecent: (limit) => base.listRecent(limit),
    findCommittedByFileSha256: (sha) => base.findCommittedByFileSha256(sha),
  };
}

function quotaOn(predicate: (store: string) => boolean): void {
  const put = IDBObjectStore.prototype.put;
  const add = IDBObjectStore.prototype.add;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (predicate(this.name))
      throw new DOMException("quota", "QuotaExceededError");
    return put.apply(this, args);
  });
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (predicate(this.name))
      throw new DOMException("quota", "QuotaExceededError");
    return add.apply(this, args);
  });
}

describe("a failed job record never hides the original error", () => {
  it("restore: the storage also refuses the failed job", async () => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const preview = await previewOf(service, backup.blob, "replace");
    const before = await snapshotTables(test.db);

    quotaOn(() => true);
    expect(expectErr(await service.commitRestore(preview))).toEqual({
      code: "persistence.quota-exceeded",
    });
    vi.restoreAllMocks();
    // No data change and no job: the failed job could not be written either.
    expect(await snapshotTables(test.db)).toEqual(before);
  });

  it("restore: the job repository throws while recording the failure", async () => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const service = serviceFor(test, {
      importJobs: failingFailedJobs,
    });
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const preview = await previewOf(service, backup.blob, "replace");
    quotaOn((store) => store === "qso_logs");
    expect(expectErr(await service.commitRestore(preview))).toEqual({
      code: "persistence.quota-exceeded",
    });
  });

  it("import pipeline: the job repository throws while recording the failure", async () => {
    const test = createTestDatabase();
    const { container } = test;
    const base = container.repositories.importJobs;
    const pipeline = createImportPipeline({
      unitOfWork: container.unitOfWork,
      importJobs: failingFailedJobs(base),
      clock: container.clock,
      hasher: container.contentHasher,
      files: blobImportFileReader,
    });
    const target = sourcesTarget(container);
    const preview = expectOk(
      await pipeline.preview(
        textFile("s.txt", "#hrt-test-sources\neibi;manual-import;A26\n"),
        [sourcesFormat],
        target,
      ),
    );
    quotaOn((store) => store === "data_sources");
    expect(
      expectErr(await pipeline.commit(preview, target, { conflicts: "skip" })),
    ).toEqual({ code: "persistence.quota-exceeded" });
    vi.restoreAllMocks();
    expect(await test.db.data_sources.count()).toBe(0);
  });
});

describe("restore of a backup without attachments", () => {
  it("keeps only the local attachments whose owner is still referenced", async () => {
    const test = createTestDatabase();
    const { profile, qso, reception } = await seedOwners(test.container);
    const kept = await attach(test, "qso", qso.id, "audio del QSO");
    const keptToo = await attach(
      test,
      "swl_reception",
      reception.id,
      "registrazione",
    );
    const service = serviceFor(test);
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );

    // A QSO created after the backup, with its attachment: it disappears
    // with the replace restore, so its attachment would become an orphan.
    const later = expectOk(
      await test.container.repositories.qsoLogs.create(
        qsoDraft(profile.id, { callsign: "i3zzz" }),
      ),
    );
    const orphan = await attach(test, "qso", later.id, "audio successivo");

    const preview = await previewOf(service, backup.blob, "replace");
    expect(preview.effects.attachments).toMatchObject({
      unchanged: 2,
      deleted: 1,
      inserted: 0,
    });
    expectOk(await service.commitRestore(preview));

    const ids = (await test.db.attachments.toArray()).map((a) => a.id).sort();
    expect(ids).toEqual([kept.id, keptToo.id].sort());
    expect(await test.db.attachments.get(orphan.id)).toBeUndefined();
    // No orphan is left: every attachment's owner exists.
    for (const attachment of await test.db.attachments.toArray()) {
      const table =
        attachment.ownerType === "qso"
          ? test.db.qso_logs
          : test.db.swl_receptions;
      expect(await table.get(attachment.ownerId)).toBeDefined();
    }
  });
});

describe("the preview matches the effects of the commit", () => {
  it.each(["replace", "merge"] as const)("in %s mode", async (mode) => {
    const source = createTestDatabase();
    await writeAndRestoreInto(
      source,
      syntheticTables({ qsos: 20, attachments: 2, attachmentBytes: 64 }),
    );

    // Local data that differ from the backup: one profile and one QSO more,
    // one QSO of the backup edited later (newer updatedAt wins in merge).
    const target = createTestDatabase();
    const local = syntheticTables({ qsos: 12 });
    const editedId = String(local.qso_logs[0]!["id"]);
    await writeAndRestoreInto(target, local);
    await seedOwners(target.container);
    target.clock.set("2027-01-01T00:00:00Z");
    expectOk(
      await target.container.repositories.qsoLogs.update(editedId, {
        comment: "modificato in locale",
      }),
    );

    const backup = expectOk(
      await serviceFor(source).createBackup({ includeAttachments: true }),
    );
    const service = serviceFor(target);
    const before: Record<string, number> = {};
    for (const table of TABLE_NAMES)
      before[table] = await target.db.table(table).count();

    const preview = await previewOf(service, backup.blob, mode);
    const outcome = expectOk(await service.commitRestore(preview));

    for (const table of TABLE_NAMES) {
      const effects = preview.effects[table];
      const expected =
        before[table]! -
        effects.deleted +
        effects.inserted +
        (table === "import_jobs" ? 1 : 0);
      expect(await target.db.table(table).count(), table).toBe(expected);
      expect(outcome.counts[table], table).toBe(expected);
      expect(outcome.effects[table]).toEqual(effects);
    }
    const sum = (key: "inserted" | "updated") =>
      TABLE_NAMES.reduce(
        (total, table) => total + preview.effects[table][key],
        0,
      );
    expect(outcome.job.counts.inserted).toBe(sum("inserted"));
    expect(outcome.job.counts.updated).toBe(sum("updated"));
    if (mode === "merge") {
      // The local edit is newer than the backup record: kept.
      expect((await target.db.qso_logs.get(editedId))?.comment).toBe(
        "modificato in locale",
      );
    }
  });
});

async function writeAndRestoreInto(
  test: TestDatabase,
  tables: ReturnType<typeof syntheticTables>,
) {
  const service = serviceFor(test);
  const preview = await previewOf(
    service,
    await writeBackupFile(tables),
    "replace",
  );
  expectOk(await service.commitRestore(preview));
}

describe("a tampered backup with recomputed checksums", () => {
  it.each([
    [
      "an invalid value",
      (t: ReturnType<typeof syntheticTables>) => {
        t.qso_logs[0] = { ...t.qso_logs[0]!, frequencyHz: -7 };
      },
    ],
    [
      "a field outside the contract",
      (t: ReturnType<typeof syntheticTables>) => {
        t.station_profiles[0] = { ...t.station_profiles[0]!, password: "x" };
      },
    ],
    [
      "a reference to a missing profile",
      (t: ReturnType<typeof syntheticTables>) => {
        t.qso_logs[0] = {
          ...t.qso_logs[0]!,
          stationProfileId: uuidFor(0xdead),
        };
      },
    ],
    [
      "two default profiles",
      (t: ReturnType<typeof syntheticTables>) => {
        t.station_profiles = t.station_profiles.map((p) => ({
          ...p,
          isDefault: 1,
        }));
      },
    ],
  ])("with %s is refused and changes nothing", async (_label, tamper) => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const before = await snapshotTables(test.db);
    const tables = syntheticTables({ qsos: 4 });
    tamper(tables);
    const service = serviceFor(test);
    const analysis = expectOk(
      await service.analyzeBackup({
        name: "t.json",
        content: await writeBackupFile(tables),
      }),
    );
    expect(analysis.content).toBeUndefined();
    expect(analysis.errors.length).toBeGreaterThan(0);
    expect(
      expectErr(await service.previewRestore(analysis, "replace")),
    ).toEqual({
      code: "backup.has-errors",
    });
    expect(await snapshotTables(test.db)).toEqual(before);
  });
});

describe("export inventory and verification", () => {
  it("counts the records and the attachment bytes without reading contents", async () => {
    const test = createTestDatabase();
    const { qso } = await seedOwners(test.container);
    await attach(test, "qso", qso.id, "12345");
    const inventory = expectOk(await serviceFor(test).inspectBackup());
    expect(inventory).toMatchObject({
      recordCount: 4, // profile, QSO, reception, its details
      attachmentCount: 1,
      attachmentBytes: 5,
      attachmentBase64Bytes: 8,
      limitBytes: 100 * 1024 * 1024,
    });
    expect(inventory.counts.qso_logs).toBe(1);
  });

  it("verifies a generated file by reading it back", async () => {
    const test = createTestDatabase();
    const { qso } = await seedOwners(test.container);
    await attach(test, "qso", qso.id, "audio");
    const service = serviceFor(test);
    const file = expectOk(
      await service.createBackup({ includeAttachments: true }),
    );
    expect(expectOk(await service.verifyBackup(file))).toEqual({
      recordCount: 5,
      tableCount: TABLE_NAMES.length,
    });
  });

  it("refuses a file that does not read back as written", async () => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const service = serviceFor(test);
    const file = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );

    const truncated = {
      ...file,
      blob: file.blob.slice(0, file.blob.size - 20),
    };
    expect(expectErr(await service.verifyBackup(truncated))).toMatchObject({
      code: "backup.export-unverified",
    });
    const text = await file.blob.text();
    const altered = {
      ...file,
      blob: new Blob([text.replace('"IZ1ABC"', '"IZ1ABD"')]),
    };
    expect(text).toContain('"IZ1ABC"');
    const alteredError = expectErr(await service.verifyBackup(altered));
    expect(alteredError).toEqual({
      code: "backup.export-unverified",
      reason: "backup.checksum-mismatch",
    });
    const otherId = {
      ...file,
      manifest: { ...file.manifest, backupId: uuidFor(0x1234) },
    };
    expect(expectErr(await service.verifyBackup(otherId))).toEqual({
      code: "backup.export-unverified",
      reason: "backup-id",
    });
  });

  it("verification can be cancelled", async () => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const service = serviceFor(test);
    const file = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const controller = new AbortController();
    controller.abort();
    expect(
      expectErr(
        await service.verifyBackup(file, { signal: controller.signal }),
      ),
    ).toEqual({ code: "operation.aborted" });
  });
});

describe("notification of the other tabs", () => {
  it("publishes a change of every table after a committed restore only", async () => {
    const test = createTestDatabase();
    await seedOwners(test.container);
    const published: unknown[] = [];
    const notifier: DataChangeNotifier = {
      publish: (change) => published.push(change),
      subscribe: () => () => undefined,
    };
    const service = serviceFor(test, { notifier });
    const backup = expectOk(
      await service.createBackup({ includeAttachments: false }),
    );
    const preview = await previewOf(service, backup.blob, "replace");

    quotaOn((store) => store === "qso_logs");
    expectErr(await service.commitRestore(preview));
    vi.restoreAllMocks();
    expect(published).toEqual([]);

    const again = await previewOf(service, backup.blob, "replace");
    expectOk(await service.commitRestore(again));
    expect(published).toEqual([{ scope: "all" }]);
  });
});
