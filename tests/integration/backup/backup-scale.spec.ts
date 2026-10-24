// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TABLE_NAMES } from "@/shared/application";
import {
  parseBackup,
  syntheticTables,
  writeBackupFile,
} from "../../support/backup";
import { createTestDatabase } from "../../support/database";
import { expectOk } from "../../support/records";

/*
 * Datasets of growing size (ADR-0015): file → analysis → restore → export,
 * with the exported tables identical to the file. fake-indexeddb runs in
 * memory, so times here are not those of a browser: the realistic
 * measurements are in tests/e2e/backup-browser.spec.ts. Larger sizes and
 * timings: HRT_BACKUP_BENCH=1 npx vitest run backup-scale --silent=false
 */

const bench = Boolean(process.env["HRT_BACKUP_BENCH"]);
const SIZES = bench ? [1_000, 10_000, 50_000] : [10, 500, 3_000];

describe("backup and restore of growing datasets", () => {
  it.each(SIZES)(
    "round-trips %i QSO with their related records",
    { timeout: bench ? 600_000 : 60_000 },
    async (qsos) => {
      const tables = syntheticTables({
        qsos,
        attachments: 2,
        attachmentBytes: 4096,
      });
      const file = await writeBackupFile(tables);
      const test = createTestDatabase();
      const service = await test.container.loadBackupService();

      const t0 = performance.now();
      const analysis = expectOk(
        await service.analyzeBackup({ name: "big.json", content: file }),
      );
      const t1 = performance.now();
      const preview = expectOk(
        await service.previewRestore(analysis, "replace"),
      );
      expectOk(await service.commitRestore(preview));
      const t2 = performance.now();
      const backup = expectOk(
        await service.createBackup({ includeAttachments: true }),
      );
      const t3 = performance.now();

      expect(analysis.recordCount).toBe(
        TABLE_NAMES.reduce((sum, table) => sum + tables[table].length, 0),
      );
      const digests = async (blob: Blob) =>
        (
          (await parseBackup(blob))["integrity"] as {
            tables: Record<string, string>;
          }
        ).tables;
      const original = await digests(file);
      const exported = await digests(backup.blob);
      for (const table of TABLE_NAMES) {
        if (table !== "import_jobs")
          expect(exported[table], table).toBe(original[table]);
      }

      if (bench) {
        console.info(
          JSON.stringify({
            qsos,
            records: analysis.recordCount,
            fileBytes: file.size,
            analyzeMs: Math.round(t1 - t0),
            restoreMs: Math.round(t2 - t1),
            exportMs: Math.round(t3 - t2),
          }),
        );
      }
    },
  );
});
