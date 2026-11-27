import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrowseNav } from "@/app/browse/BrowseNav";
import { PlanetViewer } from "@/app/globe/PlanetViewer";
import { PlanetImage } from "@/app/planets/PlanetImage";
import { SizeComparison } from "@/app/planets/SizeComparison";
import { formatNumber } from "@/shared/format";
import { FactRows, PageSkeleton, Section } from "@/shared/ui";
import {
  bodyAppearance,
  describeBody,
  moonsOf,
  parentHref,
  parentName,
  radiusEarth,
  SOLAR_BODIES,
  solarBody,
  type SolarBody,
} from "../bodies";
import { BodyCard } from "../BodyCard";
import { bodyDiscoveryFacts, bodyFacts, bodyOrbitFacts } from "../facts";
import { MoonTable } from "../MoonTable";
import { SMALL_MOON_LIST, smallMoon, smallMoonsOf } from "../smallMoons";
import { MAP_SOURCES } from "../maps";
import { SHAPE_SOURCES, shapeGrid } from "../shapes";
import { ShapeViewer } from "../ShapeViewer";
import { SmallMoonArticle } from "../SmallMoonArticle";

type Props = PageProps<"/solar-system/[slug]">;

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

export function generateStaticParams() {
  return [...SOLAR_BODIES, ...SMALL_MOON_LIST].map((body) => ({ slug: body.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const body = solarBody(slug);
  if (!body) {
    const moon = smallMoon(slug);
    if (!moon) return { title: "Not found" };
    return {
      title: moon.name,
      description: `Moon of ${parentName(moon)}: its orbit, its size and its discovery, with a model of what it could look like.`,
    };
  }
  return {
    title: body.name,
    description: `${describeBody(body)}: ${body.summary}`,
  };
}

export default function BodyPage({ params }: Props) {
  // The pages are built ahead of time; an unknown slug is only known at request time and streams in.
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Suspense fallback={<PageSkeleton />}>
        <BodyContent params={params} />
      </Suspense>
    </main>
  );
}

async function BodyContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const body = solarBody(slug);
  if (!body) {
    const moon = smallMoon(slug);
    if (!moon) notFound();
    return (
      <SmallMoonArticle moon={moon}>
        <BrowseNav href={`/solar-system/${moon.slug}`} />
      </SmallMoonArticle>
    );
  }
  const appearance = bodyAppearance(body);
  const moons = moonsOf(body.slug);
  const siblings = body.kind === "moon" ? moonsOf(body.parent).filter((other) => other.slug !== body.slug) : [];
  const source = MAP_SOURCES[body.slug];
  const grid = body.shape ? shapeGrid(body.slug) : null;
  const shapeSource = grid ? SHAPE_SOURCES[body.slug] : null;
  const discovery = bodyDiscoveryFacts(body);

  return (
    <article className="flex flex-col gap-12">
      <BrowseNav href={`/solar-system/${body.slug}`} />
      <header className="flex flex-col items-center gap-8 sm:flex-row">
        {grid ? (
          <ShapeViewer
            name={body.name}
            shape={{
              url: `/shapes/${body.slug}.bin`,
              maxRadius: grid.maxRadiusKm / grid.meanRadiusKm,
              mapUrl: source ? `/textures/planets/${body.slug}-lg.jpg` : null,
              color: appearance.base,
            }}
          />
        ) : (
          <PlanetViewer spec={JSON.stringify(appearance.globe)} name={body.name}>
            <PlanetImage appearance={appearance} size={280} label={`Illustration of ${body.name}`} animated={false} />
          </PlanetViewer>
        )}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{body.name}</h1>
          <p className="text-lg text-muted">
            {body.kind === "dwarf_planet" ? "Dwarf planet orbiting the " : body.kind === "asteroid" ? "Asteroid orbiting the " : "Moon of "}
            <Link href={parentHref(body)} className={LINK}>
              {parentName(body)}
            </Link>
          </p>
          <p className="leading-7">{body.summary}</p>
          <p className="text-sm">
            <Link href={mapHref(body)} className={LINK}>
              See it on its orbit in 3D
            </Link>
          </p>
          <p className="text-sm leading-6 text-muted">
            {grid
              ? source
                ? "The model shows its real shape, measured by spacecraft, with a map put together from their images"
                : "The model shows its real shape, measured by spacecraft. No spacecraft has mapped its whole surface, so it is drawn in its colour alone"
              : "The model shows a real map put together from spacecraft images"}
            {source?.note ? `; ${source.note}` : ""}. Drag it to look at every side, zoom with the
            buttons, with two fingers or with Ctrl and the mouse wheel.
          </p>
          {shapeSource && (
            <p className="text-xs text-muted">
              Shape:{" "}
              <a className="underline-offset-4 underline decoration-current/40 hover:decoration-current" href={shapeSource.url}>
                {shapeSource.credit}
              </a>
              .
            </p>
          )}
          {source && (
            <p className="text-xs text-muted">
              Map:{" "}
              <a className="underline-offset-4 underline decoration-current/40 hover:decoration-current" href={source.url}>
                {source.credit}
              </a>
              , {source.licence}.
            </p>
          )}
        </div>
      </header>

      <Section title={body.kind === "dwarf_planet" ? "Dwarf planet" : body.kind === "asteroid" ? "Asteroid" : "Moon"}>
        <FactRows rows={bodyFacts(body)} />
        <p className="text-sm leading-6 text-muted">
          The radius is the mean radius, the radius of a sphere with the same volume
          {grid ? `; ${body.name} is far from round, its longest axis ${formatNumber(grid.maxRadiusKm * 2)} km across` : ""}. The mass is
          derived from the gravitational pull measured by spacecraft or from the orbits of neighbours.
        </p>
        <SizeComparison name={body.name} radiusEarth={radiusEarth(body)} color={appearance.base} />
      </Section>

      <Section title="Orbit">
        <FactRows rows={bodyOrbitFacts(body)} />
        <p className="text-sm leading-6 text-muted">
          {body.parent === "sun"
            ? "1 AU is the distance between Earth and the Sun. The inclination is measured against the plane of Earth's orbit."
            : body.ecliptic
              ? "The distance is the mean distance between the centres. The inclination is measured against the plane of Earth's orbit, which the Moon's orbit circles about."
              : "The distance is the mean distance between the centres. The inclination is measured against the plane the orbit circles about, close to the planet's equator; above 90° the moon orbits backwards."}
        </p>
      </Section>

      <Section title="Discovery">
        {discovery ? (
          <FactRows rows={discovery} />
        ) : (
          <p className="leading-7">Known since antiquity: it is plain to see in the night sky.</p>
        )}
      </Section>

      {moons.length > 0 && <BodyList title={moons.length === 1 ? "Moon" : "Moons"} bodies={moons} />}
      {smallMoonsOf(body.slug).length > 0 && <MoonTable parent={body.slug} name={body.name} />}
      {siblings.length > 0 && (
        <BodyList title={`Other large moons of ${parentName(body)}`} bodies={siblings} />
      )}

      <footer className="text-sm leading-6 text-muted">
        Values from{" "}
        <a className={LINK} href={body.kind === "moon" ? "https://ssd.jpl.nasa.gov/sats/phys_par/" : "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html"}>
          JPL Solar System Dynamics
        </a>
        {body.slug === "pluto" && (
          <>
            {" "}and the{" "}
            <a className={LINK} href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html">
              NASA Pluto Fact Sheet
            </a>
          </>
        )}
        .
      </footer>
    </article>
  );
}

function BodyList({ title, bodies }: { title: string; bodies: SolarBody[] }) {
  return (
    <Section title={title}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bodies.map((other) => (
          <li key={other.slug}>
            <BodyCard body={other} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The map link: a body that orbits the Sun is followed directly, a moon through its planet. */
function mapHref(body: SolarBody): string {
  return body.parent === "sun"
    ? `/map?system=sun&planet=${body.slug}`
    : `/map?system=sun&planet=${body.parent}&moon=${body.slug}`;
}
