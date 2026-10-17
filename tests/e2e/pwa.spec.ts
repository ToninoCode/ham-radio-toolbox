import { expect, test } from "@playwright/test";
import { MODULE_PATHS, trackErrors, waitForServiceWorker } from "./support";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

test.describe("web app manifest", () => {
  test("is linked, valid and complete", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );

    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      id: "/",
      name: "Ham Radio Toolbox",
      short_name: "Ham Toolbox",
      description: "Cassetta degli attrezzi per radioamatori e SWL",
      lang: "it",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      theme_color: "#0b1120",
      background_color: "#0b1120",
    });
    const purposes = (manifest.icons as ManifestIcon[]).map(
      (icon) => `${icon.sizes} ${icon.purpose}`,
    );
    expect(purposes).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  test("every icon exists with the declared size and type", async ({
    request,
  }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const icons = [
      ...(manifest.icons as ManifestIcon[]),
      {
        src: "/icons/apple-touch-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ];
    for (const icon of icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()["content-type"]).toBe(icon.type);
      const body = await response.body();
      const size = `${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`;
      expect(size, icon.src).toBe(icon.sizes);
    }
  });

  test("Chrome reports no manifest or installability errors", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP is Chromium-only");
    await page.goto("/");
    await waitForServiceWorker(page);

    const cdp = await page.context().newCDPSession(page);
    const manifest = await cdp.send("Page.getAppManifest");
    expect(manifest.errors).toEqual([]);
    const { installabilityErrors } = await cdp.send(
      "Page.getInstallabilityErrors",
    );
    expect(installabilityErrors).toEqual([]);
  });
});

test.describe("service worker", () => {
  test("registers for the whole app and controls the page", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    const scriptURL = await waitForServiceWorker(page);
    expect(new URL(scriptURL).pathname).toBe("/sw.js");
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope,
    );
    expect(new URL(scope).pathname).toBe("/");
    await expect(page.getByTestId("pwa-offline-ready")).toContainText(
      "App pronta per l'uso offline.",
    );
    await expect(page.getByTestId("pwa-error")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("precaches only same-origin build assets", async ({ page }) => {
    await page.goto("/");
    await waitForServiceWorker(page);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((request) => request.url));
      }
      return urls;
    });
    expect(cached.length).toBeGreaterThan(10);
    for (const url of cached) {
      expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    }
    expect(cached.some((url) => /\/assets\/DashboardView-/.test(url))).toBe(
      true,
    );
    expect(
      cached.some((url) => /\/assets\/UnderDevelopmentView-/.test(url)),
    ).toBe(true);
  });
});

test.describe("offline", () => {
  test("after the first visit the whole app works without network", async ({
    page,
    context,
  }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await waitForServiceWorker(page);
    await context.setOffline(true);

    // Dashboard from a cold reload.
    await page.reload();
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("connection-status")).toHaveText(/Offline/);

    // Direct access to every lazy route, never visited online.
    for (const [id, path] of Object.entries(MODULE_PATHS)) {
      if (id === "dashboard") continue;
      await page.goto(path);
      await expect(page.getByTestId("under-development"), path).toBeVisible();
    }

    // Reload of an internal route and in-app navigation.
    await page.goto("/propagation");
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Propagazione" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Torna alla dashboard" }).click();
    await expect(page.getByTestId("dashboard")).toBeVisible();

    // Unknown routes still reach the app's 404 page.
    await page.goto("/offline/missing");
    await expect(page.getByTestId("not-found")).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe("offline-ready notice on small screens", () => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 640, height: 360 },
  ]) {
    test(`does not cover any control at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await waitForServiceWorker(page);
      const notice = page.getByTestId("pwa-offline-ready");
      await expect(notice).toBeVisible();

      // In the page flow, not an overlay.
      expect(
        await notice.evaluate((el) => {
          for (let node: Element | null = el; node; node = node.parentElement) {
            const position = getComputedStyle(node).position;
            if (position === "fixed" || position === "absolute")
              return position;
          }
          return "static";
        }),
      ).toBe("static");

      // No visible control is hidden by the notice, wherever the page is scrolled.
      for (const scroll of ["top", "bottom"] as const) {
        await page.evaluate((to) => {
          window.scrollTo(0, to === "top" ? 0 : document.body.scrollHeight);
        }, scroll);
        const covered = await page.evaluate(() => {
          const notice = document.querySelector(
            '[data-testid="pwa-offline-ready"]',
          );
          const controls = document.querySelectorAll<HTMLElement>(
            "#main-content a, #main-content button, #main-content label, [data-testid=bottom-nav] a, [data-testid=bottom-nav] button",
          );
          const hits: string[] = [];
          for (const control of controls) {
            if (notice?.contains(control)) continue;
            const box = control.getBoundingClientRect();
            if (box.width < 4 || box.height < 4) continue;
            const x = box.left + box.width / 2;
            const y = box.top + box.height / 2;
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const top = document.elementFromPoint(x, y);
            if (top && notice?.contains(top)) {
              hits.push(
                control.textContent?.trim() || control.outerHTML.slice(0, 60),
              );
            }
          }
          return hits;
        });
        expect(covered, `controls covered (${scroll})`).toEqual([]);
      }

      // Dashboard controls stay usable while the notice is shown.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page
        .getByRole("button", { name: "Aggiungi Logbook HAM ai preferiti" })
        .click();
      await expect(
        page.getByTestId("favorites").locator('[data-module="ham-logbook"]'),
      ).toBeVisible();
    });
  }
});
