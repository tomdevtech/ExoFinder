import { Suspense } from "react";
import { CatalogStats, CatalogStatsSkeleton } from "@/app/catalog/CatalogStats";
import { CatalogueDownload } from "@/app/catalog/CatalogueDownload";
import { FeaturedPlanets, FeaturedPlanetsSkeleton } from "@/app/catalog/FeaturedPlanets";
import { SearchBox } from "@/app/search/SearchBox";
import { getMessages } from "@/i18n/server";

export default async function HomePage() {
  const { home } = await getMessages();
  // The intro is static and is served at once. The two blocks below read the
  // database on every request and stream in when they are ready.
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-6 py-14">
      <div className="flex flex-col gap-4">
        <h1 className="text-5xl font-semibold tracking-tight">ExoFinder</h1>
        <p className="max-w-2xl text-lg leading-8 text-muted">{home.intro}</p>
        <div data-hero-search className="mt-2 max-w-2xl">
          <SearchBox size="lg" />
        </div>
      </div>

      <Suspense fallback={<FeaturedPlanetsSkeleton label={home.loadingPlanets} />}>
        <FeaturedPlanets />
      </Suspense>

      <Suspense fallback={<CatalogStatsSkeleton label={home.loadingFigures} />}>
        <CatalogStats />
      </Suspense>

      <CatalogueDownload />
    </main>
  );
}
