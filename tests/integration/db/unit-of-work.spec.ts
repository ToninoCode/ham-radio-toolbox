// @vitest-environment node
import { IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/shared/types";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import { createTestDatabase } from "../../support/database";
import {
  attachmentInput,
  expectErr,
  expectOk,
  qslDraft,
  qsoDraft,
  stationProfileDraft,
} from "../../support/records";

/*
 * BL-M2-06: atomic multi-record writes and rollback through the UnitOfWork
 * port (DexieUnitOfWork: one read-write transaction over every table).
 */

afterEach(() => {
  vi.restoreAllMocks();
});

async function counts(test: ReturnType<typeof createTestDatabase>) {
  const { db } = test;
  return {
    station_profiles: await db.station_profiles.count(),
    qso_logs: await db.qso_logs.count(),
    qsl_records: await db.qsl_records.count(),
    attachments: await db.attachments.count(),
  };
}

const EMPTY = {
  station_profiles: 0,
  qso_logs: 0,
  qsl_records: 0,
  attachments: 0,
};

describe("UnitOfWork: atomic save of related records", () => {
  it("commits a profile, a QSO, its QSL and an attachment together", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    // Hashing is asynchronous I/O: done before the unit (UnitOfWork rule).
    const sha256 = await webCryptoContentHasher.sha256(new Blob(["scan"]));

    const result = await unitOfWork.run(async () => {
      const profile = await repositories.stationProfiles.create(
        stationProfileDraft(),
      );
      if (!profile.ok) return profile;
      const qso = await repositories.qsoLogs.create(qsoDraft(profile.value.id));
      if (!qso.ok) return qso;
      const qsl = await repositories.qslRecords.create(
        qslDraft("qso", qso.value.id),
      );
      if (!qsl.ok) return qsl;
      const attachment = await repositories.attachments.create(
        attachmentInput("qsl", qsl.value.id, "scan", sha256),
      );
      if (!attachment.ok) return attachment;
      return ok({ qso: qso.value, qsl: qsl.value });
    });

    const { qso, qsl } = expectOk(result);
    expect(await counts(test)).toEqual({
      station_profiles: 1,
      qso_logs: 1,
      qsl_records: 1,
      attachments: 1,
    });
    expect(
      expectOk(await repositories.qslRecords.listBySubject("qso", qso.id)),
    ).toEqual([qsl]);
  });
});

describe("UnitOfWork: rollback", () => {
  it("rolls back everything and returns the error when work returns err", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;

    const result = await unitOfWork.run(async () => {
      const profile = expectOk(
        await repositories.stationProfiles.create(stationProfileDraft()),
      );
      expectOk(await repositories.qsoLogs.create(qsoDraft(profile.id)));
      // A later step fails validation: the whole unit must disappear.
      return repositories.qsoLogs.create(
        qsoDraft(profile.id, { callsign: "not a callsign" }),
      );
    });

    expect(expectErr(result)).toMatchObject({
      code: "persistence.invalid-input",
      table: "qso_logs",
    });
    expect(await counts(test)).toEqual(EMPTY);
  });

  it("rolls back with a domain error of the use case", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const result = await unitOfWork.run(async () => {
      expectOk(
        await repositories.stationProfiles.create(stationProfileDraft()),
      );
      return err({ code: "qso.duplicate" as const });
    });
    expect(result).toEqual({ ok: false, error: { code: "qso.duplicate" } });
    expect(await counts(test)).toEqual(EMPTY);
  });

  it("rolls back and rethrows an unexpected exception", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    await expect(
      unitOfWork.run(async () => {
        expectOk(
          await repositories.stationProfiles.create(stationProfileDraft()),
        );
        throw new TypeError("bug in the use case");
      }),
    ).rejects.toThrow("bug in the use case");
    expect(await counts(test)).toEqual(EMPTY);
  });

  it("rolls back on quota exhaustion and reports it", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const profile = expectOk(
      await repositories.stationProfiles.create(stationProfileDraft()),
    );
    // The second write of the unit exceeds the quota.
    let writes = 0;
    const add = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      writes += 1;
      if (writes === 2) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      return add.apply(this, args);
    });

    const result = await unitOfWork.run(async () => {
      const first = await repositories.qsoLogs.create(qsoDraft(profile.id));
      if (!first.ok) return first;
      return repositories.qsoLogs.create(qsoDraft(profile.id));
    });

    expect(expectErr(result)).toEqual({ code: "persistence.quota-exceeded" });
    expect(await test.db.qso_logs.count()).toBe(0);
  });

  it("does not report success when work ignores a storage failure", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const result = await unitOfWork.run(async () => {
      // The error result is dropped: the transaction is aborted anyway.
      await repositories.importJobs.create({
        kind: "adif",
        status: "failed",
        startedAt: "2026-10-24T10:00:00Z",
        finishedAt: "2026-10-24T10:00:01Z",
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
      return ok("done");
    });
    expect(result.ok).toBe(false);
    expect(await test.db.import_jobs.count()).toBe(0);
  });
});

describe("UnitOfWork: transaction scope", () => {
  it("reports the premature commit caused by awaiting non-database work", async () => {
    // Documents the rule of the UnitOfWork port: while `work` waits for a
    // timer (or a file read, a hash, fetch…) IndexedDB commits the
    // transaction on its own. The writes done before stay committed and the
    // next operation fails: the unit is not atomic any more.
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const result = await unitOfWork.run(async () => {
      expectOk(
        await repositories.stationProfiles.create(
          stationProfileDraft({ name: "Prima" }),
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      return repositories.stationProfiles.create(
        stationProfileDraft({ name: "Dopo" }),
      );
    });
    expect(expectErr(result)).toMatchObject({
      code: "persistence.transaction-failed",
    });
    const names = (await test.db.station_profiles.toArray()).map((p) => p.name);
    expect(names).toEqual(["Prima"]);
  });

  it("joins nested units: a failing inner unit rolls back the outer one", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const result = await unitOfWork.run(async () => {
      expectOk(
        await repositories.stationProfiles.create(stationProfileDraft()),
      );
      const inner = await unitOfWork.run(async () =>
        err({ code: "inner.failed" as const }),
      );
      return inner.ok ? ok("unexpected") : inner;
    });
    expect(result.ok).toBe(false);
    expect(await counts(test)).toEqual(EMPTY);
  });

  it("commits nested units that succeed with the outer one", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const result = await unitOfWork.run(async () => {
      const profile = await unitOfWork.run(() =>
        repositories.stationProfiles.create(stationProfileDraft()),
      );
      if (!profile.ok) return profile;
      return repositories.qsoLogs.create(qsoDraft(profile.value.id));
    });
    expectOk(result);
    expect(await counts(test)).toMatchObject({
      station_profiles: 1,
      qso_logs: 1,
    });
  });
});

describe("UnitOfWork: concurrency", () => {
  it("serialises concurrent units: no lost update on a read-then-write", async () => {
    const test = createTestDatabase();
    const { unitOfWork, repositories } = test.container;
    const profile = expectOk(
      await repositories.stationProfiles.create(stationProfileDraft()),
    );
    // Each unit reads the current power and adds 10 W.
    const increment = () =>
      unitOfWork.run(async () => {
        const current = await repositories.stationProfiles.get(profile.id);
        if (!current.ok) return current;
        return repositories.stationProfiles.update(profile.id, {
          equipment: {
            powerW: (current.value.equipment?.powerW ?? 0) + 10,
          },
        });
      });
    const results = await Promise.all(Array.from({ length: 5 }, increment));
    results.forEach((result) => expectOk(result));
    expect(
      expectOk(await repositories.stationProfiles.get(profile.id)).equipment,
    ).toEqual({ powerW: 50 });
  });
});
