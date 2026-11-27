import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test against a running deployment.
 *
 *   SMOKE_BASE_URL=https://exofinder-abc123.vercel.app npm run test:smoke
 *
 * VERCEL_AUTOMATION_BYPASS_SECRET gets past Vercel's Deployment Protection, and
 * SMOKE_EXPECTED_SHA checks that the deployment runs that commit. See docs/DEPLOYMENT.md.
 */
const BASE_URL = process.env.SMOKE_BASE_URL?.replace(/\/+$/, "");
if (!BASE_URL) {
  throw new Error("Set SMOKE_BASE_URL to the address of the deployment to check.");
}
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/smoke",
  // A short network hiccup must not roll back a good deployment.
  retries: 2,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: BASE_URL,
    // An address without a language leads to the language of the browser, and the test reads English.
    locale: "en-US",
    colorScheme: "dark",
    trace: "retain-on-failure",
    extraHTTPHeaders: bypass
      ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
});
