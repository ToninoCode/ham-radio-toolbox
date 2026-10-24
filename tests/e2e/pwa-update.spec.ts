import { execFile, spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { buildIdOf, waitForServiceWorker } from "./support";

/**
 * Real update flow with two production builds (BL-M1-11): version v1 is
 * installed, version v2 is deployed in place, the waiting service worker is
 * offered to the user, who first postpones and then accepts it.
 *
 * It uses its own output directory and preview server, so the shared server
 * of the other tests is never rebuilt underneath them.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT_DIR = "node_modules/.tmp/e2e-pwa-update";
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;

const run = promisify(execFile);

async function build(buildId: string) {
  await run(
    "npx",
    [
      "vite",
      "build",
      "--outDir",
      OUT_DIR,
      "--emptyOutDir",
      "--logLevel",
      "error",
    ],
    { cwd: ROOT, env: { ...process.env, HRT_BUILD_ID: buildId } },
  );
}

async function startPreview(): Promise<ChildProcess> {
  const server = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--outDir",
      OUT_DIR,
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
  throw new Error("vite preview did not start");
}

test.describe("application update", () => {
  test.describe.configure({ timeout: 180_000 });

  let server: ChildProcess | undefined;

  test.afterAll(async () => {
    // Only the worker that ran the test cleans up: afterAll also runs in the
    // workers of the projects where the test is skipped, and removing the
    // output there would break a run in progress on desktop-chromium.
    if (!server) return;
    if (server.pid) process.kill(-server.pid);
    server = undefined;
    await rm(`${ROOT}${OUT_DIR}`, { recursive: true, force: true });
  });

  test("a new version waits for the user's confirmation", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Builds twice: run once, on the desktop project",
    );
    await build("e2e-v1");
    server = await startPreview();

    await page.goto(BASE_URL);
    await waitForServiceWorker(page);
    expect(await buildIdOf(page)).toBe("e2e-v1");
    await expect(page.getByTestId("pwa-update")).toHaveCount(0);

    // Deploy v2 in place and let the registration look for it.
    await build("e2e-v2");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

    const prompt = page.getByTestId("pwa-update");
    await expect(prompt).toBeVisible({ timeout: 15_000 });
    await expect(prompt).toContainText("Nuova versione disponibile.");

    // Postpone: nothing changes, not even after a reload.
    await prompt.getByRole("button", { name: "Più tardi" }).click();
    await expect(prompt).toHaveCount(0);
    expect(await buildIdOf(page)).toBe("e2e-v1");

    await page.reload();
    expect(await buildIdOf(page)).toBe("e2e-v1");
    await expect(page.getByTestId("pwa-update")).toBeVisible({
      timeout: 15_000,
    });

    // Accept: the waiting worker takes over and the page reloads on v2.
    await page.getByTestId("pwa-update-confirm").click();
    await expect
      .poll(() => buildIdOf(page), { timeout: 15_000 })
      .toBe("e2e-v2");
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("pwa-update")).toHaveCount(0);
  });
});
