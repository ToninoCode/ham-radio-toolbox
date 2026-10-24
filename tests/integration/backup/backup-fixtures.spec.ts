// @vitest-environment node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseBackup,
  snapshotTables,
  syntheticTables,
  writeBackupFile,
} from "../../support/backup";
import { createTestDatabase } from "../../support/database";
import { expectOk } from "../../support/records";

/*
 * Backup fixtures (DATABASE.md § 9.2): a v1 file kept in the repository must
 * restore with every later version of the app. The fixture is synthetic and
 * deterministic; regenerate it (only while the format is still v1 and
 * unreleased) with HRT_UPDATE_FIXTURES=1 npm run test.
 */

const V1_FIXTURE = fileURLToPath(
  new URL("../../fixtures/backup/v1-basic.json", import.meta.url),
);

const fixtureTables = () =>
  syntheticTables({ qsos: 6, attachments: 1, attachmentBytes: 48 });

describe("backup fixture v1", () => {
  it("is still produced byte for byte by the writer (format v1, schema v1)", async () => {
    const text = await (await writeBackupFile(fixtureTables())).text();
    if (process.env["HRT_UPDATE_FIXTURES"]) await writeFile(V1_FIXTURE, text);
    expect(text).toBe(await readFile(V1_FIXTURE, "utf8"));
  });

  it("restores into an empty database with every record", async () => {
    const test = createTestDatabase();
    const service = await test.container.loadBackupService();
    const content = new Blob([await readFile(V1_FIXTURE)]);
    const analysis = expectOk(
      await service.analyzeBackup({ name: "v1-basic.json", content }),
    );
    expect(analysis.errors).toEqual([]);
    const preview = expectOk(await service.previewRestore(analysis, "replace"));
    expectOk(await service.commitRestore(preview));

    const stored = await snapshotTables(test.db);
    const expected = await snapshotTables({
      table: (name: string) => ({
        toArray: async () =>
          fixtureTables()[name as keyof ReturnType<typeof fixtureTables>],
      }),
    });
    expect({
      ...stored,
      import_jobs: stored.import_jobs.filter(
        (job) => (job as { kind: string }).kind !== "backup",
      ),
    }).toEqual(expected);

    // Re-exported, the restored data has the fixture's tables.
    const exported = await parseBackup(
      expectOk(await service.createBackup({ includeAttachments: true })).blob,
    );
    const fixture = await parseBackup(content);
    const { import_jobs: _jobs, ...tables } = fixture["tables"] as Record<
      string,
      unknown
    >;
    expect(exported["tables"]).toMatchObject(tables);
  });
});
