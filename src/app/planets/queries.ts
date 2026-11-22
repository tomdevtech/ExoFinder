import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { planetAliases, planetChanges, planets, stars, type Planet } from "@/db/schema";
import { clampPage } from "@/shared/paging";
import { isSlug, MAX_QUERY_LENGTH, searchKey } from "@/shared/slug";
import type { ClimateClass, PlanetClass } from "./classify";
import { PAGE_SIZE, type ListSort } from "./paging";
import { NO_FILTER, type TypeFilter } from "./typeFilter";

/**
 * SQL expression for the density relative to Earth, set only where NASA measured both mass and radius,
 * because a density derived from the radius alone says nothing about composition. `table` is the alias
 * of the planets table in the query.
 */
export function measuredDensity(table: SQL = sql`${planets}`): SQL<number | null> {
  return sql<number | null>`case
    when ${table}.mass_earth > 0 and ${table}.radius_earth > 0
      and not ${table}.mass_calculated and not ${table}.mass_is_minimum and not ${table}.radius_calculated
    then ${table}.mass_earth / power(${table}.radius_earth, 3)
  end`;
}

/*
 * Every function below that reads the catalogue is cached ("use cache"). The catalogue changes once a
 * day, so an answer may be up to an hour old (`cacheLife` in next.config.ts). Their arguments are the
 * cache key, so they take plain values only.
 */

/** The columns a list entry and its thumbnail need. */
export const planetSummaryColumns = {
  slug: planets.slug,
  name: planets.name,
  source: planets.source,
  status: planets.status,
  planetClass: planets.planetClass,
  climateClass: planets.climateClass,
  radiusEarth: planets.radiusEarth,
  eqTempK: planets.eqTempK,
  densityEarth: measuredDensity(),
  orbitalPeriodDays: planets.orbitalPeriodDays,
  starName: stars.name,
  starTeffK: stars.teffK,
};

/** The columns of `planetSummaryColumns` for a query written as SQL, each under the name of its field. */
export function planetSummarySql(): SQL {
  return sql.join(
    Object.entries(planetSummaryColumns).map(([field, column]) => sql`${column} as ${sql.identifier(field)}`),
    sql`, `,
  );
}

/** The condition that keeps the planets of a kind, or nothing when both parts of the filter are open. */
export function ofType(type: TypeFilter): SQL | undefined {
  return and(
    type.planetClass ? eq(planets.planetClass, type.planetClass) : undefined,
    type.climateClass ? eq(planets.climateClass, type.climateClass) : undefined,
  );
}

export interface PlanetSummary {
  slug: string;
  name: string;
  source: Planet["source"];
  status: Planet["status"];
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
  radiusEarth: number | null;
  eqTempK: number | null;
  /** Relative to Earth, and only set when mass and radius were both measured. */
  densityEarth: number | null;
  orbitalPeriodDays: number | null;
  starName: string;
  starTeffK: number | null;
}

async function readPlanet(slug: string) {
  "use cache";
  if (!isSlug(slug)) return null;
  const [row] = await getDb()
    .select({ planet: planets, star: stars, densityEarth: measuredDensity() })
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(eq(planets.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * Returns a planet with its star, or null. The page metadata and the page body ask for it at the same
 * moment of one request, before either answer is in the cache, so React's `cache` makes them share one read.
 */
export const getPlanet = cache(readPlanet);

/** Returns the current slug of a planet that used to be reachable under `slug`. */
export async function findPlanetSlugByAlias(slug: string): Promise<string | null> {
  "use cache";
  if (!isSlug(slug)) return null;
  const [row] = await getDb()
    .select({ slug: planets.slug })
    .from(planetAliases)
    .innerJoin(planets, eq(planets.id, planetAliases.planetId))
    .where(eq(planetAliases.slug, slug))
    .limit(1);
  return row?.slug ?? null;
}

/** Returns all planets of a star from the inside out, including removed ones. */
export async function getPlanetsOfStar(starId: number): Promise<PlanetSummary[]> {
  "use cache";
  return getDb()
    .select(planetSummaryColumns)
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(eq(planets.starId, starId))
    .orderBy(asc(planets.orbitalPeriodDays), asc(planets.semiMajorAxisAu), asc(planets.name));
}

/** Returns planets in the order of `slugs`. Slugs that do not exist are skipped. */
export async function getPlanetsBySlug(slugs: string[]): Promise<PlanetSummary[]> {
  "use cache";
  if (slugs.length === 0) return [];
  const rows = await getDb()
    .select(planetSummaryColumns)
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(inArray(planets.slug, slugs));
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
}

/** A row of the planet list: the summary plus the discovery year the list can sort by. */
export interface PlanetListEntry extends PlanetSummary {
  /** Null for the six planets that were known before anybody kept records. */
  discoveryYear: number | null;
}

export interface PlanetListPage {
  planets: PlanetListEntry[];
  /** Number of planets matching the filter across all pages. */
  total: number;
  /** The page actually read. It differs from the requested page when that page does not exist. */
  page: number;
}

/**
 * Returns one page of the active planets.
 *
 * `sort` orders by name or by discovery year, newest first. The catalogue records only the year, so planets
 * of the same year are ordered by name, and planets without a year come last.
 *
 * `filter` matches the planet or star name. It is reduced to the `search_name` form, so "kepler 22" and
 * "Kepler-22" find the same planets. `type` keeps the planets of one class, one climate, or both.
 */
export async function listPlanets(
  filter: string,
  page: number,
  sort: ListSort = "name",
  type: TypeFilter = NO_FILTER,
): Promise<PlanetListPage> {
  "use cache";
  const trimmed = filter.trim().slice(0, MAX_QUERY_LENGTH);
  const key = searchKey(trimmed);
  // A filter without a single letter or digit, like "?", matches no name.
  if (trimmed !== "" && key === "") return { planets: [], total: 0, page: 1 };

  const db = getDb();
  // `and` skips the conditions that are undefined, which are those the filters leave open.
  const where = and(
    eq(planets.status, "active"),
    // The key holds only a-z and 0-9, so it needs no escaping for LIKE.
    key === "" ? undefined : or(like(planets.searchName, `%${key}%`), like(stars.searchName, `%${key}%`)),
    ofType(type),
  );

  const [{ total }] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(where);

  // Digits sort as numbers: "Kepler-9 b" before "Kepler-10 b" (drizzle/0002_natural_order.sql).
  const byName = [sql`${planets.name} collate "natural_name"`, asc(planets.id)];
  const current = clampPage(page, total, PAGE_SIZE);
  const rows = await db
    .select({ ...planetSummaryColumns, discoveryYear: planets.discoveryYear })
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(where)
    .orderBy(
      ...(sort === "discovery"
        ? [sql`${planets.discoveryYear} desc nulls last`, ...byName]
        : byName),
    )
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);

  return { planets: rows, total, page: current };
}

/** Returns the former names of a planet, oldest first. */
export async function getPlanetFormerNames(planetId: number): Promise<string[]> {
  "use cache";
  const rows = await getDb()
    .select({ name: planetAliases.name })
    .from(planetAliases)
    .where(eq(planetAliases.planetId, planetId))
    .orderBy(asc(planetAliases.createdAt));
  return rows.map((row) => row.name);
}

/** One recorded change of a planet value. */
export type PlanetChange = Awaited<ReturnType<typeof getPlanetChanges>>[number];

/** The latest recorded changes of a planet, newest first. */
export async function getPlanetChanges(planetId: number, limit = 30) {
  "use cache";
  return getDb()
    .select({
      id: planetChanges.id,
      field: planetChanges.field,
      oldValue: planetChanges.oldValue,
      newValue: planetChanges.newValue,
      changedAt: planetChanges.changedAt,
    })
    .from(planetChanges)
    .where(eq(planetChanges.planetId, planetId))
    .orderBy(desc(planetChanges.changedAt), desc(planetChanges.id))
    .limit(limit);
}
