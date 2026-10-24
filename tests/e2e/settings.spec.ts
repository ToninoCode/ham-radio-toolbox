import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { trackErrors, VIEWPORTS, waitForServiceWorker } from "./support";

/*
 * Settings & Backup in Chromium (BL-M2-09): station profiles, persisted
 * preferences, storage status, backup download and restore, IndexedDB
 * unavailable, two tabs. Each test has its own browser context, hence its
 * own empty IndexedDB. Synthetic data only.
 */

async function openSettings(page: Page): Promise<void> {
  await page.goto("/settings-backup");
  await expect(page.getByTestId("settings")).toBeVisible();
  await expect(page.getByTestId("profiles-section")).not.toContainText(
    "Caricamento dei profili",
  );
}

async function createProfile(
  page: Page,
  values: { name: string; callsign?: string; kind?: "HAM" | "SWL" },
): Promise<void> {
  await page.getByTestId("profile-add").click();
  const form = page.getByTestId("profile-form");
  await expect(form).toBeVisible();
  if (values.kind === "SWL") {
    await form
      .getByTestId("profile-kind")
      .getByText("SWL", { exact: true })
      .click();
  }
  await form.getByLabel("Nome del profilo").fill(values.name);
  if (values.callsign)
    await form.getByLabel("Nominativo").fill(values.callsign);
  await page.getByRole("button", { name: "Salva il profilo" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByTestId("profiles-message")).toContainText(
    `Profilo «${values.name}» salvato.`,
  );
}

function profileItem(page: Page, name: string) {
  return page.getByTestId("profile-item").filter({ hasText: name });
}

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

test.describe("station profiles", () => {
  test("first profile, validation, default change and deletion", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await openSettings(page);
    await expect(page.getByTestId("profiles-section")).toContainText(
      "Nessun profilo stazione",
    );

    // Validation: messages next to the fields, nothing saved.
    await page.getByTestId("profile-add").click();
    const form = page.getByTestId("profile-form");
    await expect(form.getByTestId("first-default")).toBeVisible();
    await form.getByLabel("Locator").fill("ZZ99");
    await page.getByRole("button", { name: "Salva il profilo" }).click();
    await expect(form.getByLabel("Nome del profilo")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(form).toContainText("Campo obbligatorio.");
    await expect(form).toContainText("Locator non valido");
    await expect(form.getByLabel("Locator")).toHaveValue("ZZ99");
    await page.getByRole("button", { name: "Annulla" }).click();

    await createProfile(page, { name: "Casa", callsign: "iz1abc" });
    await expect(
      profileItem(page, "Casa").getByTestId("profile-default"),
    ).toBeVisible();
    await expect(
      profileItem(page, "Casa").getByTestId("profile-remove"),
    ).toBeDisabled();

    await createProfile(page, { name: "Ascolto", kind: "SWL" });
    await profileItem(page, "Ascolto")
      .getByTestId("profile-make-default")
      .click();
    await expect(
      profileItem(page, "Ascolto").getByTestId("profile-default"),
    ).toBeVisible();
    await expect(
      profileItem(page, "Casa").getByTestId("profile-default"),
    ).toHaveCount(0);

    // Persisted: a reload shows the same profiles and default.
    await page.reload();
    await expect(
      profileItem(page, "Ascolto").getByTestId("profile-default"),
    ).toBeVisible();

    await profileItem(page, "Ascolto").getByTestId("profile-remove").click();
    await expect(page.getByRole("dialog")).toContainText(
      "Eliminare il profilo?",
    );
    await page.getByTestId("profile-remove-confirm").click();
    await expect(profileItem(page, "Ascolto")).toHaveCount(0);
    await expect(
      profileItem(page, "Casa").getByTestId("profile-default"),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("persisted preferences", () => {
  test("favourites and theme survive a reload and an offline restart of the PWA", async ({
    page,
    context,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await waitForServiceWorker(page);

    await page
      .locator(
        '[data-area] [data-module="propagation"] [data-testid="favorite-toggle"]',
      )
      .click();
    await page
      .locator(
        '[data-area] [data-module="ham-logbook"] [data-testid="favorite-toggle"]',
      )
      .click();
    await page.getByTestId("app-header").getByTitle("Scuro").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const pinned = page.getByTestId("favorites").getByTestId("module-card");
    await expect(pinned).toHaveCount(2);
    await expect(page.getByTestId("favorites-note")).toHaveCount(0);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(pinned).toHaveCount(2);
    await expect(pinned.first()).toHaveAttribute("data-module", "propagation");

    // Restart offline: new page in the same context, network off.
    await context.setOffline(true);
    const restarted = await context.newPage();
    await page.close();
    await restarted.emulateMedia({ colorScheme: "light" });
    await restarted.goto("/");
    await expect(restarted.getByTestId("dashboard")).toBeVisible();
    await expect(restarted.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      restarted.getByTestId("favorites").getByTestId("module-card"),
    ).toHaveCount(2);
    await restarted.goto("/settings-backup");
    await expect(restarted.getByTestId("settings")).toBeVisible();
    await context.setOffline(false);
  });

  test("the stored theme is applied before the page appears", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.getByTestId("app-header").getByTitle("Scuro").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    // Record the theme class every time the app root gets content.
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { __themeAtMount: string[] }).__themeAtMount = seen;
      new MutationObserver(() => {
        const app = document.getElementById("app");
        if (app && app.childElementCount > 0 && seen.length === 0) {
          seen.push(document.documentElement.className);
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible();
    const atMount = await page.evaluate(
      () => (window as unknown as { __themeAtMount: string[] }).__themeAtMount,
    );
    expect(atMount[0]).toMatch(/\bdark\b/);
  });
});

test.describe("IndexedDB unavailable", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Storage blocked (private mode, policy): every open fails.
      IDBFactory.prototype.open = function open() {
        throw new DOMException("blocked by test", "SecurityError");
      };
    });
  });

  test("navigation and dashboard keep working and say that changes may be lost", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/");
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("database-unavailable")).toContainText(
      "le modifiche potrebbero non essere salvate",
    );
    await page
      .locator(
        '[data-area] [data-module="propagation"] [data-testid="favorite-toggle"]',
      )
      .click();
    await expect(
      page.getByTestId("favorites").getByTestId("module-card"),
    ).toHaveCount(1);
    await expect(page.getByTestId("favorites-note")).toContainText(
      "restano solo fino alla chiusura dell'app",
    );

    await page
      .getByTestId("sidebar")
      .locator('a[data-module="settings-backup"]')
      .click();
    await expect(page.getByTestId("storage-database")).toContainText(
      "Non disponibile",
    );
    await page
      .getByTestId("sidebar")
      .locator('a[data-module="rf-calculators"]')
      .click();
    await expect(page.getByTestId("under-development")).toBeVisible();
  });
});

test.describe("backup and restore", () => {
  test("export, download, restore with preview and confirmation; the UI follows", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.emulateMedia({ colorScheme: "light" });
    await openSettings(page);
    await createProfile(page, { name: "Casa", callsign: "iz1abc" });
    await page.getByTestId("settings-theme").getByText("Scuro").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    // Export: counts first, download only after verification.
    const backup = page.getByTestId("backup-section");
    await expect(backup.getByTestId("backup-inventory")).toContainText(
      "record da esportare",
    );
    await backup.getByTestId("backup-create").click();
    await expect(backup.getByTestId("backup-ready")).toContainText(
      "hrt-backup-",
    );
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      backup.getByTestId("backup-download").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^hrt-backup-\d{8}-\d{4}Z\.json$/,
    );
    const path = await download.path();
    const text = await readFile(path, "utf8");
    expect(text.startsWith('{"format":"ham-radio-toolbox-backup"')).toBe(true);
    expect(text).toContain('"IZ1ABC"');

    // The backup is not in any cache of the service worker.
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) {
          urls.push(request.url);
        }
      }
      return urls;
    });
    expect(
      cached.filter(
        (url) => /backup|blob:/.test(url) && !/\/assets\//.test(url),
      ),
    ).toEqual([]);

    // Local changes after the backup.
    await createProfile(page, { name: "Portatile", callsign: "iz1abc/p" });
    await page.getByTestId("settings-theme").getByText("Chiaro").click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);

    // Restore: analysis, contents, preview, confirmation.
    const restore = page.getByTestId("restore-section");
    await restore.getByTestId("restore-file").setInputFiles({
      name: download.suggestedFilename(),
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
    await expect(restore.getByTestId("restore-summary")).toContainText(
      download.suggestedFilename(),
    );
    await expect(restore.getByTestId("restore-schema-version")).toHaveText("1");
    await restore.getByTestId("restore-preview").click();
    const effects = restore.getByTestId("restore-effects");
    const profiles = effects.locator('[data-table="station_profiles"]');
    await expect(profiles.locator('[data-effect="deleted"]')).toHaveText("2");
    await expect(profiles.locator('[data-effect="inserted"]')).toHaveText("1");

    await restore.getByTestId("restore-confirm").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Confermi il ripristino?");
    await expect(dialog.getByTestId("restore-commit")).toBeDisabled();
    await dialog
      .getByTestId("restore-acknowledge")
      .getByRole("checkbox")
      .check();
    await dialog.getByTestId("restore-commit").click();
    await expect(restore.getByTestId("restore-done")).toBeVisible();

    // The app shows the restored state without a reload.
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(profileItem(page, "Portatile")).toHaveCount(0);
    await expect(
      profileItem(page, "Casa").getByTestId("profile-default"),
    ).toBeVisible();
    await page.reload();
    await expect(profileItem(page, "Portatile")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a damaged file is refused and nothing changes", async ({ page }) => {
    await openSettings(page);
    await createProfile(page, { name: "Casa", callsign: "iz1abc" });
    await page.getByTestId("backup-create").click();
    await expect(page.getByTestId("backup-ready")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("backup-download").click(),
    ]);
    const text = await readFile(await download.path(), "utf8");
    const tampered = text.replace('"IZ1ABC"', '"IZ9ABC"');
    await page.getByTestId("restore-file").setInputFiles({
      name: "manomesso.json",
      mimeType: "application/json",
      buffer: Buffer.from(tampered),
    });
    await expect(page.getByTestId("restore-error")).toContainText(
      "Le impronte SHA-256 non corrispondono",
    );
    await expect(page.getByTestId("restore-error")).toContainText(
      "Nessun dato sul dispositivo è stato modificato.",
    );
    await expect(profileItem(page, "Casa")).toContainText("IZ1ABC");
  });
});

test.describe("two tabs", () => {
  test("a favourite pinned in one tab appears in the other", async ({
    context,
  }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    for (const page of [first, second]) {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto("/");
      await expect(page.getByTestId("dashboard")).toBeVisible();
    }
    await first
      .locator(
        '[data-area] [data-module="satellite-explorer"] [data-testid="favorite-toggle"]',
      )
      .click();
    await expect(
      second
        .getByTestId("favorites")
        .locator('[data-module="satellite-explorer"]'),
    ).toBeVisible();
  });

  test("an upgrade from another tab closes this tab's database and asks for a reload", async ({
    context,
  }) => {
    const app = await context.newPage();
    await app.goto("/settings-backup");
    await expect(app.getByTestId("settings")).toBeVisible();
    await createProfile(app, { name: "Casa", callsign: "iz1abc" });

    // Another tab opens a newer schema (IndexedDB version 20 = Dexie v2).
    const newer = await context.newPage();
    await newer.goto("/favicon.svg");
    await newer.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("ham-radio-toolbox", 20);
          request.onsuccess = () => {
            request.result.close();
            resolve();
          };
          request.onerror = () => reject(new Error(String(request.error)));
        }),
    );
    await expect(app.getByTestId("database-version-change")).toContainText(
      "Ricarica la pagina per continuare",
    );
    // A write after the close is refused, never lost silently.
    await app.getByTestId("profile-add").click();
    await app
      .getByTestId("profile-form")
      .getByLabel("Nome del profilo")
      .fill("Dopo");
    await app
      .getByTestId("profile-form")
      .getByLabel("Nominativo")
      .fill("iz2abc");
    await app.getByRole("button", { name: "Salva il profilo" }).click();
    await expect(app.getByTestId("profile-form")).toContainText(
      "La connessione all'archivio locale è stata chiusa",
    );
    await expect(
      app.getByTestId("profile-form").getByLabel("Nome del profilo"),
    ).toHaveValue("Dopo");

    // After the reload this version refuses the newer database.
    await app.reload();
    await expect(app.getByTestId("database-unavailable")).toContainText(
      "versione più recente dell'app",
    );
  });

  test("an upgrade blocked by an old tab waits and then completes", async ({
    context,
  }) => {
    const old = await context.newPage();
    await old.goto("/favicon.svg");
    // An old version holding the database open without handling versionchange.
    await old.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("ham-radio-toolbox", 5);
          request.onsuccess = () => {
            (window as unknown as { __old: IDBDatabase }).__old =
              request.result;
            resolve();
          };
          request.onerror = () => reject(new Error(String(request.error)));
        }),
    );
    const app = await context.newPage();
    await app.goto("/");
    await expect(app.getByTestId("dashboard")).toBeVisible();
    await expect(app.getByTestId("database-blocked")).toContainText(
      "Chiudi le altre schede",
    );
    await old.evaluate(() =>
      (window as unknown as { __old: IDBDatabase }).__old.close(),
    );
    await expect(app.getByTestId("database-blocked")).toHaveCount(0);
    await app
      .locator(
        '[data-area] [data-module="propagation"] [data-testid="favorite-toggle"]',
      )
      .click();
    await app.reload();
    await expect(
      app.getByTestId("favorites").getByTestId("module-card"),
    ).toHaveCount(1);
  });
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility of Settings (${scheme} theme)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("settings page with a profile and a backup ready", async ({
      page,
    }) => {
      await openSettings(page);
      await createProfile(page, { name: "Casa", callsign: "iz1abc" });
      await page.getByTestId("backup-create").click();
      await expect(page.getByTestId("backup-ready")).toBeVisible();
      await expect(page.getByTestId("storage-status")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test("profile dialog with validation errors", async ({ page }) => {
      await openSettings(page);
      await page.getByTestId("profile-add").click();
      await page.getByRole("button", { name: "Salva il profilo" }).click();
      await expect(page.getByTestId("profile-form")).toContainText(
        "Campo obbligatorio.",
      );
      expect(await audit(page)).toEqual([]);
    });
  });
}
