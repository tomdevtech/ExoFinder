import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { BrowseNav } from "@/app/browse/BrowseNav";
import { planetAppearance } from "@/app/planets/appearance";
import {
  findPlanetSlugByAlias,
  getPlanet,
  getPlanetChanges,
  getPlanetFormerNames,
  getPlanetsOfStar,
} from "@/app/planets/queries";
import {
  ChangeHistory,
  DiscoveryFacts,
  HostStar,
  OrbitFacts,
  PlanetFacts,
  PlanetHeader,
  PlanetSources,
} from "@/app/planets/sections";
import { moonsOf } from "@/app/solar-system/bodies";
import { BodyCard } from "@/app/solar-system/BodyCard";
import { MoonTable } from "@/app/solar-system/MoonTable";
import { smallMoonsOf } from "@/app/solar-system/smallMoons";
import { localHref } from "@/i18n/locales";
import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { Notice, PageSkeleton, Section } from "@/shared/ui";

type Props = PageProps<"/[lang]/planets/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMessages();
  const found = await getPlanet(slug);
  if (!found) return { title: m.planet.notFound };
  const { planet, star } = found;
  return {
    title: nameOf(m, planet.slug, planet.name),
    description: m.planet.description(
      m.classes.describe(planet.planetClass, planet.climateClass),
      nameOf(m, star.slug, star.name),
    ),
  };
}

export default function PlanetPage({ params }: Props) {
  // The page shell is static. Everything that depends on the slug or the database sits inside <Suspense>
  // and streams in at request time.
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Suspense fallback={<PageSkeleton />}>
        <PlanetContent params={params} />
      </Suspense>
    </main>
  );
}

async function PlanetContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const m = await getMessages();
  const found = await getPlanet(slug);
  if (!found) {
    // The planet may have been renamed, so old URLs redirect to the new page.
    const currentSlug = await findPlanetSlugByAlias(slug);
    if (currentSlug) permanentRedirect(localHref(m.locale, `/planets/${currentSlug}`));
    notFound();
  }

  const { planet, star } = found;
  const [systemPlanets, changes, formerNames] = await Promise.all([
    getPlanetsOfStar(star.id),
    getPlanetChanges(planet.id),
    getPlanetFormerNames(planet.id),
  ]);
  const siblings = systemPlanets.filter((other) => other.slug !== planet.slug && other.status === "active");
  const moons = planet.source === "sol" ? moonsOf(planet.slug) : [];
  const smallMoons = planet.source === "sol" ? smallMoonsOf(planet.slug).length : 0;
  const appearance = planetAppearance({
    slug: planet.slug,
    source: planet.source,
    planetClass: planet.planetClass,
    climateClass: planet.climateClass,
    starTeffK: star.teffK,
    radiusEarth: planet.radiusEarth,
    eqTempK: planet.eqTempK,
    densityEarth: found.densityEarth,
    orbitalPeriodDays: planet.orbitalPeriodDays,
  });

  return (
    <article className="flex flex-col gap-12">
      {planet.status === "removed" && (
        <Notice>{m.planet.removed(planet.removedAt ? m.fmt.date(planet.removedAt) : null)}</Notice>
      )}
      {planet.status === "active" && <BrowseNav href={`/planets/${planet.slug}`} />}
      <PlanetHeader planet={planet} star={star} appearance={appearance} formerNames={formerNames} />
      <PlanetFacts planet={planet} appearance={appearance} />
      <OrbitFacts planet={planet} />
      {moons.length + smallMoons > 0 && (
        <Section title={moons.length + smallMoons === 1 ? m.planet.moon : m.planet.moons}>
          {moons.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {moons.map((moon) => (
                <li key={moon.slug}>
                  <BodyCard body={moon} />
                </li>
              ))}
            </ul>
          )}
          {smallMoons > 0 && <MoonTable parent={planet.slug} name={nameOf(m, planet.slug, planet.name)} />}
        </Section>
      )}
      {planet.source !== "sol" && <DiscoveryFacts planet={planet} />}
      <HostStar star={star} siblings={siblings} />
      {changes.length > 0 && <ChangeHistory changes={changes} />}
      <PlanetSources planet={planet} />
    </article>
  );
}
