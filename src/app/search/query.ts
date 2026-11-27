import { sql, type SQL } from "drizzle-orm";
import { ofType, planetSummaryColumns, planetSummarySql, type PlanetSummary } from "@/app/planets/queries";
import type { TypeFilter } from "@/app/planets/typeFilter";
import { SOLAR_BODIES, type SolarBody } from "@/app/solar-system/bodies";
import type { StarSummary } from "@/app/stars/summary";
import { getDb } from "@/db/client";
import { planets, stars } from "@/db/schema";
import type { Locale } from "@/i18n/locales";
import { messagesFor } from "@/i18n/messages";
import { clampPage } from "@/shared/paging";
import { MAX_QUERY_LENGTH, searchKey } from "@/shared/slug";

/** Shorter queries would match almost every name. */
export const MIN_QUERY_LENGTH = 2;
/** How alike (0 to 1, pg_trgm word similarity) part of a name must be to count as similar. */
const SIMILARITY_THRESHOLD = 0.45;

export type SearchHit =
  | { kind: "planet"; planet: PlanetSummary }
  | { kind: "star"; star: StarSummary }
  | { kind: "body"; body: SolarBody };

export interface SearchResult {
  hits: SearchHit[];
  /** True when no name contains the query and the hits are only similar names. */
  similarOnly: boolean;
  /** True when there are more hits than `limit`. */
  hasMore: boolean;
}

type SummaryField = keyof typeof planetSummaryColumns;

/** A hit as the database returns it: the summary of a planet, or a star in the same fields, with its sort keys. */
type Row = Pick<PlanetSummary, SummaryField> & {
  kind: "planet" | "star";
  planetCount: number | null;
  rank: number;
  name_length: number;
};

/** A hit with the sort keys of `hitsQuery`, so that hits from the database and from code can be merged. */
type Ranked = { hit: SearchHit; rank: number; length: number; name: string };

const SUMMARY_FIELDS = Object.keys(planetSummaryColumns) as SummaryField[];
const PLANET_KEY = sql`${planets.searchName}`;
const STAR_KEY = sql`${stars.searchName}`;

/** The columns of a planet hit and the tables they come from, for a query that adds its own `where`. */
function planetRows(rank: SQL): SQL {
  return sql`
      select 'planet' as kind, ${planetSummarySql()}, null::int as "planetCount",
             ${rank} as rank, length(${PLANET_KEY}) as name_length
      from ${planets}
      join ${stars} on ${stars.id} = ${planets.starId}`;
}

/** What a star has to say in the fields of a planet summary. It leaves the others empty. */
const STAR_FIELDS: Partial<Record<SummaryField, SQL>> = {
  slug: sql`${stars.slug}`,
  name: sql`${stars.name}`,
  source: sql`${stars.source}`,
  status: sql`'active'`,
  starName: sql`${stars.name}`,
  starTeffK: sql`${stars.teffK}`,
};

/** The stars in the columns of `planetRows`, so that one query can rank planets and stars together. */
function starRows(rank: SQL): SQL {
  const columns = SUMMARY_FIELDS.map((field) => STAR_FIELDS[field] ?? sql`null`);
  return sql`
      select 'star', ${sql.join(columns, sql`, `)}, ${stars.planetCount},
             ${rank}, length(${STAR_KEY})
      from ${stars}`;
}

/** Builds one query over planets and stars. `matches` selects the hits and `rank` orders them, lowest first. */
function hitsQuery(
  matches: (searchName: SQL) => SQL,
  rank: (searchName: SQL) => SQL,
  limit: number,
): SQL {
  return sql`
    select * from (
      ${planetRows(rank(PLANET_KEY))}
      where ${matches(PLANET_KEY)}
      union all
      ${starRows(rank(STAR_KEY))}
      where ${matches(STAR_KEY)}
    ) hits
    order by rank, name_length, name
    limit ${limit}
  `;
}

/** The summary alone, without the sort keys the query added. */
function toPlanet(row: Row): PlanetSummary {
  return Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, row[field]])) as unknown as PlanetSummary;
}

function toHit(row: Row): SearchHit {
  if (row.kind === "star") {
    return {
      kind: "star",
      star: {
        slug: row.slug,
        name: row.name,
        teffK: row.starTeffK,
        planetCount: row.planetCount ?? 0,
      },
    };
  }
  return { kind: "planet", planet: toPlanet(row) };
}

/**
 * Ranks the moons and dwarf planets, which live in code rather than in the database, by the same rules
 * as the direct matches of `search`. Returns only the bodies whose name contains the key.
 */
function matchBodies(key: string, wholeToken: RegExp): Ranked[] {
  return SOLAR_BODIES.flatMap((body) => {
    const name = searchKey(body.name);
    if (!name.includes(key)) return [];
    const rank = name === key ? 0 : wholeToken.test(name) ? 1 : name.startsWith(key) ? 2 : 3;
    return [{ hit: { kind: "body", body } as const, rank, length: name.length, name: body.name }];
  });
}

function byRank(a: Ranked, b: Ranked): number {
  return a.rank - b.rank || a.length - b.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/**
 * The pattern of names that start with the key as a whole word or number: after "kepler22" must come a
 * letter or the end, not another digit. The key contains only a-z and 0-9, so it needs no escaping.
 */
function wholeTokenPattern(key: string): string {
  return `^${key}(${/[0-9]$/.test(key) ? "[a-z]" : "[0-9]"}|$)`;
}

/** Ranks a name that contains the key: the exact name, then whole words or numbers, other prefixes, the rest. */
function directRank(name: SQL, key: string): SQL {
  return sql`case
        when ${name} = ${key} then 0
        when ${name} ~ ${wholeTokenPattern(key)} then 1
        when ${name} like ${key} || '%' then 2
        else 3
      end`;
}

/** A name has to be typed this far before it counts as the start of a name in another language. */
const MIN_ALIAS_LENGTH = 3;

/**
 * The key to search the catalogue for. The catalogue holds English names, but the planets, the Sun and the
 * Moon have names of their own in each language: "Erde" has to find Earth. Their slugs are their English
 * names, so a key that starts one of the names of the language becomes the slug of that body. A whole name
 * counts at any length: the Turkish Moon, "Ay", has two letters.
 */
export function catalogueKey(key: string, locale: Locale): string {
  const names = Object.entries(messagesFor(locale).names).map(([slug, name]) => [slug, searchKey(name)]);
  const match =
    names.find(([, name]) => name === key) ??
    (key.length < MIN_ALIAS_LENGTH ? undefined : names.find(([, name]) => name.startsWith(key)));
  return match ? searchKey(match[0]) : key;
}

/**
 * Searches planets, stars, moons and dwarf planets by name.
 *
 * The query is reduced to the same search key as the stored names, so "Kepler-22 b" and "kepler 22b" both
 * become `kepler22b`. Names containing the key rank in this order: the exact name, names starting with the key
 * as a whole word or number ("Kepler-22 b" for "kepler 22"), other prefixes ("Kepler-220"), then the rest,
 * shorter names first. Only when no name contains the key does the search fall back to similar names, which
 * catches typos such as "keplr 22". `locale` is the language the query is typed in.
 */
export async function search(query: string, limit: number, locale: Locale = "en"): Promise<SearchResult> {
  "use cache";
  const key = catalogueKey(searchKey(query.slice(0, MAX_QUERY_LENGTH)), locale);
  if (key.length < MIN_QUERY_LENGTH) {
    return { hits: [], similarOnly: false, hasMore: false };
  }
  const db = getDb();
  // Fetching one extra row tells us whether there are more hits.
  const fetchLimit = limit + 1;

  // The key contains only a-z and 0-9, so it needs no escaping for LIKE.
  const direct = await db.execute<Row>(
    hitsQuery(
      (name) => sql`${name} like '%' || ${key} || '%'`,
      (name) => directRank(name, key),
      fetchLimit,
    ),
  );
  const merged = [
    ...direct.map((row) => ({ hit: toHit(row), rank: Number(row.rank), length: Number(row.name_length), name: row.name })),
    ...matchBodies(key, new RegExp(wholeTokenPattern(key))),
  ].sort(byRank);
  if (merged.length > 0) {
    return {
      hits: merged.slice(0, limit).map((entry) => entry.hit),
      similarOnly: false,
      hasMore: merged.length > limit,
    };
  }

  // Both functions compare pg_trgm trigrams. word_similarity finds the part of a name that resembles the key
  // ("proxma" in "Proxima Cen b"), while similarity compares whole names to rank the closest first.
  const similar = await db.execute<Row>(
    hitsQuery(
      (name) => sql`word_similarity(${key}, ${name}) >= ${SIMILARITY_THRESHOLD}`,
      (name) => sql`-similarity(${key}, ${name})`,
      fetchLimit,
    ),
  );
  return {
    hits: similar.slice(0, limit).map(toHit),
    similarOnly: similar.length > 0,
    hasMore: similar.length > limit,
  };
}

export interface TypedSearchResult {
  planets: PlanetSummary[];
  /** The number of matching planets across all pages. Similar names fill one page at most and count as that many. */
  total: number;
  /** The page actually read. It differs from the requested page when that page does not exist. */
  page: number;
  /** True when no name of this type contains the query and the planets only have similar names. */
  similarOnly: boolean;
}

/**
 * Searches the planets of one type, in pages of `pageSize`.
 *
 * Without a query it lists every planet of the type by name, and only those NASA still lists: a withdrawn
 * planet is worth finding by its name, but not worth browsing past. With a query it works like `search`:
 * names containing the key in the same order, withdrawn planets included, and similar names of the type
 * if none contains it. Stars, moons and dwarf planets have no type and are left out.
 */
export async function searchByType(query: string, type: TypeFilter, page: number, pageSize: number): Promise<TypedSearchResult> {
  "use cache";
  const nothing: TypedSearchResult = { planets: [], total: 0, page: 1, similarOnly: false };
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  const key = searchKey(trimmed);
  if (trimmed !== "" && key.length < MIN_QUERY_LENGTH) return nothing;

  const db = getDb();
  const browsing = trimmed === "";
  const ofKind = ofType(type) ?? sql`true`;
  const where = browsing
    ? sql`${planets.status} = 'active' and ${ofKind}`
    : sql`${PLANET_KEY} like '%' || ${key} || '%' and ${ofKind}`;
  const [{ total }] = await db.execute<{ total: number }>(sql`select cast(count(*) as int) as total from ${planets} where ${where}`);

  if (total > 0) {
    const current = clampPage(page, total, pageSize);
    const rows = await db.execute<Row>(sql`
      ${planetRows(browsing ? sql`0` : directRank(PLANET_KEY, key))}
      where ${where}
      order by ${browsing ? sql`${planets.name} collate "natural_name", ${planets.id}` : sql`rank, name_length, ${planets.name}`}
      limit ${pageSize} offset ${(current - 1) * pageSize}
    `);
    return { planets: rows.map(toPlanet), total, page: current, similarOnly: false };
  }
  if (browsing) return nothing;

  const similar = await db.execute<Row>(sql`
    ${planetRows(sql`-similarity(${key}, ${PLANET_KEY})`)}
    where word_similarity(${key}, ${PLANET_KEY}) >= ${SIMILARITY_THRESHOLD} and ${ofKind}
    order by rank, name_length, ${planets.name}
    limit ${pageSize}
  `);
  return { planets: similar.map(toPlanet), total: similar.length, page: 1, similarOnly: similar.length > 0 };
}
