import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { planets, stars } from "@/db/schema";
import { isSlug } from "@/shared/slug";

/** An exoplanet at its place in the order the catalogue is browsed in. */
export interface OrderedExoplanet {
  slug: string;
  name: string;
  starSlug: string;
  starName: string;
  distPc: number | null;
  /** Counted from 1 among the exoplanets. */
  position: number;
}

/** An exoplanet with the ones before and after it, each null at an end of the catalogue. */
export interface ExoplanetNeighbours {
  planet: OrderedExoplanet;
  previous: OrderedExoplanet | null;
  next: OrderedExoplanet | null;
  /** The number of exoplanets in the order. */
  total: number;
}

/** A row of `orderedExoplanets`. A type rather than an interface, as the database driver asks for a plain record. */
type Row = {
  slug: string;
  name: string;
  starSlug: string;
  starName: string;
  distPc: number | null;
  position: number;
  total: number;
};

/**
 * The order the exoplanets are browsed in, for a query over planets joined with their stars: the systems
 * by their distance from the Sun, those at an unknown distance last, and the planets of a system from the
 * inside out, as `getPlanetsOfStar` lists them. The star's name and the ids break ties, so that the order
 * is the same in every query. The printed catalogue sorts by it too.
 */
export function exoplanetOrder(): SQL {
  return sql`${stars.distPc} asc nulls last, ${stars.name}, ${stars.id},
             ${planets.orbitalPeriodDays} asc nulls last, ${planets.semiMajorAxisAu} asc nulls last,
             ${planets.name}, ${planets.id}`;
}

/**
 * The active exoplanets, numbered in `exoplanetOrder`. The solar system is left out; its order includes
 * moons and lives in order.ts.
 */
function orderedExoplanets(): SQL {
  return sql`
    select ${planets.slug} as slug, ${planets.name} as name,
           ${stars.slug} as "starSlug", ${stars.name} as "starName", ${stars.distPc} as "distPc",
           cast(row_number() over (order by ${exoplanetOrder()}) as int) as position,
           cast(count(*) over () as int) as total
    from ${planets}
    join ${stars} on ${stars.id} = ${planets.starId}
    where ${planets.status} = 'active' and ${planets.source} = 'nasa'`;
}

const toPlanet = ({ slug, name, starSlug, starName, distPc, position }: Row): OrderedExoplanet => ({
  slug,
  name,
  starSlug,
  starName,
  distPc,
  position,
});

/** Returns an exoplanet's place in the order, or null for a planet that is not in it. */
export async function getExoplanetNeighbours(slug: string): Promise<ExoplanetNeighbours | null> {
  "use cache";
  if (!isSlug(slug)) return null;
  const rows = await getDb().execute<Row>(sql`
    with ordered as (${orderedExoplanets()}),
         here as (select position from ordered where slug = ${slug})
    select ordered.* from ordered, here
    where ordered.position between here.position - 1 and here.position + 1
    order by ordered.position`);
  const row = rows.find((candidate) => candidate.slug === slug);
  if (!row) return null;
  const at = (position: number) => {
    const found = rows.find((candidate) => candidate.position === position);
    return found ? toPlanet(found) : null;
  };
  return { planet: toPlanet(row), previous: at(row.position - 1), next: at(row.position + 1), total: row.total };
}

/** Where the exoplanets start: the first one in the order, if there is any, and how many there are. */
export interface ExoplanetStart {
  first: OrderedExoplanet | null;
  total: number;
}

export async function getExoplanetStart(): Promise<ExoplanetStart> {
  "use cache";
  const [row] = await getDb().execute<Row>(sql`
    with ordered as (${orderedExoplanets()})
    select * from ordered where position = 1`);
  return row ? { first: toPlanet(row), total: row.total } : { first: null, total: 0 };
}
