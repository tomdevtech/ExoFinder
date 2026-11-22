import { io } from "next/cache";
import Link from "next/link";
import { PLANET_CLASS_ORDER, PLANET_CLASS_PLURALS } from "@/app/planets/labels";
import { listHref } from "@/app/planets/paging";
import { formatCount, formatDateTime } from "@/shared/format";
import { getCatalogStats, type CatalogStats as Stats } from "./stats";

/** The key figures of the catalogue. It reads them when the page is asked for, so the page must wrap it in <Suspense>. */
export async function CatalogStats() {
  // `io()` keeps the query out of the prerendered part of the page, so it never runs during `next build`,
  // which has to work without a database. It has to stay outside the try block.
  await io();

  let stats: Stats;
  try {
    stats = await getCatalogStats();
  } catch (error) {
    console.error("Could not load the catalogue figures:", error);
    return (
      <p className="rounded-lg border border-line p-5 text-muted">
        The database cannot be reached right now.
      </p>
    );
  }

  const classCount = new Map(stats.byClass.map((row) => [row.planetClass, row.count]));
  const unclassified = classCount.get(null) ?? 0;

  return (
    <section className="flex flex-col gap-8" aria-label="The catalogue in numbers">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Exoplanets" value={stats.exoplanets} />
        <Tile label="Stars with planets" value={stats.hostStars} />
        <Tile label="of them at a known distance" value={stats.hostStarsWithPosition} />
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
                {PLANET_CLASS_PLURALS[planetClass]}
              </Link>
            </dt>
            <dd className="font-mono text-xl tabular-nums">
              {formatCount(classCount.get(planetClass) ?? 0)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-sm leading-6 text-muted">
        {unclassified > 0 &&
          `${formatCount(unclassified)} planets cannot be classified because neither radius nor mass is known. `}
        {stats.solarSystemPlanets > 0 &&
          `On top come the ${stats.solarSystemPlanets} planets of our solar system. `}
        {stats.lastSync
          ? `Last compared with NASA on ${formatDateTime(stats.lastSync.finishedAt)}.`
          : "The database is still empty. Run “npm run sync” to fill it."}
      </p>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse gap-1 rounded-lg border border-line p-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-mono text-3xl tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}

export function CatalogStatsSkeleton() {
  return (
    <div
      className="h-56 animate-pulse rounded-lg bg-surface"
      aria-busy="true"
      aria-label="Loading the catalogue figures"
    />
  );
}
