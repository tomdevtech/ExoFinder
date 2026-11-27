/**
 * The bodies of the printed catalogue, each as the plain text and the picture source of its page. They
 * come in the order the site is browsed in (src/app/browse), with the same numbers, and show the same
 * facts as their pages on the site.
 */
import { and, eq } from "drizzle-orm";
import { SOLAR_SEQUENCE } from "@/app/browse/order";
import { exoplanetOrder } from "@/app/browse/queries";
import { planetAppearance } from "@/app/planets/appearance";
import { discoveryFacts, hostStarFacts, orbitFacts, planetFacts } from "@/app/planets/facts";
import { describePlanet } from "@/app/planets/labels";
import { measuredDensity } from "@/app/planets/queries";
import { bodyAppearance, describeBody, moonsOf, parentName, solarBody, type SolarBody } from "@/app/solar-system/bodies";
import {
  bodyDiscoveryFacts,
  bodyFacts,
  bodyOrbitFacts,
  smallMoonDiscoveryFacts,
  smallMoonFacts,
  smallMoonOrbitFacts,
} from "@/app/solar-system/facts";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SHAPE_SOURCES, shapeGrid } from "@/app/solar-system/shapes";
import { smallMoon, smallMoonsOf, type SmallMoon } from "@/app/solar-system/smallMoons";
import { getDb } from "@/db/client";
import { planets, stars, type Planet, type Star } from "@/db/schema";
import type { FactRow } from "@/shared/facts";
import { formatCount, formatNumber, parsecToLightYears } from "@/shared/format";
import { hashText } from "@/shared/math";
import type { PictureSource } from "./catalogue-pictures";

export interface FactSection {
  title: string;
  rows: FactRow[];
}

/** One page of the catalogue. */
export interface CatalogueEntry {
  /** The number of the body in the catalogue, as the site shows it, or null for the Sun, which the site does not count. */
  number: number | null;
  name: string;
  /** The line below the name: what kind of body it is and what it orbits. */
  kind: string;
  /** A few sentences about the body, where the site has them. */
  text: string | null;
  sections: FactSection[];
  /** What the picture shows and whose work it is. */
  pictureNote: string;
  /** Where the values come from. */
  sourceNote: string;
  /** The address of the body's page, from the root of the site. */
  href: string;
  picture: PictureSource;
  /**
   * Where the page stands in the contents: `chapter` is the solar system or the exoplanets, `group` the body
   * that orbits the Sun or the star, and `rank` whether the page opens its group, is a large moon or a small one.
   */
  chapter: "solar" | "exoplanets";
  group: string;
  /** What the contents say about the group, such as the distance of a star. */
  groupNote: string | null;
  rank: "star" | "main" | "moon" | "small";
}

const ILLUSTRATION =
  "Illustration: nobody has seen this planet up close. The picture is computed from the values on this page and shows what a planet of this size and temperature could look like.";

type PlanetRow = { planet: Planet; star: Star; densityEarth: number | null };

function globeOf({ planet, star, densityEarth }: PlanetRow): PictureSource {
  const appearance = planetAppearance({
    slug: planet.slug,
    source: planet.source,
    planetClass: planet.planetClass,
    climateClass: planet.climateClass,
    starTeffK: star.teffK,
    radiusEarth: planet.radiusEarth,
    eqTempK: planet.eqTempK,
    densityEarth,
    orbitalPeriodDays: planet.orbitalPeriodDays,
  });
  return { kind: "globe", spec: appearance.globe };
}

function distanceText(star: Star): string | null {
  return star.distPc !== null && star.distPc > 0 ? `${formatNumber(parsecToLightYears(star.distPc))} light-years` : null;
}

export function exoplanetEntry(row: PlanetRow, number: number): CatalogueEntry {
  const { planet, star } = row;
  const distance = distanceText(star);
  return {
    number,
    name: planet.name,
    kind: `${describePlanet(planet.planetClass, planet.climateClass)} orbiting ${star.name}${distance ? `, ${distance} from the Sun` : ""}`,
    text: null,
    sections: [
      { title: "Planet", rows: planetFacts(planet) },
      { title: "Orbit", rows: orbitFacts(planet) },
      { title: "Discovery", rows: discoveryFacts(planet) },
      { title: `Host star: ${star.name}`, rows: hostStarFacts(star) },
    ],
    pictureNote: ILLUSTRATION,
    sourceNote: "Values from the NASA Exoplanet Archive.",
    href: `/planets/${planet.slug}`,
    picture: globeOf(row),
    chapter: "exoplanets",
    group: star.name,
    groupNote: distance,
    rank: "main",
  };
}

function solarPlanetEntry(row: PlanetRow, number: number): CatalogueEntry {
  const { planet } = row;
  const moons = moonsOf(planet.slug).length + smallMoonsOf(planet.slug).length;
  return {
    number,
    name: planet.name,
    kind: `${describePlanet(planet.planetClass, planet.climateClass)} orbiting the Sun`,
    text: null,
    sections: [
      { title: "Planet", rows: planetFacts(planet) },
      {
        title: "Orbit",
        rows: [...orbitFacts(planet), { label: "Known moons", value: moons === 0 ? "none" : formatCount(moons) }],
      },
    ],
    pictureNote: "A real map of the planet, put together from spacecraft images: Solar System Scope, CC BY 4.0.",
    sourceNote: "Values from the NASA Planetary Fact Sheet.",
    href: `/planets/${planet.slug}`,
    picture: globeOf(row),
    chapter: "solar",
    group: planet.name,
    groupNote: null,
    rank: "main",
  };
}

function bodyEntry(body: SolarBody, number: number): CatalogueEntry {
  const appearance = bodyAppearance(body);
  const map = MAP_SOURCES[body.slug];
  const grid = body.shape ? shapeGrid(body.slug) : null;
  const mapCredit = map ? `${map.credit}, ${map.licence}${map.note ? `; ${map.note}` : ""}.` : null;
  const discovery = bodyDiscoveryFacts(body);
  const main = body.parent === "sun";
  return {
    number,
    name: body.name,
    kind: main ? `${describeBody(body)} orbiting the Sun` : describeBody(body),
    text: body.summary,
    sections: [
      {
        title: body.kind === "dwarf_planet" ? "Dwarf planet" : body.kind === "asteroid" ? "Asteroid" : "Moon",
        rows: bodyFacts(body),
      },
      { title: "Orbit", rows: bodyOrbitFacts(body) },
      { title: "Discovery", rows: discovery ?? [{ label: "Known since", value: "antiquity" }] },
    ],
    pictureNote: grid
      ? `Its real shape, measured by spacecraft: ${SHAPE_SOURCES[body.slug].credit}. ${
          mapCredit ? `Map: ${mapCredit}` : "No spacecraft has mapped its whole surface, so it is drawn in its colour alone."
        }`
      : `A real map put together from spacecraft images${mapCredit ? `: ${mapCredit}` : "."}`,
    sourceNote:
      body.slug === "pluto"
        ? "Values from JPL Solar System Dynamics and the NASA Pluto Fact Sheet."
        : "Values from JPL Solar System Dynamics.",
    href: `/solar-system/${body.slug}`,
    picture: grid
      ? {
          kind: "shape",
          slug: body.slug,
          maxRadius: grid.maxRadiusKm / grid.meanRadiusKm,
          map: map ? `/textures/planets/${body.slug}-lg.jpg` : null,
          color: appearance.base,
        }
      : { kind: "globe", spec: appearance.globe },
    chapter: "solar",
    group: main ? body.name : parentName(body),
    groupNote: null,
    rank: main ? "main" : "moon",
  };
}

function smallMoonEntry(moon: SmallMoon, number: number): CatalogueEntry {
  return {
    number,
    name: moon.name,
    kind: `Moon of ${parentName(moon)}`,
    text: null,
    sections: [
      { title: "Moon", rows: smallMoonFacts(moon) },
      { title: "Orbit", rows: smallMoonOrbitFacts(moon) },
      { title: "Discovery", rows: smallMoonDiscoveryFacts(moon) },
    ],
    pictureNote:
      "Illustration: ExoFinder has no shape model and no map of this moon, so its shape and its surface are made up. Only the values on this page are real.",
    sourceNote: "Orbit and discovery from JPL Solar System Dynamics, estimated sizes and groups also from Scott S. Sheppard.",
    href: `/solar-system/${moon.slug}`,
    // The site makes its model of the moon from the same seed, so both show the same body.
    picture: { kind: "invented", seed: hashText(moon.name) },
    chapter: "solar",
    group: parentName(moon),
    groupNote: null,
    rank: "small",
  };
}

function sunEntry(sun: Star): CatalogueEntry {
  return {
    number: null,
    name: sun.name,
    kind: "Our own star",
    text: "The star of the solar system holds 99.9 per cent of its mass. Everything on the following pages circles it: eight planets, their moons, the dwarf planets and the small bodies between them.",
    sections: [
      {
        title: "Star",
        rows: [
          ...hostStarFacts(sun),
          { label: "Brightness seen from Earth", value: sun.vmag !== null ? `${formatNumber(sun.vmag)} mag` : null },
        ],
      },
    ],
    pictureNote: "A real map of the Sun's surface: Solar System Scope, CC BY 4.0.",
    sourceNote: "Values from the NASA Planetary Fact Sheet.",
    href: `/stars/${sun.slug}`,
    picture: { kind: "sun" },
    chapter: "solar",
    group: sun.name,
    groupNote: null,
    rank: "star",
  };
}

/** The Sun and the bodies of the solar system, in the order of the site. `rows` are the planets with source `sol`. */
export function solarEntries(sun: Star, rows: PlanetRow[]): CatalogueEntry[] {
  const bySlug = new Map(rows.map((row) => [row.planet.slug, row]));
  const bodies = SOLAR_SEQUENCE.map(({ href, name }, index) => {
    const slug = href.slice(href.lastIndexOf("/") + 1);
    const number = index + 1;
    const row = href.startsWith("/planets/") ? bySlug.get(slug) : undefined;
    if (row) return solarPlanetEntry(row, number);
    const body = solarBody(slug);
    if (body) return bodyEntry(body, number);
    const moon = smallMoon(slug);
    if (moon) return smallMoonEntry(moon, number);
    throw new Error(`The catalogue knows no body for ${name} (${href}). Is the solar system seeded (npm run seed:sol)?`);
  });
  return [sunEntry(sun), ...bodies];
}

/** The exoplanets in the order of the site, numbered on from the solar system. */
export function exoplanetEntries(rows: PlanetRow[]): CatalogueEntry[] {
  return rows.map((row, index) => exoplanetEntry(row, SOLAR_SEQUENCE.length + index + 1));
}

const rowColumns = { planet: planets, star: stars, densityEarth: measuredDensity() };

/** Reads the Sun with its planets. */
export async function readSolarSystem(): Promise<{ sun: Star; rows: PlanetRow[] }> {
  const rows = await getDb()
    .select(rowColumns)
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(eq(planets.source, "sol"));
  if (rows.length === 0) throw new Error("The solar system is not in the database. Run `npm run seed:sol` first.");
  return { sun: rows[0].star, rows };
}

/** Reads every active exoplanet with its star, in the order the site is browsed in. */
export async function readExoplanets(limit?: number): Promise<PlanetRow[]> {
  const query = getDb()
    .select(rowColumns)
    .from(planets)
    .innerJoin(stars, eq(stars.id, planets.starId))
    .where(and(eq(planets.status, "active"), eq(planets.source, "nasa")))
    .orderBy(exoplanetOrder());
  return limit === undefined ? query : query.limit(limit);
}
