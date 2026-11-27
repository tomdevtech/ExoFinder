import { Suspense } from "react";
import { SearchBox } from "./search/SearchBox";
import { CatalogStats, CatalogStatsSkeleton } from "./catalog/CatalogStats";
import { CatalogueDownload } from "./catalog/CatalogueDownload";
import { FeaturedPlanets, FeaturedPlanetsSkeleton } from "./catalog/FeaturedPlanets";

export default function HomePage() {
  // The intro is static and is served at once. The two blocks below read the
  // database on every request and stream in when they are ready.
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-6 py-14">
      <div className="flex flex-col gap-4">
        <h1 className="text-5xl font-semibold tracking-tight">ExoFinder</h1>
        <p className="max-w-2xl text-lg leading-8 text-muted">
          Every known exoplanet in one place. Search by name, or start with one of the planets
          below. Each planet and each star has its own page.
        </p>
        <div data-hero-search className="mt-2 max-w-2xl">
          <SearchBox size="lg" />
        </div>
      </div>

      <Suspense fallback={<FeaturedPlanetsSkeleton />}>
        <FeaturedPlanets />
      </Suspense>

      <Suspense fallback={<CatalogStatsSkeleton />}>
        <CatalogStats />
      </Suspense>

      <CatalogueDownload />
    </main>
  );
}
