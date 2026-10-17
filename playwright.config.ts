import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
const PAGES_PORT = 8788;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * PAGES_URL points the `cloudflare-pages` project at a real deployment
 * (post-deploy smoke test, `npm run test:deployment`). In that mode no local
 * server is started and only that project runs.
 */
const pagesUrl = process.env.PAGES_URL;

/**
 * Test projects:
 * - desktop-chromium / android-tablet: the app on the production build served
 *   by `vite preview` (service worker, offline, update flow).
 * - cloudflare-pages: hosting behaviour (public/_headers, SPA fallback, CSP)
 *   on `wrangler pages dev`, the official Pages emulator, or on PAGES_URL.
 *
 * In CI the build is produced once by a previous step; locally `npm run
 * build` runs first (web servers start in order).
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    locale: "it-IT",
    timezoneId: "UTC",
    trace: "on-first-retry",
  },
  projects: [
    ...(pagesUrl
      ? []
      : [
          {
            name: "desktop-chromium",
            testDir: "./tests/e2e",
            use: { ...devices["Desktop Chrome"], baseURL: PREVIEW_URL },
          },
          {
            name: "android-tablet",
            testDir: "./tests/e2e",
            use: { ...devices["Galaxy Tab S4"], baseURL: PREVIEW_URL },
          },
        ]),
    {
      name: "cloudflare-pages",
      testDir: "./tests/cloudflare",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: pagesUrl ?? `http://127.0.0.1:${PAGES_PORT}`,
      },
    },
  ],
  webServer: pagesUrl
    ? undefined
    : [
        {
          command: isCI
            ? `npm run preview -- --port ${PREVIEW_PORT} --strictPort`
            : `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
          url: PREVIEW_URL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
        {
          command: `npm run preview:pages -- --port ${PAGES_PORT}`,
          url: `http://127.0.0.1:${PAGES_PORT}`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      ],
});
