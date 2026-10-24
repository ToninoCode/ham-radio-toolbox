import { execFile, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Page } from "@playwright/test";

/**
 * Backup and restore in real Chromium (BL-M2-08, ADR-0015): IndexedDB,
 * Blob storage, streams and Web Crypto of the browser, under the production
 * Content-Security-Policy. A harness page (tests/browser/backup-harness)
 * bundles the real code; synthetic datasets go through file → analysis →
 * restore → export, and the exported tables must equal the file's.
 *
 * Runs in its own Playwright project (backup-chromium), after
 * desktop-chromium. In CI one medium dataset runs; HRT_BACKUP_BENCH=1 runs
 * growing sizes and prints times and JS heap peaks (the figures recorded in
 * ADR-0015): HRT_BACKUP_BENCH=1 npx playwright test --project=backup-chromium
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CONFIG = "tests/browser/backup-harness/vite.config.ts";
const PORT = 4175;
const BASE_URL = `http://localhost:${PORT}`;
const MiB = 1024 * 1024;

const run = promisify(execFile);
const bench = Boolean(process.env["HRT_BACKUP_BENCH"]);

interface Scenario {
  readonly label: string;
  readonly qsos: number;
  readonly attachments: number;
  readonly attachmentBytes: number;
}

const SCENARIOS: readonly Scenario[] = bench
  ? [
      { label: "10k QSO", qsos: 10_000, attachments: 0, attachmentBytes: 0 },
      { label: "50k QSO", qsos: 50_000, attachments: 0, attachmentBytes: 0 },
      { label: "100k QSO", qsos: 100_000, attachments: 0, attachmentBytes: 0 },
      { label: "200k QSO", qsos: 200_000, attachments: 0, attachmentBytes: 0 },
      {
        label: "1k QSO + 10×5 MiB",
        qsos: 1_000,
        attachments: 10,
        attachmentBytes: 5 * MiB,
      },
      {
        label: "1k QSO + 15×5 MiB",
        qsos: 1_000,
        attachments: 15,
        attachmentBytes: 5 * MiB,
      },
      {
        label: "1k QSO + 30×5 MiB",
        qsos: 1_000,
        attachments: 30,
        attachmentBytes: 5 * MiB,
      },
      {
        label: "1k QSO + 60×5 MiB",
        qsos: 1_000,
        attachments: 60,
        attachmentBytes: 5 * MiB,
      },
    ]
  : [
      {
        label: "5k QSO + 4×1 MiB",
        qsos: 5_000,
        attachments: 4,
        attachmentBytes: MiB,
      },
    ];

async function startPreview(): Promise<ChildProcess> {
  const server = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--config",
      CONFIG,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    { cwd: ROOT, stdio: "ignore", detached: true },
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(BASE_URL)).ok) return server;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("vite preview of the backup harness did not start");
}

type Harness = {
  run(
    options: Scenario & { maxBackupBytes: number },
  ): Promise<Record<string, unknown>>;
  seed(name: string, qsos: number): Promise<void>;
  startCommit(name: string, qsos: number): Promise<void>;
  countTables(name: string): Promise<Record<string, number>>;
};

async function openHarness(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await expect(page.locator("#status")).toHaveText("loaded");
}

async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
  );
}

test.describe("backup and restore in Chromium", () => {
  test.describe.configure({
    mode: "serial",
    timeout: bench ? 1_800_000 : 180_000,
  });

  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    await run("npx", ["vite", "build", "--config", CONFIG], { cwd: ROOT });
    server = await startPreview();
  });

  test.afterAll(() => {
    if (server?.pid) process.kill(-server.pid);
  });

  for (const scenario of SCENARIOS) {
    test(`round-trips ${scenario.label} under the production CSP`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(() => {
        const violations: string[] = [];
        (window as unknown as { __cspViolations: string[] }).__cspViolations =
          violations;
        document.addEventListener("securitypolicyviolation", (event) => {
          violations.push(`${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      const response = await page.goto(BASE_URL);
      expect(response?.headers()["content-security-policy"]).toContain(
        "script-src 'self'",
      );
      await expect(page.locator("#status")).toHaveText("loaded");

      const result = await page.evaluate(
        (options) =>
          (
            window as unknown as { hrtBackupHarness: Harness }
          ).hrtBackupHarness.run(options),
        { ...scenario, maxBackupBytes: 2048 * MiB },
      );
      const report = { scenario: scenario.label, ...result };
      console.log(JSON.stringify(report));
      await testInfo.attach("backup-measures.json", {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });

      expect(result["error"]).toBeUndefined();
      expect(result["digestsEqual"]).toBe(true);
      expect(await cspViolations(page)).toEqual([]);
    });
  }

  test("a restore interrupted by closing the app leaves the old data or the new, never a mix", async ({
    context,
  }) => {
    const name = `hrt-interrupted-${Date.now()}`;
    const page = await context.newPage();
    await openHarness(page);

    await page.evaluate(
      (db) =>
        (
          window as unknown as { hrtBackupHarness: Harness }
        ).hrtBackupHarness.seed(db, 10),
      name,
    );
    const before = await page.evaluate(
      (db) =>
        (
          window as unknown as { hrtBackupHarness: Harness }
        ).hrtBackupHarness.countTables(db),
      name,
    );
    await page.evaluate(
      (db) =>
        (
          window as unknown as { hrtBackupHarness: Harness }
        ).hrtBackupHarness.startCommit(db, 20_000),
      name,
    );
    // The app is closed while the restore's transaction is running.
    await page.close();

    const reopened = await context.newPage();
    await openHarness(reopened);
    const after = await reopened.evaluate(
      (db) =>
        (
          window as unknown as { hrtBackupHarness: Harness }
        ).hrtBackupHarness.countTables(db),
      name,
    );
    const interrupted = after["qso_logs"] === before["qso_logs"];
    console.log(JSON.stringify({ interrupted, before, after }));
    if (interrupted) {
      expect(after).toEqual(before);
    } else {
      // The commit finished before the page closed: all of it is there.
      expect(after["qso_logs"]).toBe(20_000);
      expect(after["swl_receptions"]).toBe(5_000);
      expect(after["qsl_records"]).toBe(2_000);
    }
  });
});
