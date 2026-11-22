import { planetAppearance } from "@/app/planets/appearance";
import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import type { GlobeSpec } from "@/app/globe/spec";
import { describePlanet } from "@/app/planets/labels";
import { AU_KM } from "@/shared/units";
import { bodyAppearance, describeBody, moonsOf, radiusEarth, SUN_BODIES, type SolarBody } from "@/app/solar-system/bodies";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { shapeGrid } from "@/app/solar-system/shapes";
import { smallMoonsOf, type SmallMoon } from "@/app/solar-system/smallMoons";

/**
 * One star on the map, kept as a compact tuple because the browser loads all of
 * them at once. Positions are in parsecs and the temperature is in kelvin.
 */
export type MapStar = [
  slug: string,
  name: string,
  x: number,
  y: number,
  z: number,
  teffK: number | null,
  planetCount: number,
];

/** The response body of GET /map/stars. */
export interface MapStarsPayload {
  stars: MapStar[];
}

/** The response body of GET /map/systems/[slug]. */
export interface MapSystemPayload {
  star: {
    slug: string;
    name: string;
    isSun: boolean;
    teffK: number | null;
    radiusSun: number | null;
    massSun: number | null;
    distPc: number | null;
  };
  planets: MapPlanet[];
}

export interface MapPlanet {
  slug: string;
  name: string;
  /** A short label such as "Super-Earth, temperate". */
  description: string;
  /** The page of the planet or dwarf planet. */
  href: string;
  orbitalPeriodDays: number | null;
  semiMajorAxisAu: number | null;
  eccentricity: number | null;
  radiusEarth: number | null;
  /** The same appearance as on the planet's own page. */
  globe: GlobeSpec;
  /** The moons with a page of their own, from the inside out. Only bodies of the solar system have them. */
  moons: MapMoon[];
  /** The small moons, drawn together as points; empty outside the solar system. */
  smallMoons: MapSmallMoon[];
  /** The shape of an irregular body, or null for a sphere. */
  shape: MapShape | null;
}

/** Where to find an irregular body's radius grid (scripts/shapes.ts) and how to draw it. */
export interface MapShape {
  url: string;
  /** The grid's largest radius in radii of the sphere of the same volume, which is what `size` measures. */
  maxRadius: number;
  /** Whether a surface map exists; without one the body is drawn in its colour alone. */
  map: boolean;
  /** Whether it tumbles instead of turning one face to its planet. */
  tumbling: boolean;
}

/**
 * A small moon as a compact tuple, as there are hundreds: semi-major axis in km, eccentricity,
 * inclination, ascending node, argument of periapsis and mean anomaly in degrees, period in days, radius
 * in km (0 if unknown), and 1 if the elements refer to the ecliptic rather than the planet's equator.
 */
export type MapSmallMoon = [
  name: string,
  aKm: number,
  e: number,
  iDeg: number,
  nodeDeg: number,
  periDeg: number,
  meanAnomalyDeg: number,
  periodDays: number,
  radiusKm: number,
  ecliptic: 0 | 1,
];

export interface MapMoon {
  slug: string;
  name: string;
  href: string;
  semiMajorAxisKm: number;
  orbitalPeriodDays: number;
  eccentricity: number;
  /** Above 90 degrees the moon orbits backwards. */
  inclinationDeg: number;
  /** Whether the inclination is measured against the ecliptic instead of the planet's equator. */
  ecliptic: boolean;
  radiusKm: number;
  globe: GlobeSpec;
  shape: MapShape | null;
}

export interface StarRow {
  slug: string;
  name: string;
  x: number;
  y: number;
  z: number;
  teffK: number | null;
  planetCount: number;
}

export interface SystemStarRow {
  slug: string;
  name: string;
  source: "nasa" | "sol";
  teffK: number | null;
  radiusSun: number | null;
  massSun: number | null;
  distPc: number | null;
}

export interface SystemPlanetRow {
  slug: string;
  name: string;
  source: "nasa" | "sol";
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
  orbitalPeriodDays: number | null;
  semiMajorAxisAu: number | null;
  eccentricity: number | null;
  radiusEarth: number | null;
  eqTempK: number | null;
  densityEarth: number | null;
}

/** Three decimals (a thousandth of a parsec) are far finer than the measurements and keep the payload small. */
const round = (value: number) => Math.round(value * 1000) / 1000;

export function toMapStar(row: StarRow): MapStar {
  return [
    row.slug,
    row.name,
    round(row.x),
    round(row.y),
    round(row.z),
    row.teffK === null ? null : Math.round(row.teffK),
    row.planetCount,
  ];
}

export function toMapSystem(star: SystemStarRow, planets: SystemPlanetRow[]): MapSystemPayload {
  const isSun = star.source === "sol";
  const listed: MapPlanet[] = planets.map((planet) => ({
    slug: planet.slug,
    name: planet.name,
    description: describePlanet(planet.planetClass, planet.climateClass),
    href: `/planets/${planet.slug}`,
    orbitalPeriodDays: planet.orbitalPeriodDays,
    semiMajorAxisAu: planet.semiMajorAxisAu,
    eccentricity: planet.eccentricity,
    radiusEarth: planet.radiusEarth,
    globe: planetAppearance({
      slug: planet.slug,
      source: planet.source,
      planetClass: planet.planetClass,
      climateClass: planet.climateClass,
      starTeffK: star.teffK,
      radiusEarth: planet.radiusEarth,
      eqTempK: planet.eqTempK,
      densityEarth: planet.densityEarth,
      orbitalPeriodDays: planet.orbitalPeriodDays,
    }).globe,
    moons: planet.source === "sol" ? moonsOf(planet.slug).map(toMapMoon) : [],
    smallMoons: planet.source === "sol" ? smallMoonsOf(planet.slug).map(toMapSmallMoon) : [],
    shape: null,
  }));
  // The dwarf planets join the planets in the order of their orbits.
  const dwarfs: MapPlanet[] = isSun
    ? SUN_BODIES.map((body) => ({
        slug: body.slug,
        name: body.name,
        description: describeBody(body),
        href: `/solar-system/${body.slug}`,
        orbitalPeriodDays: body.orbitalPeriodDays,
        semiMajorAxisAu: body.semiMajorAxisKm / AU_KM,
        eccentricity: body.eccentricity,
        radiusEarth: radiusEarth(body),
        globe: bodyAppearance(body).globe,
        moons: moonsOf(body.slug).map(toMapMoon),
        smallMoons: smallMoonsOf(body.slug).map(toMapSmallMoon),
        shape: toMapShape(body),
      }))
    : [];
  return {
    star: {
      slug: star.slug,
      name: star.name,
      isSun,
      teffK: star.teffK,
      radiusSun: star.radiusSun,
      massSun: star.massSun,
      distPc: star.distPc,
    },
    planets: dwarfs.length > 0 ? [...listed, ...dwarfs].sort(byPeriod) : listed,
  };
}

function byPeriod(a: MapPlanet, b: MapPlanet): number {
  return (a.orbitalPeriodDays ?? Infinity) - (b.orbitalPeriodDays ?? Infinity);
}

function toMapMoon(body: SolarBody): MapMoon {
  return {
    slug: body.slug,
    name: body.name,
    href: `/solar-system/${body.slug}`,
    semiMajorAxisKm: body.semiMajorAxisKm,
    orbitalPeriodDays: body.orbitalPeriodDays,
    eccentricity: body.eccentricity,
    inclinationDeg: body.inclinationDeg,
    ecliptic: body.ecliptic === true,
    radiusKm: body.radiusKm,
    globe: bodyAppearance(body).globe,
    shape: toMapShape(body),
  };
}

/** The shape of a body drawn from its shape model, measured against the sphere of the same volume. */
function toMapShape(body: SolarBody): MapShape | null {
  const grid = body.shape ? shapeGrid(body.slug) : null;
  if (!grid) return null;
  return {
    url: `/shapes/${body.slug}.bin`,
    maxRadius: Math.round((grid.maxRadiusKm / grid.meanRadiusKm) * 10000) / 10000,
    map: body.slug in MAP_SOURCES,
    tumbling: body.tumbling === true,
  };
}

/** One decimal of a degree and of a kilometre is finer than anything the map can show. */
const tenth = (value: number) => Math.round(value * 10) / 10;

function toMapSmallMoon(moon: SmallMoon): MapSmallMoon {
  return [
    moon.name,
    Math.round(moon.a),
    Math.round(moon.e * 10000) / 10000,
    tenth(moon.i),
    tenth(moon.node),
    tenth(moon.peri),
    tenth(moon.M),
    Math.round(moon.period * 1000) / 1000,
    tenth(moon.radius ?? 0),
    moon.plane === "ecliptic" ? 1 : 0,
  ];
}
