/**
 * Renders many catalogue planets onto one sheet from a running app, so changes to
 * the planet look can be compared side by side.
 *
 *   npm run planets:sheet [-- <count> <out.png>]
 *
 * It reads BASE_URL (default http://localhost:3000) and DATABASE_URL, and needs
 * the browser from `npx playwright install chromium --only-shell`.
 */
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { chromium } from "playwright";
import sharp, { type OverlayOptions } from "sharp";
import { en } from "@/i18n/messages/en";
import { closeDb, getDb } from "@/db/client";
import { planets } from "@/db/schema";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const COUNT = Number(process.argv[2] ?? 48);
const OUT = process.argv[3] ?? join(process.cwd(), "planet-sheet.png");
/** Size of one planet tile in pixels and the height of its caption below it. */
const TILE = 260;
const CAPTION = 44;
const COLUMNS = 8;

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function main() {
  // Ordering by a hash of the slug gives a spread over the catalogue that stays the same between runs.
  const chosen = await getDb()
    .select({
      slug: planets.slug,
      name: planets.name,
      planetClass: planets.planetClass,
      climateClass: planets.climateClass,
    })
    .from(planets)
    .where(and(eq(planets.status, "active"), eq(planets.source, "nasa")))
    .orderBy(sql`md5(${planets.slug})`)
    .limit(COUNT);
  await closeDb();
  if (chosen.length === 0) throw new Error("The catalogue is empty. Run `npm run sync` first.");

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const tiles: OverlayOptions[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    console.log(`${chosen.length} planets of ${BASE_URL} onto ${OUT}`);
    for (const [index, planet] of chosen.entries()) {
      await page.goto(`${BASE_URL}/planets/${planet.slug}`);
      // The model's controls appear only once it has rendered.
      await page.getByRole("button", { name: "Reset" }).waitFor({ state: "visible", timeout: 60_000 });
      await page.waitForTimeout(600);
      const picture = await page.getByRole("group", { name: /^3D model of/ }).locator("canvas").screenshot();
      const left = (index % COLUMNS) * TILE;
      const top = Math.floor(index / COLUMNS) * (TILE + CAPTION);
      tiles.push({
        input: await sharp(picture).resize(TILE, TILE, { fit: "contain", background: "#05060a" }).toBuffer(),
        left,
        top,
      });
      const caption = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${CAPTION}">
        <text x="${TILE / 2}" y="16" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#e8eaf0">${escape(planet.name)}</text>
        <text x="${TILE / 2}" y="33" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8a90a0">${escape(en.classes.describe(planet.planetClass, planet.climateClass))}</text>
      </svg>`;
      tiles.push({ input: Buffer.from(caption), left, top: top + TILE });
      console.log(`  ${planet.name}`);
    }
  } finally {
    await browser.close();
  }

  const rows = Math.ceil(chosen.length / COLUMNS);
  await sharp({
    create: {
      width: Math.min(chosen.length, COLUMNS) * TILE,
      height: rows * (TILE + CAPTION),
      channels: 3,
      background: "#05060a",
    },
  })
    .composite(tiles)
    .png()
    .toFile(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
