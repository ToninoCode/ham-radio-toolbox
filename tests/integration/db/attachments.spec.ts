// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DexieAttachmentRepository } from "@/infrastructure/db/repositories";
import { webCryptoContentHasher } from "@/infrastructure/files/web-crypto-content-hasher";
import { cryptoIdGenerator } from "@/infrastructure/system/crypto-id-generator";
import { createTestDatabase } from "../../support/database";
import {
  attachmentInput,
  expectErr,
  expectOk,
  qslDraft,
  qsoDraft,
  seedOwners,
} from "../../support/records";

/*
 * Attachments (ADR-0009). Run in the node environment: fake-indexeddb
 * clones Blobs with Node's structuredClone (jsdom has another Blob class).
 */

const hash = (content: string) =>
  webCryptoContentHasher.sha256(new Blob([content]));

async function setup() {
  const test = createTestDatabase();
  const owners = await seedOwners(test.container);
  return {
    test,
    attachments: test.container.repositories.attachments,
    ...owners,
  };
}

describe("ContentHasher (Web Crypto)", () => {
  it("matches the FIPS 180-2 test vectors", async () => {
    expect(await hash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await hash("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("attachments: metadata and content", () => {
  it("stores the Blob and lists metadata without it", async () => {
    const { attachments, qso } = await setup();
    const sha256 = await hash("73 de IZ1ABC");
    const metadata = expectOk(
      await attachments.create(
        attachmentInput("qso", qso.id, "73 de IZ1ABC", sha256, {
          fileName: "../../log/Foto QSO?.txt",
          mimeType: "Text/Plain; charset=utf-8",
        }),
      ),
    );
    expect(metadata).toEqual({
      id: metadata.id,
      ownerType: "qso",
      ownerId: qso.id,
      fileName: "_.._log_Foto QSO_.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      sha256,
      createdAt: metadata.createdAt,
    });
    expect("blob" in metadata).toBe(false);

    const listed = expectOk(await attachments.listByOwner("qso", qso.id));
    expect(listed).toEqual([metadata]);
    expect(listed.every((item) => !("blob" in item))).toBe(true);

    const content = expectOk(await attachments.getContent(metadata.id));
    expect(content.size).toBe(12);
    expect(await content.text()).toBe("73 de IZ1ABC");
    expect(expectOk(await attachments.getMetadata(metadata.id))).toEqual(
      metadata,
    );
  });

  it("keeps the content after reopening the database", async () => {
    const { attachments, qso, test } = await setup();
    const metadata = expectOk(
      await attachments.create(
        attachmentInput("qso", qso.id, "audio", await hash("audio"), {
          fileName: "rx.ogg",
          mimeType: "audio/ogg",
          blob: new Blob(["audio"], { type: "audio/ogg" }),
        }),
      ),
    );
    const reopened = test.reopen().container.repositories.attachments;
    const blob = expectOk(await reopened.getContent(metadata.id));
    expect(await blob.text()).toBe("audio");
    expect(blob.type).toBe("audio/ogg");
  });

  it("rejects types outside the allowed list and empty names", async () => {
    const { attachments, qso } = await setup();
    const sha256 = await hash("x");
    for (const [overrides, code] of [
      [{ mimeType: "text/html" }, "attachment.mime-type-not-allowed"],
      [{ mimeType: "image/svg+xml" }, "attachment.mime-type-not-allowed"],
      [{ fileName: " ... " }, "attachment.file-name-empty"],
    ] as const) {
      expect(
        expectErr(
          await attachments.create(
            attachmentInput("qso", qso.id, "x", sha256, overrides),
          ),
        ),
      ).toMatchObject({
        code: "persistence.invalid-input",
        issues: [{ code }],
      });
    }
  });

  it("enforces the configured size limit", async () => {
    const { attachments, qso, test } = await setup();
    const small = new DexieAttachmentRepository(
      test.db,
      { clock: test.clock, ids: cryptoIdGenerator },
      { maxBytes: 4 },
    );
    expect(
      expectErr(
        await small.create(
          attachmentInput("qso", qso.id, "12345", await hash("12345")),
        ),
      ),
    ).toEqual({
      code: "persistence.invalid-input",
      table: "attachments",
      issues: [{ path: "sizeBytes", code: "attachment.too-large" }],
    });
    expectOk(
      await attachments.create(
        attachmentInput("qso", qso.id, "12345", await hash("12345")),
      ),
    );
  });

  it("requires an existing owner; resources have no table before v5", async () => {
    const { attachments } = await setup();
    const sha256 = await hash("x");
    const missing = crypto.randomUUID();
    expect(
      expectErr(
        await attachments.create(attachmentInput("qsl", missing, "x", sha256)),
      ),
    ).toMatchObject({
      reason: "missing-reference",
      rule: "attachment.owner-missing",
      related: "qsl_records",
    });
    expect(
      expectErr(
        await attachments.create(
          attachmentInput("resource", missing, "x", sha256),
        ),
      ),
    ).toMatchObject({
      reason: "missing-reference",
      rule: "attachment.owner-type-unavailable",
    });
  });
});

describe("attachments: deduplication limited to the owner (ADR-0009)", () => {
  it("refuses the same content twice on the same owner", async () => {
    const { attachments, qso } = await setup();
    const sha256 = await hash("scan");
    const first = expectOk(
      await attachments.create(attachmentInput("qso", qso.id, "scan", sha256)),
    );
    expect(
      expectErr(
        await attachments.create(
          attachmentInput("qso", qso.id, "scan", sha256, {
            fileName: "copia.txt",
          }),
        ),
      ),
    ).toEqual({
      code: "persistence.conflict",
      table: "attachments",
      reason: "duplicate",
      rule: "attachment.same-content",
      key: first.id,
    });
  });

  it("keeps a separate copy for each owner of the same content", async () => {
    const { attachments, qso, reception, test } = await setup();
    const sha256 = await hash("shared");
    const onQso = expectOk(
      await attachments.create(
        attachmentInput("qso", qso.id, "shared", sha256),
      ),
    );
    const onReception = expectOk(
      await attachments.create(
        attachmentInput("swl_reception", reception.id, "shared", sha256),
      ),
    );
    expect(onQso.id).not.toBe(onReception.id);
    expect(
      await test.db.attachments.where("sha256").equals(sha256).count(),
    ).toBe(2);

    // Deleting one owner never removes the other owner's file.
    expectOk(await test.container.repositories.qsoLogs.delete(qso.id));
    const remaining = expectOk(await attachments.getContent(onReception.id));
    expect(await remaining.text()).toBe("shared");
    expect(expectErr(await attachments.getContent(onQso.id))).toMatchObject({
      code: "persistence.not-found",
    });
  });

  it("serialises concurrent uploads of the same content to one owner", async () => {
    const { attachments, qso, test } = await setup();
    const sha256 = await hash("burst");
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        attachments.create(attachmentInput("qso", qso.id, "burst", sha256)),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await test.db.attachments.count()).toBe(1);
  });

  it("deletes a single attachment and reports a missing one", async () => {
    const { attachments, qso } = await setup();
    const metadata = expectOk(
      await attachments.create(
        attachmentInput("qso", qso.id, "x", await hash("x")),
      ),
    );
    expect(expectOk(await attachments.delete(metadata.id))).toEqual({
      attachments: 1,
    });
    expect(expectErr(await attachments.delete(metadata.id))).toMatchObject({
      code: "persistence.not-found",
    });
  });

  it("attaches files to QSL records too", async () => {
    const { attachments, qso, test } = await setup();
    const qsl = expectOk(
      await test.container.repositories.qslRecords.create(
        qslDraft("qso", qso.id),
      ),
    );
    const second = expectOk(
      await test.container.repositories.qsoLogs.create(
        qsoDraft(qso.stationProfileId),
      ),
    );
    expectOk(
      await attachments.create(
        attachmentInput("qsl", qsl.id, "card", await hash("card")),
      ),
    );
    expect(expectOk(await attachments.listByOwner("qsl", qsl.id))).toHaveLength(
      1,
    );
    expect(expectOk(await attachments.listByOwner("qso", second.id))).toEqual(
      [],
    );
  });
});
