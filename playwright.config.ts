import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against the production build served by `vite preview`, so the
 * service worker and the offline behaviour (M1 Block C) are exercised as they
 * will be on Cloudflare Pages. In CI the build is produced by a previous step.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "it-IT",
    timezoneId: "UTC",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-tablet",
      use: { ...devices["Galaxy Tab S4"] },
    },
  ],
  webServer: {
    command: isCI
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
