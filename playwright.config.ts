import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./tests/support/db";

/**
 * Browser tests, run with `npm run test:e2e`. Playwright builds and serves the app on
 * port 3100 against the exofinder_e2e database, so docker-compose.yml must be running.
 * The browser comes from `npm run e2e:install`. E2E_SKIP_BUILD=1 reuses the last build.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Each browser renders WebGL in software, which takes a full CPU core.
  workers: CI ? 2 : 4,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  // Software WebGL makes pages with a 3D model slow, so assertions wait longer.
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "dark",
    launchOptions: {
      // Headless Chromium has no GPU, so SwiftShader renders WebGL in software.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    // Tests tagged @alone are left out here and run in "desktop-alone" below.
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@alone/ },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
      testMatch: /(navigation|search)\.spec\.ts/,
    },
    {
      // The post-deployment smoke test also runs against the local build, so it is known to work before it matters.
      name: "smoke",
      testDir: "tests/smoke",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // A test tagged @alone keeps a CI runner busy for over a minute when it renders in software. Next
      // to it, the other worker's browser could not even open a new page for a minute and its test timed
      // out. So these run after every other project has finished, with nothing beside them.
      name: "desktop-alone",
      use: { ...devices["Desktop Chrome"] },
      grep: /@alone/,
      dependencies: ["desktop", "phone", "smoke"],
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npm run start -- --port ${PORT}`
      : `npm run build && npm run start -- --port ${PORT}`,
    // Playwright asks this address until the server answers, while the test database is still being
    // seeded. The server keeps what it reads from the catalogue for an hour, so it must not be asked for
    // a page that reads it: the start page would keep the half-seeded numbers for the whole run.
    url: `${BASE_URL}/legal/notice`,
    reuseExistingServer: !CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: { DATABASE_URL: e2eDatabaseUrl() },
  },
});
