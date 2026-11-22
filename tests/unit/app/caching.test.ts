/**
 * The rules of the cache, checked on the source: "use cache" is a directive that only Next.js acts on, so
 * no test outside a running server can watch it work. What can be checked here is that no read of the
 * catalogue was left out, and that nothing is cached that must be fresh.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";

const QUERY_FILES = [
  "src/app/catalog/stats.ts",
  "src/app/map/queries.ts",
  "src/app/planets/queries.ts",
  "src/app/search/query.ts",
  "src/app/stars/queries.ts",
];

const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

/** The async functions of a file, each with the first statement of its body. */
function asyncFunctions(source: string): { name: string; exported: boolean; first: string }[] {
  const pattern = /^(export )?async function (\w+)\([^]*?\)(?::[^\n]*?)? \{\n\s*([^\n]*)/gm;
  return [...source.matchAll(pattern)].map((match) => ({ name: match[2], exported: Boolean(match[1]), first: match[3] }));
}

describe("the cache of the catalogue", () => {
  it.each(QUERY_FILES)("caches every query of %s", (file) => {
    const functions = asyncFunctions(read(file));
    expect(functions.length).toBeGreaterThan(0);
    for (const { name, first } of functions) {
      expect(first, `${name} in ${file}`).toBe('"use cache";');
    }
  });

  it("knows all the queries the site reads the catalogue with", () => {
    const names = QUERY_FILES.flatMap((file) => asyncFunctions(read(file)).map(({ name }) => name)).sort();
    expect(names).toEqual([
      "findPlanetSlugByAlias",
      "findStarSlugByAlias",
      "getCatalogStats",
      "getMapStars",
      "getMapSystem",
      "getPlanetChanges",
      "getPlanetFormerNames",
      "getPlanetsBySlug",
      "getPlanetsOfStar",
      "getStarFormerNames",
      "listPlanets",
      "readPlanet",
      "readStar",
      "search",
      "searchByType",
    ]);
  });

  it("keeps an answer for an hour and drops one nobody asked for in a day", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.cacheLife?.default).toEqual({ stale: 300, revalidate: 3600, expire: 86400 });
  });

  it("gives the JSON answers the same hour, in the browser and in the CDN", () => {
    expect(CATALOGUE_CACHE_CONTROL).toBe("public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    const [, browser, cdn] = /max-age=(\d+), s-maxage=(\d+)/.exec(CATALOGUE_CACHE_CONTROL) ?? [];
    expect(Number(browser)).toBe(nextConfig.cacheLife?.default?.revalidate);
    expect(Number(cdn)).toBe(nextConfig.cacheLife?.default?.revalidate);
  });

  it("never caches the health check, which has to ask the database itself", () => {
    const source = read("src/app/health/route.ts") + read("src/app/health/check.ts");
    expect(source).not.toContain("use cache");
    expect(source).toContain("no-store");
  });

  it("caches nothing that writes: the sync and the seed read the database as it is", () => {
    for (const file of ["src/app/sync/run.ts", "src/app/sync/plan.ts", "src/app/sync/nasa.ts", "src/app/solar-system/seed.ts"]) {
      expect(read(file), file).not.toContain("use cache");
    }
  });

  it.each(["src/app/catalog/CatalogStats.tsx", "src/app/catalog/FeaturedPlanets.tsx", "src/app/map/stars/route.ts"])(
    "keeps the query of %s out of the build, which has to work without a database",
    (file) => {
      // These read the catalogue without anything from the request, so only io() tells Next.js to wait for one.
      const source = read(file);
      const waits = source.indexOf("await io();");
      const reads = source.search(/await get\w+\(|\(await get\w+\(/);
      expect(waits, file).toBeGreaterThan(-1);
      expect(reads, file).toBeGreaterThan(waits);
    },
  );
});
