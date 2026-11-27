import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrowseNav } from "@/app/browse/BrowseNav";
import { PlanetViewer } from "@/app/globe/PlanetViewer";
import { PlanetImage } from "@/app/planets/PlanetImage";
import { SizeComparison } from "@/app/planets/SizeComparison";
import {
  bodyAppearance,
  bodyName,
  bodySummary,
  describeBody,
  moonsOf,
  parentHref,
  parentName,
  radiusEarth,
  SOLAR_BODIES,
  solarBody,
  type SolarBody,
} from "@/app/solar-system/bodies";
import { BodyCard } from "@/app/solar-system/BodyCard";
import { bodyDiscoveryFacts, bodyFacts, bodyOrbitFacts } from "@/app/solar-system/facts";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { MoonTable } from "@/app/solar-system/MoonTable";
import { SHAPE_SOURCES, shapeGrid } from "@/app/solar-system/shapes";
import { ShapeViewer } from "@/app/solar-system/ShapeViewer";
import { SmallMoonArticle } from "@/app/solar-system/SmallMoonArticle";
import { SMALL_MOON_LIST, smallMoon, smallMoonsOf } from "@/app/solar-system/smallMoons";
import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { FactRows, PageSkeleton, Section } from "@/shared/ui";

type Props = PageProps<"/[lang]/solar-system/[slug]">;

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";
const CREDIT_LINK = "underline-offset-4 underline decoration-current/40 hover:decoration-current";

export function generateStaticParams() {
  return [...SOLAR_BODIES, ...SMALL_MOON_LIST].map((body) => ({ slug: body.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMessages();
  const body = solarBody(slug);
  if (!body) {
    const moon = smallMoon(slug);
    if (!moon) return { title: m.body.notFound };
    return { title: moon.name, description: m.smallMoon.description(parentName(moon, m)) };
  }
  return {
    title: bodyName(body, m),
    description: `${describeBody(body, m)}: ${bodySummary(body, m)}`,
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
  const m = await getMessages();
  const text = m.body;
  const name = bodyName(body, m);
  const parent = parentName(body, m);
  const appearance = bodyAppearance(body);
  const moons = moonsOf(body.slug);
  const siblings = body.kind === "moon" ? moonsOf(body.parent).filter((other) => other.slug !== body.slug) : [];
  const source = MAP_SOURCES[body.slug];
  const mapNote = source?.note ? (text.mapNotes[body.slug] ?? source.note) : null;
  const grid = body.shape ? shapeGrid(body.slug) : null;
  const shapeSource = grid ? SHAPE_SOURCES[body.slug] : null;
  const discovery = bodyDiscoveryFacts(body, m);
  const [beforeParent, afterParent] = text.headline(body.kind, parent);
  const kindTitle = body.kind === "dwarf_planet" ? text.dwarfPlanet : body.kind === "asteroid" ? text.asteroid : text.moon;

  return (
    <article className="flex flex-col gap-12">
      <BrowseNav href={`/solar-system/${body.slug}`} />
      <header className="flex flex-col items-center gap-8 sm:flex-row">
        {grid ? (
          <ShapeViewer
            name={name}
            shape={{
              url: `/shapes/${body.slug}.bin`,
              maxRadius: grid.maxRadiusKm / grid.meanRadiusKm,
              mapUrl: source ? `/textures/planets/${body.slug}-lg.jpg` : null,
              color: appearance.base,
            }}
          />
        ) : (
          <PlanetViewer spec={JSON.stringify(appearance.globe)} name={name}>
            <PlanetImage appearance={appearance} size={280} label={m.planet.illustration(name)} animated={false} />
          </PlanetViewer>
        )}
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{name}</h1>
          <p className="text-lg text-muted">
            {beforeParent}
            <Link href={parentHref(body)} className={LINK}>
              {parent}
            </Link>
            {afterParent}
          </p>
          <p className="leading-7">{bodySummary(body, m)}</p>
          <p className="text-sm">
            <Link href={mapHref(body)} className={LINK}>
              {text.onOrbit}
            </Link>
          </p>
          <p className="text-sm leading-6 text-muted">
            {grid ? (source ? text.modelShapeAndMap : text.modelShape) : text.modelMap}
            {mapNote ? `; ${mapNote}` : ""}
            {text.modelHowTo}
          </p>
          {shapeSource && (
            <p className="text-xs text-muted">
              {text.shapeCredit}
              <a className={CREDIT_LINK} href={shapeSource.url}>
                {shapeSource.credit}
              </a>
              .
            </p>
          )}
          {source && (
            <p className="text-xs text-muted">
              {text.mapCredit}
              <a className={CREDIT_LINK} href={source.url}>
                {source.credit}
              </a>
              , {source.licence === "public domain" ? m.credits.publicDomain : source.licence}.
            </p>
          )}
        </div>
      </header>

      <Section title={kindTitle}>
        <FactRows rows={bodyFacts(body, m)} />
        <p className="text-sm leading-6 text-muted">
          {text.radiusNote(grid ? { name, kilometres: m.fmt.number(grid.maxRadiusKm * 2) } : null)}
        </p>
        <SizeComparison name={name} radiusEarth={radiusEarth(body)} color={appearance.base} />
      </Section>

      <Section title={m.planet.orbit}>
        <FactRows rows={bodyOrbitFacts(body, m)} />
        <p className="text-sm leading-6 text-muted">
          {body.parent === "sun" ? text.orbitNoteSun : body.ecliptic ? text.orbitNoteEcliptic : text.orbitNoteEquator}
        </p>
      </Section>

      <Section title={m.planet.discovery}>
        {discovery ? <FactRows rows={discovery} /> : <p className="leading-7">{text.antiquity}</p>}
      </Section>

      {moons.length > 0 && <BodyList title={moons.length === 1 ? text.moon : text.moons} bodies={moons} />}
      {smallMoonsOf(body.slug).length > 0 && <MoonTable parent={body.slug} name={name} />}
      {siblings.length > 0 && <BodyList title={text.otherLargeMoons(parent)} bodies={siblings} />}

      <footer className="text-sm leading-6 text-muted">
        {text.valuesFrom}
        <a className={LINK} href={body.kind === "moon" ? "https://ssd.jpl.nasa.gov/sats/phys_par/" : "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html"}>
          {text.jpl}
        </a>
        {body.slug === "pluto" && (
          <>
            {text.andThe}
            <a className={LINK} href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html">
              {text.plutoFactSheet}
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
