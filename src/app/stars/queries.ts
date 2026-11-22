import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/db/client";
import { starAliases, stars } from "@/db/schema";
import { isSlug } from "@/shared/slug";

async function readStar(slug: string) {
  "use cache";
  if (!isSlug(slug)) return null;
  const [star] = await getDb().select().from(stars).where(eq(stars.slug, slug)).limit(1);
  return star ?? null;
}

/**
 * Returns a star by slug, or null. The page metadata and the page body ask for it at the same moment of
 * one request, before either answer is in the cache, so React's `cache` makes them share one read.
 */
export const getStar = cache(readStar);

/** Returns the current slug of a star that used to be reachable under `slug`. */
export async function findStarSlugByAlias(slug: string): Promise<string | null> {
  "use cache";
  if (!isSlug(slug)) return null;
  const [row] = await getDb()
    .select({ slug: stars.slug })
    .from(starAliases)
    .innerJoin(stars, eq(stars.id, starAliases.starId))
    .where(eq(starAliases.slug, slug))
    .limit(1);
  return row?.slug ?? null;
}

/** Returns the former names of a star, oldest first. */
export async function getStarFormerNames(starId: number): Promise<string[]> {
  "use cache";
  const rows = await getDb()
    .select({ name: starAliases.name })
    .from(starAliases)
    .where(eq(starAliases.starId, starId))
    .orderBy(asc(starAliases.createdAt));
  return rows.map((row) => row.name);
}
