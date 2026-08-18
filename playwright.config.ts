/**
 * playwright.config.ts
 *
 * Configuration for the smoke test in tests/smoke.spec.ts.
 *
 * The test runs against the PRODUCTION build, not the dev server. That is
 * deliberate: the single most annoying class of bug in a Cesium project is one
 * that only appears after `npm run build`, because a static asset that the dev
 * server served happily is missing from the built output. Testing the dev
 * server would never catch it.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",

  // A globe takes a moment to load tiles, so these are more generous than the
  // Playwright defaults.
  timeout: 90_000,
  expect: { timeout: 20_000 },

  // Fail the build if someone commits a test.only by accident.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  // Screenshots and traces land here. The CI workflow uploads this directory.
  outputDir: "./test-results",

  use: {
    baseURL: BASE_URL,
    // Keep a trace of the first retry, which makes CI failures debuggable.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A fixed window size keeps the pixel assertions predictable.
        viewport: { width: 1280, height: 800 },
      },
    },
  ],

  /**
   * Build the site, then serve it, before the tests run.
   *
   * `reuseExistingServer` means that if you already have `npm run preview`
   * running in another terminal, Playwright uses it rather than failing on a
   * port clash.
   */
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
