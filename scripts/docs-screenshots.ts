/**
 * Takes the user-guide screenshots in docs/wiki/images from a running app.
 * Run it again after changing the interface.
 *
 *   npm run docs:screenshots [-- <shot names>]
 *
 * It reads BASE_URL (default http://localhost:3000) and needs the browser from
 * `npx playwright install chromium --only-shell`.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "docs", "wiki", "images");
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/** Hides the Next.js dev badge from screenshots. */
const HIDE_DEV_TOOLS = "nextjs-portal { display: none !important; }";

interface Shot {
  name: string;
  phone?: boolean;
  run: (page: Page) => Promise<void>;
}

async function open(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE_DEV_TOOLS });
}

async function save(page: Page, name: string, target?: ReturnType<Page["locator"]>) {
  const path = join(OUT_DIR, `${name}.png`);
  if (target) await target.screenshot({ path });
  else await page.screenshot({ path });
  console.log(`  ${name}.png`);
}

/** Saves an element with a margin around it. */
async function saveArea(page: Page, name: string, target: ReturnType<Page["locator"]>, margin = 16) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`${name}: the part of the page is missing.`);
  await page.screenshot({
    path: join(OUT_DIR, `${name}.png`),
    clip: { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin },
  });
  console.log(`  ${name}.png`);
}

/** Waits until the planet's 3D model has rendered (its controls appear only then). */
async function waitForGlobe(page: Page) {
  await page.getByRole("button", { name: "Reset" }).waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(800);
}

/** Waits until the map has loaded and the camera has settled. */
async function waitForMap(page: Page, settle = 4000) {
  await page.getByText("Loading the stars…").waitFor({ state: "hidden", timeout: 60_000 });
  await page.waitForTimeout(settle);
}

const SHOTS: Shot[] = [
  {
    name: "home",
    run: async (page) => {
      await open(page, "/");
      await page.getByRole("heading", { name: "Places to start" }).waitFor();
      await save(page, "home");
    },
  },
  {
    name: "header",
    run: async (page) => {
      await open(page, "/");
      await save(page, "header", page.locator("header").first());
    },
  },
  {
    name: "home-phone",
    phone: true,
    run: async (page) => {
      await open(page, "/");
      await page.getByRole("heading", { name: "Places to start" }).waitFor();
      await save(page, "home-phone");
    },
  },
  {
    name: "search-suggestions",
    run: async (page) => {
      await open(page, "/");
      const field = page.locator("[data-hero-search] input[type=search]");
      await field.click();
      await field.pressSequentially("trappist", { delay: 40 });
      await page.locator("[data-hero-search] [role=listbox]").waitFor({ state: "visible" });
      await page.waitForTimeout(300);
      const box = await page.locator("[data-hero-search]").boundingBox();
      const list = await page.locator("[data-hero-search] [role=listbox]").boundingBox();
      if (!box || !list) throw new Error("The search field is not on the page.");
      await page.screenshot({
        path: join(OUT_DIR, "search-suggestions.png"),
        clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: list.y + list.height - box.y + 48 },
      });
      console.log("  search-suggestions.png");
    },
  },
  {
    name: "search-results",
    run: async (page) => {
      await open(page, "/search?q=kepler-22");
      await page.getByText(/match/).first().waitFor();
      await save(page, "search-results");
    },
  },
  {
    name: "planet-list",
    run: async (page) => {
      await open(page, "/planets");
      await page.getByRole("navigation", { name: "Sort order" }).waitFor();
      await save(page, "planet-list");
    },
  },
  {
    name: "planet-list-filtered",
    run: async (page) => {
      await open(page, "/planets?q=trappist&sort=discovery");
      await page.getByText(/match “trappist”/).waitFor();
      await save(page, "planet-list-filtered");
    },
  },
  {
    name: "planet-page",
    run: async (page) => {
      await open(page, "/planets/trappist-1-e");
      await waitForGlobe(page);
      await save(page, "planet-page");
    },
  },
  {
    name: "planet-model",
    run: async (page) => {
      await open(page, "/planets/jupiter");
      await waitForGlobe(page);
      const model = page.locator("article header > div").first();
      await save(page, "planet-model", model);
    },
  },
  {
    name: "planet-facts",
    run: async (page) => {
      await open(page, "/planets/trappist-1-e");
      await page.getByRole("heading", { name: "Planet", exact: true }).waitFor();
      await saveArea(page, "planet-facts", page.locator("section", { has: page.getByRole("heading", { name: "Planet", exact: true }) }));
    },
  },
  {
    name: "planet-orbit-discovery",
    run: async (page) => {
      await open(page, "/planets/trappist-1-e");
      const orbit = page.locator("section", { has: page.getByRole("heading", { name: "Orbit", exact: true }) });
      const discovery = page.locator("section", { has: page.getByRole("heading", { name: "Discovery", exact: true }) });
      await orbit.waitFor();
      await orbit.scrollIntoViewIfNeeded();
      const a = await orbit.boundingBox();
      const b = await discovery.boundingBox();
      if (!a || !b) throw new Error("Orbit or discovery section is missing.");
      await page.screenshot({
        path: join(OUT_DIR, "planet-orbit-discovery.png"),
        clip: { x: a.x - 16, y: a.y - 16, width: a.width + 32, height: b.y + b.height - a.y + 32 },
      });
      console.log("  planet-orbit-discovery.png");
    },
  },
  {
    name: "planet-host-star",
    run: async (page) => {
      await open(page, "/planets/trappist-1-e");
      await saveArea(page, "planet-host-star", page.locator("section", { has: page.getByRole("heading", { name: /^Host star/ }) }));
    },
  },
  {
    name: "star-page",
    run: async (page) => {
      await open(page, "/stars/trappist-1");
      await page.getByRole("heading", { name: "TRAPPIST-1", exact: true }).waitFor();
      await save(page, "star-page");
    },
  },
  {
    name: "sun-page",
    run: async (page) => {
      await open(page, "/stars/sun");
      await page.getByRole("heading", { name: "Planets", exact: true }).waitFor();
      await save(page, "sun-page");
    },
  },
  {
    name: "map-galaxy",
    run: async (page) => {
      await open(page, "/map?view=galaxy");
      await waitForMap(page, 6000);
      await save(page, "map-galaxy");
    },
  },
  {
    name: "map-sun",
    run: async (page) => {
      await open(page, "/map");
      await waitForMap(page);
      await save(page, "map-sun");
    },
  },
  {
    name: "map-find-star",
    run: async (page) => {
      await open(page, "/map");
      await waitForMap(page, 1500);
      const field = page.getByPlaceholder("Find a star on the map");
      await field.click();
      await field.pressSequentially("trappist", { delay: 40 });
      await page.waitForTimeout(600);
      await save(page, "map-find-star");
    },
  },
  {
    name: "map-star-selected",
    run: async (page) => {
      await open(page, "/map?star=trappist-1");
      await waitForMap(page, 6000);
      await save(page, "map-star-selected");
    },
  },
  {
    name: "map-system",
    run: async (page) => {
      await open(page, "/map?system=trappist-1");
      await waitForMap(page, 3000);
      await page.getByRole("button", { name: "Galaxy", exact: true }).waitFor({ timeout: 60_000 });
      await page.waitForTimeout(5000);
      await save(page, "map-system");
    },
  },
  {
    name: "map-solar-system",
    run: async (page) => {
      await open(page, "/map?system=sun&planet=earth");
      await waitForMap(page, 3000);
      await page.getByRole("button", { name: "Galaxy", exact: true }).waitFor({ timeout: 60_000 });
      await page.waitForTimeout(5000);
      await save(page, "map-solar-system");
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // Headless Chromium has no GPU, so SwiftShader renders WebGL in software.
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const only = process.argv.slice(2);
  let failed = 0;
  console.log(`Screenshots of ${BASE_URL} into ${OUT_DIR}`);
  try {
    for (const shot of SHOTS) {
      if (only.length > 0 && !only.includes(shot.name)) continue;
      const context = await browser.newContext({
        viewport: shot.phone ? PHONE : DESKTOP,
        deviceScaleFactor: shot.phone ? 2 : 1,
        colorScheme: "dark",
        reducedMotion: "no-preference",
        // The guide is written in English, and an address without a language leads to the browser's.
        locale: "en-US",
      });
      const page = await context.newPage();
      try {
        await shot.run(page);
      } catch (error) {
        failed++;
        console.error(`  ${shot.name} failed:`, error instanceof Error ? error.message : error);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failed > 0) {
    console.error(`${failed} screenshot(s) failed.`);
    process.exitCode = 1;
  }
}

void main();
