// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../../support/database";
import {
  expectErr,
  expectOk,
  qslDraft,
  seedOwners,
} from "../../support/records";

async function setup() {
  const test = createTestDatabase();
  const owners = await seedOwners(test.container);
  return { test, qsl: test.container.repositories.qslRecords, ...owners };
}

describe("QSL records", () => {
  it("links records to a QSO and to a reception", async () => {
    const { qsl, qso, reception } = await setup();
    const paper = expectOk(
      await qsl.create(
        qslDraft("qso", qso.id, {
          via: "bureau",
          managerCallsign: "iz1zzz",
          status: "sent",
          sentAt: "2026-10-25T09:00:00Z",
        }),
      ),
    );
    const lotw = expectOk(
      await qsl.create(qslDraft("qso", qso.id, { channel: "lotw" })),
    );
    const swl = expectOk(await qsl.create(qslDraft("swl", reception.id)));

    expect(paper.managerCallsign).toBe("IZ1ZZZ");
    expect(expectOk(await qsl.listBySubject("qso", qso.id))).toEqual([
      paper,
      lotw,
    ]);
    expect(expectOk(await qsl.listBySubject("swl", reception.id))).toEqual([
      swl,
    ]);
  });

  it("requires an existing subject of the declared type", async () => {
    const { qsl, qso, test } = await setup();
    expect(expectErr(await qsl.create(qslDraft("swl", qso.id)))).toEqual({
      code: "persistence.conflict",
      table: "qsl_records",
      reason: "missing-reference",
      rule: "qsl-record.subject-missing",
      key: qso.id,
      related: "swl_receptions",
    });
    expect(await test.db.qsl_records.count()).toBe(0);
  });

  it("allows one record per subject and channel", async () => {
    const { qsl, qso } = await setup();
    const first = expectOk(await qsl.create(qslDraft("qso", qso.id)));
    expect(expectErr(await qsl.create(qslDraft("qso", qso.id)))).toEqual({
      code: "persistence.conflict",
      table: "qsl_records",
      reason: "duplicate",
      rule: "qsl-record.channel-taken",
      key: first.id,
    });
  });

  it("checks the channel on update and keeps the subject fixed", async () => {
    const { qsl, qso, reception } = await setup();
    const paper = expectOk(await qsl.create(qslDraft("qso", qso.id)));
    const eqsl = expectOk(
      await qsl.create(qslDraft("qso", qso.id, { channel: "eqsl" })),
    );
    expect(
      expectErr(await qsl.update(eqsl.id, { channel: "paper" })),
    ).toMatchObject({ reason: "duplicate", key: paper.id });

    const updated = expectOk(
      await qsl.update(paper.id, {
        status: "confirmed",
        confirmedAt: "2026-11-02T08:00:00Z",
        subjectType: "swl",
        subjectId: reception.id,
      } as Record<string, unknown>),
    );
    expect(updated).toMatchObject({
      status: "confirmed",
      subjectType: "qso",
      subjectId: qso.id,
    });
  });

  it("serialises concurrent creations on the same channel", async () => {
    const { qsl, qso, test } = await setup();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => qsl.create(qslDraft("qso", qso.id))),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results
        .filter((result) => !result.ok)
        .map((result) => !result.ok && result.error.code),
    ).toEqual(Array(3).fill("persistence.conflict"));
    expect(await test.db.qsl_records.count()).toBe(1);
  });
});
