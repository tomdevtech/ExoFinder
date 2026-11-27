import { moonsOf, SUN_BODIES } from "@/app/solar-system/bodies";
import { SOLAR_SYSTEM_PLANETS } from "@/app/solar-system/data";
import { smallMoonsOf } from "@/app/solar-system/smallMoons";
import { AU_KM } from "@/shared/units";

/** One body of the catalogue, as a link to its page names it. */
export interface BrowseEntry {
  /** The address of its page, without a language. */
  href: string;
  name: string;
}

export interface SolarEntry extends BrowseEntry {
  slug: string;
  /** True for a body that orbits the Sun itself: a planet, a dwarf planet or Vesta. */
  orbitsSun: boolean;
}

/**
 * The solar system in the order the catalogue is browsed in: the bodies that orbit the Sun from the inside
 * out, each followed by its large moons and then its small ones, both from the inside out. The exoplanets
 * follow by the distance of their star (queries.ts), so this list is also where the catalogue starts.
 */
export const SOLAR_SEQUENCE: SolarEntry[] = [
  ...SOLAR_SYSTEM_PLANETS.map((planet) => ({
    slug: planet.slug,
    name: planet.name,
    href: `/planets/${planet.slug}`,
    axisKm: planet.semiMajorAxisAu * AU_KM,
  })),
  ...SUN_BODIES.map((body) => ({
    slug: body.slug,
    name: body.name,
    href: `/solar-system/${body.slug}`,
    axisKm: body.semiMajorAxisKm,
  })),
]
  .sort((a, b) => a.axisKm - b.axisKm)
  .flatMap(({ slug, name, href }) => [
    { slug, href, name, orbitsSun: true },
    ...[...moonsOf(slug), ...smallMoonsOf(slug)].map((moon) => ({
      slug: moon.slug,
      href: `/solar-system/${moon.slug}`,
      name: moon.name,
      orbitsSun: false,
    })),
  ]);
