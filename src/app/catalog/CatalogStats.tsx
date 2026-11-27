import { io } from "next/cache";
import { PLANET_CLASS_ORDER } from "@/app/planets/labels";
import { listHref } from "@/app/planets/paging";
import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { getCatalogStats, type CatalogStats as Stats } from "./stats";

/** The key figures of the catalogue. It reads them when the page is asked for, so the page must wrap it in <Suspense>. */
export async function CatalogStats() {
  const { home, classes, fmt } = await getMessages();
  // `io()` keeps the query out of the prerendered part of the page, so it never runs during `next build`,
  // which has to work without a database. It has to stay outside the try block.
  await io();

  let stats: Stats;
  try {
    stats = await getCatalogStats();
  } catch (error) {
    console.error("Could not load the catalogue figures:", error);
    return <p className="rounded-lg border border-line p-5 text-muted">{home.databaseDown}</p>;
  }

  const classCount = new Map(stats.byClass.map((row) => [row.planetClass, row.count]));
  const unclassified = classCount.get(null) ?? 0;

  return (
    <section className="flex flex-col gap-8" aria-label={home.figures}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label={home.exoplanets} value={fmt.count(stats.exoplanets)} />
        <Tile label={home.hostStars} value={fmt.count(stats.hostStars)} />
        <Tile label={home.atKnownDistance} value={fmt.count(stats.hostStarsWithPosition)} />
      </dl>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        {PLANET_CLASS_ORDER.map((planetClass) => (
          <div key={planetClass}>
            <dt className="text-sm text-muted">
              <Link
                href={listHref("", 1, "name", { planetClass, climateClass: null })}
                prefetch={false}
                className="underline decoration-current/30 underline-offset-4 transition-colors hover:text-foreground"
              >
                {classes.plural[planetClass]}
              </Link>
            </dt>
            <dd className="font-mono text-xl tabular-nums">{fmt.count(classCount.get(planetClass) ?? 0)}</dd>
          </div>
        ))}
      </dl>

      <p className="text-sm leading-6 text-muted">
        {unclassified > 0 && home.unclassified(fmt.count(unclassified))}
        {stats.solarSystemPlanets > 0 && home.solarPlanets(stats.solarSystemPlanets)}
        {stats.lastSync ? home.lastSync(fmt.dateTime(stats.lastSync.finishedAt)) : home.emptyDatabase}
      </p>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse gap-1 rounded-lg border border-line p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-mono text-3xl tabular-nums">{value}</dd>
    </div>
  );
}

export function CatalogStatsSkeleton({ label }: { label: string }) {
  return <div className="h-56 animate-pulse rounded-lg bg-surface" aria-busy="true" aria-label={label} />;
}
