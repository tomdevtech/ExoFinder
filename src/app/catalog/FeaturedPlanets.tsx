import { io } from "next/cache";
import { PlanetCard } from "@/app/planets/PlanetCard";
import { getPlanetsBySlug, type PlanetSummary } from "@/app/planets/queries";
import { getMessages } from "@/i18n/server";

/** A hand-picked entry point into the catalogue: famous exoplanets and three solar-system planets. */
const FEATURED_SLUGS = [
  "proxima-cen-b",
  "trappist-1-e",
  "51-peg-b",
  "kepler-22-b",
  "55-cnc-e",
  "k2-18-b",
  "earth",
  "jupiter",
  "saturn",
];

/** Cards for a few well-known planets. It reads the database, so it needs <Suspense>. */
export async function FeaturedPlanets() {
  const { home } = await getMessages();
  // See CatalogStats: keeps the query out of the prerendered part of the page.
  await io();

  let planets: PlanetSummary[];
  try {
    planets = await getPlanetsBySlug(FEATURED_SLUGS);
  } catch (error) {
    console.error("Could not load the featured planets:", error);
    return null;
  }
  // Before the first sync the catalogue is empty.
  if (planets.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{home.featured}</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {planets.map((planet) => (
          <li key={planet.slug}>
            <PlanetCard planet={planet} showStar />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturedPlanetsSkeleton({ label }: { label: string }) {
  return <div className="h-64 animate-pulse rounded-lg bg-surface" aria-busy="true" aria-label={label} />;
}
