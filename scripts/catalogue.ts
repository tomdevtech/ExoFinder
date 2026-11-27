/**
 * Builds the printed catalogue as a PDF: every body on a page of its own, with the picture the site draws
 * of it and the values of its page.
 *
 *   npm run catalogue -- [--force] [--gpu] [--limit <exoplanets>] [--out <file.pdf>] [--size <pixels>] [--quality <1-100>]
 *
 * It holds the solar system and every exoplanet; `--limit` takes only the nearest ones, to try something out
 * quickly. Nothing is made twice: the pictures are kept in .cache/catalogue/pictures, so a run only draws
 * the bodies that are new or look different, and when no page has changed since the last run, no file is
 * written at all, unless `--force` asks for it. `--gpu` draws with the graphics card (Windows), which is
 * many times faster than the software renderer every machine has. It reads
 * DATABASE_URL and needs the browser from `npx playwright install chromium --only-shell`. Where qpdf is
 * installed, the file is packed with it at the end, which makes it smaller and quicker to open on the web.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOGUE } from "@/app/catalog/editions";
import { closeDb } from "@/db/client";
import { exoplanetEntries, readExoplanets, readSolarSystem, solarEntries, type CatalogueEntry } from "./catalogue-entries";
import { catalogueStamp, writeCatalogue, type Edition } from "./catalogue-pdf";
import { PictureStudio } from "./catalogue-pictures";

const SITE = process.env.SITE_URL ?? "https://www.exofinder.space";
/**
 * A picture is printed 300 points wide, so 600 pixels are 144 to the inch, and twice what a screen shows of
 * it at full size. Measured on 150 exoplanets, this size and quality take 13 kB a picture where 720 pixels
 * at quality 84 took 22 kB, without a difference the eye finds at the printed size.
 */
const PICTURE_SIZE = 600;
const PICTURE_QUALITY = 76;
const FOLDER = path.join(".cache", "catalogue");
/** Holds the stamp of the last file that was built, next to the pictures, so that both are kept together. */
const STAMP = path.join(FOLDER, "built");

function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at < 0 ? undefined : process.argv[at + 1];
}

/**
 * Packs the file with qpdf where that is installed, and tells whether it did. PDFKit writes every page, link
 * and bookmark as an object of its own in plain text; qpdf gathers them in compressed streams, and orders
 * the file so that a browser can show the first page while the rest is still on its way.
 */
function pack(file: string): boolean {
  const packed = `${file}.packed`;
  try {
    execFileSync("qpdf", ["--object-streams=generate", "--recompress-flate", "--compression-level=9", "--linearize", file, packed], {
      stdio: "ignore",
    });
  } catch {
    rmSync(packed, { force: true });
    return false;
  }
  renameSync(packed, file);
  return true;
}

async function main() {
  const size = Number(option("size") ?? PICTURE_SIZE);
  const quality = Number(option("quality") ?? PICTURE_QUALITY);
  const limit = option("limit") === undefined ? undefined : Number(option("limit"));
  const out = option("out") ?? path.join(FOLDER, CATALOGUE.file);
  // Only the whole catalogue at its usual place is remembered; a trial with other options is always built.
  const remembered = option("out") === undefined && limit === undefined && option("size") === undefined && option("quality") === undefined;
  mkdirSync(path.dirname(out), { recursive: true });

  const { sun, rows } = await readSolarSystem();
  const entries: CatalogueEntry[] = solarEntries(sun, rows);
  entries.push(...exoplanetEntries(await readExoplanets(limit)));
  await closeDb();

  const studio = new PictureStudio({
    cacheDir: path.join(FOLDER, "pictures"),
    publicDir: "public",
    size,
    quality,
    gpu: process.argv.includes("--gpu"),
  });
  const pictures = new Map<CatalogueEntry, string>();
  const started = Date.now();
  try {
    console.log(`${entries.length} bodies`);
    for (const [index, entry] of entries.entries()) {
      pictures.set(entry, await studio.picture(entry.picture));
      if ((index + 1) % 500 === 0 || index + 1 === entries.length) {
        const seconds = Math.round((Date.now() - started) / 1000);
        console.log(`  ${index + 1} pictures, ${studio.drawn} of them new, after ${seconds} s`);
      }
    }
    // The browser only starts for a picture that has to be drawn, so a run that finds them all needs none.
    if (studio.drawn > 0) console.log(`  drawn with ${await studio.renderer()}`);
  } finally {
    await studio.close();
  }

  const edition: Edition = { title: CATALOGUE.title, claim: CATALOGUE.claim, site: SITE, date: new Date() };
  const stamp = catalogueStamp(edition, entries, pictures);
  if (remembered && !process.argv.includes("--force") && existsSync(STAMP) && readFileSync(STAMP, "utf8").trim() === stamp) {
    console.log("No page has changed since the last build, so no file is written. --force writes it anyway.");
    return;
  }

  const { pages } = await writeCatalogue(out, edition, entries, pictures);
  const megabytes = () => (statSync(out).size / 1e6).toFixed(1);
  const written = megabytes();
  console.log(`${out}: ${pages} pages, ${written} MB${pack(out) ? `, packed to ${megabytes()} MB` : ""}`);
  if (remembered) writeFileSync(STAMP, `${stamp}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
