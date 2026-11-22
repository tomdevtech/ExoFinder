import { and, desc, eq, sql } from "drizzle-orm";
import type { PlanetClass } from "@/app/planets/classify";
import { getDb } from "@/db/client";
import { planets, stars, syncRuns } from "@/db/schema";

export interface CatalogStats {
  exoplanets: number;
  hostStars: number;
  /** Stars with a known distance. Only these can be placed on the map. */
  hostStarsWithPosition: number;
  solarSystemPlanets: number;
  byClass: { planetClass: PlanetClass | null; count: number }[];
  lastSync: { finishedAt: Date; added: number; updated: number; removed: number } | null;
}

/** Key figures of the catalogue for the home page. */
export async function getCatalogStats(): Promise<CatalogStats> {
  "use cache";
  const db = getDb();
  const active = eq(planets.status, "active");
  const [[planetCounts], [starCounts], byClass, [lastSync]] = await Promise.all([
    db
      .select({
        exoplanets: sql<number>`cast(count(*) filter (where ${planets.source} = 'nasa') as int)`,
        solarSystemPlanets: sql<number>`cast(count(*) filter (where ${planets.source} = 'sol') as int)`,
      })
      .from(planets)
      .where(active),
    db
      .select({
        hostStars: sql<number>`cast(count(*) as int)`,
        hostStarsWithPosition: sql<number>`cast(count(${stars.x}) as int)`,
      })
      .from(stars)
      .where(and(eq(stars.source, "nasa"), sql`${stars.planetCount} > 0`)),
    db
      .select({
        planetClass: planets.planetClass,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(planets)
      .where(and(active, eq(planets.source, "nasa")))
      .groupBy(planets.planetClass),
    db
      .select({
        finishedAt: syncRuns.finishedAt,
        added: syncRuns.added,
        updated: syncRuns.updated,
        removed: syncRuns.removed,
      })
      .from(syncRuns)
      .where(eq(syncRuns.status, "success"))
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1),
  ]);

  return {
    ...planetCounts,
    ...starCounts,
    byClass,
    lastSync: lastSync?.finishedAt
      ? {
          finishedAt: lastSync.finishedAt,
          added: lastSync.added,
          updated: lastSync.updated,
          removed: lastSync.removed,
        }
      : null,
  };
}
