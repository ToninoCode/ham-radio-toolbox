import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Hosting behaviour on Cloudflare Pages (ADR-0011, BL-M1-13): headers from
 * public/_headers, SPA fallback for history-mode routes, CSP compatible with
 * the PWA. Runs on `wrangler pages dev` locally and in CI, and on the real
 * deployment with PAGES_URL (post-deploy smoke test). `vite preview` does not
 * apply _headers, so these checks cannot run there.
 */

const EXPECTED_CSP: Readonly<Record<string, string>> = {
  "default-src": "'self'",
  "script-src": "'self'",
  "style-src": "'self'",
  "img-src": "'self' data: blob:",
  "font-src": "'self'",
  "connect-src": "'self'",
  "media-src": "'self' blob:",
  "worker-src": "'self'",
  "manifest-src": "'self'",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
};

function parseCsp(header: string | undefined): Record<string, string> {
  const directives: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives[name] = values.join(" ");
  }
  return directives;
}

function expectSecurityHeaders(response: APIResponse, label: string) {
  const headers = response.headers();
  const csp = headers["content-security-policy"];
  expect(parseCsp(csp), `${label}: CSP`).toEqual(EXPECTED_CSP);
  expect(csp, label).not.toMatch(/unsafe-(inline|eval)/);
  expect(headers["x-content-type-options"], label).toBe("nosniff");
  expect(headers["x-frame-options"], label).toBe("DENY");
  expect(headers["referrer-policy"], label).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(headers["cross-origin-opener-policy"], label).toBe("same-origin");
  const permissions = headers["permissions-policy"] ?? "";
  for (const feature of [
    "camera",
    "microphone",
    "geolocation",
    "usb",
    "serial",
  ]) {
    expect(permissions, `${label}: ${feature}`).toContain(`${feature}=()`);
  }
}

async function mainScriptPath(
  request: import("@playwright/test").APIRequestContext,
) {
  const html = await (await request.get("/")).text();
  const match = html.match(/<script type="module" crossorigin src="([^"]+)"/);
  expect(match, "module script in index.html").not.toBeNull();
  return match![1]!;
}

test.describe("HTTP headers", () => {
  test("security headers on pages, assets, manifest and service worker", async ({
    request,
  }) => {
    const paths = ["/", "/ham-logbook", "/sw.js", "/manifest.webmanifest"];
    paths.push(await mainScriptPath(request));
    for (const path of paths) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expectSecurityHeaders(response, path);
    }
  });

  test("cache: service worker revalidated, hashed assets immutable", async ({
    request,
  }) => {
    const sw = await request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toBe("no-cache");
    expect(sw.headers()["content-type"]).toMatch(/javascript/);

    const asset = await request.get(await mainScriptPath(request));
    expect(asset.headers()["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );

    for (const path of ["/", "/ham-logbook", "/manifest.webmanifest"]) {
      const cacheControl = (await request.get(path)).headers()["cache-control"];
      expect(cacheControl, path).not.toContain("immutable");
      expect(cacheControl, path).toMatch(/max-age=0|no-cache/);
    }
  });
});

test.describe("SPA routing (history mode)", () => {
  test("deep links are served by the SPA fallback", async ({ request }) => {
    const index = await (await request.get("/")).text();
    expect(index).toContain('<div id="app">');

    for (const path of [
      "/ham-logbook",
      "/ham-logbook/123",
      "/propagation?from=link",
      "/a/b/c/does-not-exist",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toMatch(/text\/html/);
      expect(await response.text(), path).toBe(index);
    }
  });

  test("the output has no top-level 404.html (it would disable the fallback)", async ({
    request,
  }) => {
    const index = await (await request.get("/")).text();
    const response = await request.get("/404.html");
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(index);
  });

  test("a route opened directly renders the app", async ({ page }) => {
    await page.goto("/satellite-explorer");
    await expect(
      page.getByRole("heading", { level: 1, name: "Satellite Explorer" }),
    ).toBeVisible();
    await expect(page.getByTestId("under-development")).toBeVisible();
  });
});

test.describe("the app under the production CSP", () => {
  test("runs without CSP violations, registers the service worker and is installable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations =
        violations;
      document.addEventListener("securitypolicyviolation", (event) => {
        violations.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/");
    await expect(page.getByTestId("dashboard")).toBeVisible();

    // Service worker allowed by worker-src, manifest by manifest-src.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const cdp = await page.context().newCDPSession(page);
    expect((await cdp.send("Page.getAppManifest")).errors).toEqual([]);
    expect(
      (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
    ).toEqual([]);

    // Theme switch (CSSOM style changes) and lazy routes under the CSP.
    await page.getByTestId("app-header").getByTitle("Scuro").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page
      .getByTestId("sidebar")
      .locator('a[data-module="rf-calculators"]')
      .click();
    await expect(page.getByTestId("under-development")).toBeVisible();

    const violations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("Settings: backup, download and restore preview without CSP violations", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations =
        violations;
      document.addEventListener("securitypolicyviolation", (event) => {
        violations.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/settings-backup");
    await expect(page.getByTestId("settings")).toBeVisible();
    await page.getByTestId("backup-create").click();
    await expect(page.getByTestId("backup-ready")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("backup-download").click(),
    ]);
    await page.getByTestId("restore-file").setInputFiles(await download.path());
    await expect(page.getByTestId("restore-summary")).toBeVisible();
    await page.getByTestId("restore-preview").click();
    await expect(page.getByTestId("restore-effects")).toBeVisible();

    const violations = await page.evaluate(
      () =>
        (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("serves the expected build", async ({ page }) => {
    const expected = process.env["EXPECTED_BUILD_ID"];
    test.skip(!expected, "EXPECTED_BUILD_ID not set (local run)");
    await page.goto("/");
    await expect(page.locator('meta[name="build-id"]')).toHaveAttribute(
      "content",
      expected!,
    );
  });
});
