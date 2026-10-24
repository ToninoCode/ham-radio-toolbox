import { createContainer } from "@/app/container";
import { AppDatabase } from "@/infrastructure/db";
import type { BackupService } from "@/modules/settings-backup";
import { TABLE_NAMES } from "@/shared/application";
import { syntheticTables, writeBackupFile } from "../../support/backup";

/*
 * Runs backup and restore in a real browser (IndexedDB, Blob storage,
 * streams, Web Crypto) on synthetic data, for tests/e2e/backup-browser.spec.ts.
 * Exposed as `window.hrtBackupHarness`; results are plain JSON.
 */

export interface HarnessOptions {
  readonly qsos: number;
  readonly attachments: number;
  readonly attachmentBytes: number;
  readonly maxBackupBytes: number;
}

export interface PhaseMeasure {
  readonly ms: number;
  /** Peak of `performance.memory.usedJSHeapSize` above the phase start. */
  readonly peakHeapDeltaBytes?: number;
}

export interface HarnessResult {
  readonly records: number;
  readonly fileBytes: number;
  readonly exportBytes: number;
  readonly digestsEqual: boolean;
  readonly baselineHeapBytes?: number;
  readonly phases: Readonly<Record<string, PhaseMeasure>>;
  readonly error?: string;
}

interface ChromeMemory {
  readonly usedJSHeapSize: number;
}

function heapNow(): number | undefined {
  return (performance as Performance & { memory?: ChromeMemory }).memory
    ?.usedJSHeapSize;
}

function collectGarbage(): void {
  (globalThis as { gc?: () => void }).gc?.();
}

/** Measures a phase: duration and JS heap peak, sampled every 20 ms. */
async function phase<T>(
  phases: Record<string, PhaseMeasure>,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  collectGarbage();
  const start = heapNow();
  let peak = start ?? 0;
  const timer = setInterval(() => {
    peak = Math.max(peak, heapNow() ?? 0);
  }, 20);
  const t0 = performance.now();
  try {
    return await work();
  } finally {
    clearInterval(timer);
    peak = Math.max(peak, heapNow() ?? 0);
    phases[name] = {
      ms: Math.round(performance.now() - t0),
      ...(start === undefined ? {} : { peakHeapDeltaBytes: peak - start }),
    };
  }
}

/** Table checksums from the `integrity` member at the end of a file. */
async function digestsOf(file: Blob): Promise<Record<string, string>> {
  const tail = await file.slice(Math.max(0, file.size - 8192)).text();
  const start = tail.lastIndexOf('"integrity":');
  const integrity = JSON.parse(
    tail.slice(start + 12, tail.lastIndexOf("}")),
  ) as {
    tables: Record<string, string>;
  };
  return integrity.tables;
}

/** Analysis, preview and commit; nothing they hold survives the call. */
async function restorePhases(
  service: BackupService,
  file: Blob,
  phases: Record<string, PhaseMeasure>,
): Promise<void> {
  const analysis = await phase(phases, "analyze", () =>
    service.analyzeBackup({ name: "harness.json", content: file }),
  );
  if (!analysis.ok) throw new Error(JSON.stringify(analysis.error));
  if (analysis.value.errors.length > 0) {
    throw new Error(JSON.stringify(analysis.value.errors.slice(0, 5)));
  }
  const preview = await phase(phases, "preview", () =>
    service.previewRestore(analysis.value, "replace"),
  );
  if (!preview.ok) throw new Error(JSON.stringify(preview.error));
  const committed = await phase(phases, "commit", () =>
    service.commitRestore(preview.value),
  );
  if (!committed.ok) throw new Error(JSON.stringify(committed.error));
}

async function run(options: HarnessOptions): Promise<HarnessResult> {
  const name = `hrt-harness-${crypto.randomUUID()}`;
  const container = createContainer({
    database: { name },
    backupLimits: { maxBackupBytes: options.maxBackupBytes },
  });
  const phases: Record<string, PhaseMeasure> = {};
  let fileBytes = 0;
  let exportBytes = 0;
  let records = 0;
  try {
    const service = await container.loadBackupService();
    // The generator keeps its tables in memory: it runs before the measured
    // phases, and its data is unreachable once it returns.
    const file = await phase(phases, "generate", async () => {
      const tables = syntheticTables(options);
      records = TABLE_NAMES.reduce(
        (sum, table) => sum + tables[table].length,
        0,
      );
      return writeBackupFile(tables);
    });
    fileBytes = file.size;
    const original = await digestsOf(file);
    collectGarbage();
    const baselineHeapBytes = heapNow();

    await restorePhases(service, file, phases);

    const backup = await phase(phases, "export", () =>
      service.createBackup({ includeAttachments: options.attachments > 0 }),
    );
    if (!backup.ok) throw new Error(JSON.stringify(backup.error));
    exportBytes = backup.value.sizeBytes;
    const exported = await digestsOf(backup.value.blob);
    const digestsEqual = TABLE_NAMES.every(
      (table) => table === "import_jobs" || exported[table] === original[table],
    );
    return {
      records,
      fileBytes,
      exportBytes,
      digestsEqual,
      ...(baselineHeapBytes === undefined ? {} : { baselineHeapBytes }),
      phases,
    };
  } catch (error) {
    return {
      records,
      fileBytes,
      exportBytes,
      digestsEqual: false,
      phases,
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    };
  } finally {
    container.dispose();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = resolve;
    });
  }
}

/** Restores a synthetic dataset of `qsos` QSO into the database `name`. */
async function seed(name: string, qsos: number): Promise<void> {
  const container = createContainer({ database: { name } });
  try {
    const service = await container.loadBackupService();
    await restorePhases(
      service,
      await writeBackupFile(syntheticTables({ qsos, attachments: 0 })),
      {},
    );
  } finally {
    container.dispose();
  }
}

/**
 * Prepares the restore of a larger dataset and starts its commit without
 * waiting for it: resolves as soon as the transaction is running, so that
 * the test can close the page in the middle of it.
 */
async function startCommit(name: string, qsos: number): Promise<void> {
  const container = createContainer({
    database: { name },
    backupLimits: { maxBackupBytes: 2 * 1024 * 1024 * 1024 },
  });
  const service = await container.loadBackupService();
  const file = await writeBackupFile(syntheticTables({ qsos, attachments: 0 }));
  const analysis = await service.analyzeBackup({
    name: "big.json",
    content: file,
  });
  if (!analysis.ok) throw new Error(JSON.stringify(analysis.error));
  const preview = await service.previewRestore(analysis.value, "replace");
  if (!preview.ok) throw new Error(JSON.stringify(preview.error));
  void service.commitRestore(preview.value);
  // About 1 s into a commit that takes several seconds: the transaction has
  // cleared the tables and is writing the new records.
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/** Records per table of the database `name`. */
async function countTables(name: string): Promise<Record<string, number>> {
  const database = new AppDatabase({ name });
  try {
    const counts: Record<string, number> = {};
    for (const table of TABLE_NAMES)
      counts[table] = await database.table(table).count();
    return counts;
  } finally {
    database.close();
  }
}

(window as unknown as { hrtBackupHarness: object }).hrtBackupHarness = {
  run,
  seed,
  startCommit,
  countTables,
};
document.getElementById("status")!.textContent = "loaded";
