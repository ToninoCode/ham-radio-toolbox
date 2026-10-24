// @vitest-environment node
import { IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import { createTestDatabase } from "../../support/database";
import {
  attachmentInput,
  expectErr,
  expectOk,
  qslDraft,
  qsoDraft,
  receptionInput,
  seedOwners,
} from "../../support/records";

/*
 * BL-M2-06: deletion rules of DATABASE.md § 6, executed in one transaction
 * by the owner repositories. Every test checks both what is removed and
 * what must survive (records of other owners).
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const hash = (content: string) =>
  webCryptoContentHasher.sha256(new Blob([content]));

/** A QSO and a reception, each with two QSL (one with a scan) and a file. */
async function populated() {
  const test = createTestDatabase();
  const { repositories } = test.container;
  const owners = await seedOwners(test.container);
  const { qso, reception, profile } = owners;
  const other = expectOk(
    await repositories.qsoLogs.create(
      qsoDraft(profile.id, { callsign: "DL1AAA" }),
    ),
  );

  const qsoPaper = expectOk(
    await repositories.qslRecords.create(qslDraft("qso", qso.id)),
  );
  expectOk(
    await repositories.qslRecords.create(
      qslDraft("qso", qso.id, { channel: "lotw" }),
    ),
  );
  const swlPaper = expectOk(
    await repositories.qslRecords.create(qslDraft("swl", reception.id)),
  );
  const otherQsl = expectOk(
    await repositories.qslRecords.create(qslDraft("qso", other.id)),
  );

  const file = async (
    ownerType: "qso" | "swl_reception" | "qsl",
    ownerId: string,
    content: string,
  ) =>
    expectOk(
      await repositories.attachments.create(
        attachmentInput(ownerType, ownerId, content, await hash(content)),
      ),
    );
  await file("qso", qso.id, "qso photo");
  await file("qsl", qsoPaper.id, "qso card");
  await file("swl_reception", reception.id, "recording");
  await file("qsl", swlPaper.id, "swl card");
  const otherFile = await file("qso", other.id, "other photo");
  const otherCard = await file("qsl", otherQsl.id, "other card");

  return { test, ...owners, other, otherQsl, otherFile, otherCard };
}

async function tableCounts(test: ReturnType<typeof createTestDatabase>) {
  const { db } = test;
  return {
    qso_logs: await db.qso_logs.count(),
    swl_receptions: await db.swl_receptions.count(),
    reception_details: await db.reception_details.count(),
    qsl_records: await db.qsl_records.count(),
    attachments: await db.attachments.count(),
  };
}

describe("cascades (DATABASE.md § 6)", () => {
  it("starts from the expected data set", async () => {
    const { test } = await populated();
    expect(await tableCounts(test)).toEqual({
      qso_logs: 2,
      swl_receptions: 1,
      reception_details: 1,
      qsl_records: 4,
      attachments: 6,
    });
  });

  it("deleting a QSO removes its QSL, their attachments and its attachments", async () => {
    const { test, qso, other, otherQsl, otherFile, otherCard } =
      await populated();
    const { repositories } = test.container;
    expect(expectOk(await repositories.qsoLogs.delete(qso.id))).toEqual({
      qso_logs: 1,
      qsl_records: 2,
      attachments: 2,
    });
    expect(await tableCounts(test)).toEqual({
      qso_logs: 1,
      swl_receptions: 1,
      reception_details: 1,
      qsl_records: 2,
      attachments: 4,
    });
    // The other QSO keeps everything.
    expectOk(await repositories.qsoLogs.get(other.id));
    expectOk(await repositories.qslRecords.get(otherQsl.id));
    expectOk(await repositories.attachments.getContent(otherFile.id));
    expectOk(await repositories.attachments.getContent(otherCard.id));
    expect(
      expectOk(await repositories.qslRecords.listBySubject("qso", qso.id)),
    ).toEqual([]);
  });

  it("deleting a reception removes details, QSL, their attachments and its attachments", async () => {
    const { test, reception } = await populated();
    const { repositories } = test.container;
    expect(
      expectOk(await repositories.swlReceptions.delete(reception.id)),
    ).toEqual({
      swl_receptions: 1,
      reception_details: 1,
      qsl_records: 1,
      attachments: 2,
    });
    expect(await tableCounts(test)).toEqual({
      qso_logs: 2,
      swl_receptions: 0,
      reception_details: 0,
      qsl_records: 3,
      attachments: 4,
    });
  });

  it("deleting a QSL record removes only its attachments", async () => {
    const { test, otherQsl, other, otherFile } = await populated();
    const { repositories } = test.container;
    expect(expectOk(await repositories.qslRecords.delete(otherQsl.id))).toEqual(
      {
        qsl_records: 1,
        attachments: 1,
      },
    );
    expectOk(await repositories.qsoLogs.get(other.id));
    expectOk(await repositories.attachments.getContent(otherFile.id));
  });

  it("rolls back a cascade that fails halfway", async () => {
    const { test, qso } = await populated();
    const before = await tableCounts(test);
    // The last step of the cascade (deleting the QSO itself) fails.
    const original = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["delete"]>
    ) {
      if (this.name === "qso_logs") {
        throw new DOMException("simulated abort", "AbortError");
      }
      return original.apply(this, args);
    });
    expect(
      expectErr(await test.container.repositories.qsoLogs.delete(qso.id)),
    ).toMatchObject({ code: "persistence.transaction-failed" });
    vi.restoreAllMocks();
    expect(await tableCounts(test)).toEqual(before);
  });

  it("prevents orphans created concurrently with a delete", async () => {
    const { test, other } = await populated();
    const { repositories } = test.container;
    // Delete and new QSL on the same QSO race: whatever the order, no QSL
    // may survive pointing at a deleted QSO.
    const [deleted, created] = await Promise.all([
      repositories.qsoLogs.delete(other.id),
      repositories.qslRecords.create(
        qslDraft("qso", other.id, { channel: "qrz" }),
      ),
    ]);
    expectOk(deleted);
    if (created.ok) {
      expect(
        expectErr(await repositories.qslRecords.get(created.value.id)),
      ).toMatchObject({ code: "persistence.not-found" });
    } else {
      expect(created.error).toMatchObject({ reason: "missing-reference" });
    }
    const orphans = await test.db.qsl_records
      .where("[subjectType+subjectId]")
      .equals(["qso", other.id])
      .count();
    expect(orphans).toBe(0);
  });

  it("tolerates references to tables of later versions (orphans by design)", async () => {
    const test = createTestDatabase();
    const { profile } = await seedOwners(test.container);
    const created = expectOk(
      await test.container.repositories.swlReceptions.create(
        receptionInput(profile.id, {
          scheduleId: crypto.randomUUID(),
          stationId: crypto.randomUUID(),
          satelliteId: crypto.randomUUID(),
        }),
      ),
    );
    expect(created.reception.scheduleId).toBeDefined();
  });
});
