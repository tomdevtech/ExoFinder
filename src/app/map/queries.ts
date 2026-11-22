import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { planets, stars } from "@/db/schema";
import { isSlug } from "@/shared/slug";
import { measuredDensity } from "@/app/planets/queries";
import type { StarRow, SystemPlanetRow, SystemStarRow } from "./payload";

/** Returns all stars with a known position, nearest first. */
export async function getMapStars(): Promise<StarRow[]> {
  "use cache";
  const rows = await getDb()
    .select({
      slug: stars.slug,
      name: stars.name,
      x: stars.x,
      y: stars.y,
      z: stars.z,
      teffK: stars.teffK,
      planetCount: stars.planetCount,
    })
    .from(stars)
    .where(and(isNotNull(stars.x), isNotNull(stars.y), isNotNull(stars.z)))
    .orderBy(asc(stars.distPc));
  return rows.flatMap((row) =>
    row.x === null || row.y === null || row.z === null
      ? []
      : [{ ...row, x: row.x, y: row.y, z: row.z }],
  );
}

/** Returns a star and its active planets ordered by period, or `null` if the slug is invalid or unknown. */
export async function getMapSystem(
  slug: string,
): Promise<{ star: SystemStarRow; planets: SystemPlanetRow[] } | null> {
  "use cache";
  if (!isSlug(slug)) return null;
  const db = getDb();
  const [star] = await db
    .select({
      id: stars.id,
      slug: stars.slug,
      name: stars.name,
      source: stars.source,
      teffK: stars.teffK,
      radiusSun: stars.radiusSun,
      massSun: stars.massSun,
      distPc: stars.distPc,
    })
    .from(stars)
    .where(eq(stars.slug, slug))
    .limit(1);
  if (!star) return null;

  const rows = await db
    .select({
      slug: planets.slug,
      name: planets.name,
      source: planets.source,
      planetClass: planets.planetClass,
      climateClass: planets.climateClass,
      orbitalPeriodDays: planets.orbitalPeriodDays,
      semiMajorAxisAu: planets.semiMajorAxisAu,
      eccentricity: planets.eccentricity,
      radiusEarth: planets.radiusEarth,
      eqTempK: planets.eqTempK,
      densityEarth: measuredDensity(),
    })
    .from(planets)
    .where(and(eq(planets.starId, star.id), eq(planets.status, "active")))
    .orderBy(asc(planets.orbitalPeriodDays), asc(planets.semiMajorAxisAu), asc(planets.name));
  return { star, planets: rows };
}
