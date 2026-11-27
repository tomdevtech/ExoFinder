import { slugify } from "@/shared/slug";
import SMALL_MOONS from "./small-moons.json";

/**
 * The small moons of the planets and of Pluto: every known one apart from the large moons of bodies.ts.
 * Orbits from JPL's mean elements, discoveries from JPL, sizes from JPL where measured and otherwise
 * estimated from the brightness or taken from Scott Sheppard's tables (see `meta` in the JSON file).
 */
export interface SmallMoon {
  /** The name as a URL segment, which is also how the map's address names the moon: "S/2004 S12" is `s-2004-s12`. */
  slug: string;
  name: string;
  parent: string;
  /** Semi-major axis in km. */
  a: number;
  e: number;
  /** Inclination, ascending node, argument of periapsis and mean anomaly at the epoch, in degrees. */
  i: number;
  node: number;
  peri: number;
  M: number;
  /** Orbital period in days. */
  period: number;
  /** The plane the elements refer to: the planet's equator (or its Laplace plane) or the ecliptic. */
  plane: "equator" | "ecliptic";
  /** Mean radius in km, or null where nothing is known yet. */
  radius: number | null;
  /** False where the radius is estimated from the brightness rather than measured. */
  measured: boolean;
  year: number | null;
  discoverer: string | null;
  group: string | null;
}

export const SMALL_MOON_LIST: SmallMoon[] = (SMALL_MOONS.moons as Omit<SmallMoon, "slug">[]).map((moon) => ({
  ...moon,
  slug: slugify(moon.name),
}));

const BY_SLUG = new Map(SMALL_MOON_LIST.map((moon) => [moon.slug, moon]));

export function smallMoon(slug: string): SmallMoon | undefined {
  return BY_SLUG.get(slug);
}

/** The small moons of a planet or dwarf planet, from the inside out. */
export function smallMoonsOf(parent: string): SmallMoon[] {
  return SMALL_MOON_LIST.filter((moon) => moon.parent === parent).sort((a, b) => a.a - b.a);
}

/** Retrograde moons orbit against the planet's rotation; most of the far, captured moons do. */
export function isRetrograde(moon: SmallMoon): boolean {
  return moon.i > 90;
}
