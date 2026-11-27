import { formatNumber, parsecToLightYears } from "@/shared/format";
import { SOLAR_SEQUENCE, type BrowseEntry } from "./order";
import type { ExoplanetNeighbours, ExoplanetStart, OrderedExoplanet } from "./queries";

/** A link to a neighbour in the catalogue. */
export interface Step extends BrowseEntry {
  /** Where the step leads when it leaves the system of the current body, otherwise null. */
  system: string | null;
}

/** Where a body stands in the catalogue, and where the links around it lead. */
export interface Place {
  /** The number of the body, counted from Mercury. */
  position: number;
  /** The number of bodies in the catalogue, or null while the number of exoplanets is not known. */
  total: number | null;
  previous: Step | null;
  next: Step | null;
  /**
   * The nearest body before and after that orbits the star itself, where the plain step leads to a moon:
   * Saturn alone has almost 300 of them between itself and Uranus.
   */
  skipBack: Step | null;
  skipAhead: Step | null;
}

const SOLAR_SYSTEM = "Solar system";

function systemLabel(planet: OrderedExoplanet): string {
  return planet.distPc !== null && planet.distPc > 0
    ? `${planet.starName} · ${formatNumber(parsecToLightYears(planet.distPc))} light-years`
    : planet.starName;
}

function toExoplanet(planet: OrderedExoplanet, leavesSystem: boolean): Step {
  return { href: `/planets/${planet.slug}`, name: planet.name, system: leavesSystem ? systemLabel(planet) : null };
}

const within = ({ href, name }: BrowseEntry): Step => ({ href, name, system: null });

/**
 * The place of a body of the solar system, or null for an address that is not one. `start` is where the
 * exoplanets begin; without it the total and the step past the last moon of Pluto stay unknown, which
 * lets the pages of the solar system show their links before the database has answered.
 */
export function solarPlace(href: string, start: ExoplanetStart | null): Place | null {
  const index = SOLAR_SEQUENCE.findIndex((entry) => entry.href === href);
  if (index < 0) return null;
  const beyond = start?.first ? toExoplanet(start.first, true) : null;
  const before = SOLAR_SEQUENCE.slice(0, index).findLast((entry) => entry.orbitsSun);
  const after = SOLAR_SEQUENCE.slice(index + 1).find((entry) => entry.orbitsSun);
  const previous = index > 0 ? within(SOLAR_SEQUENCE[index - 1]) : null;
  const next = index + 1 < SOLAR_SEQUENCE.length ? within(SOLAR_SEQUENCE[index + 1]) : beyond;
  const skipBack = before ? within(before) : null;
  const skipAhead = after ? within(after) : beyond;
  return {
    position: index + 1,
    total: start ? SOLAR_SEQUENCE.length + start.total : null,
    previous,
    next,
    skipBack: skipBack?.href === previous?.href ? null : skipBack,
    skipAhead: skipAhead?.href === next?.href ? null : skipAhead,
  };
}

/** The place of an exoplanet. The solar system comes first, so the first exoplanet follows its last body. */
export function exoplanetPlace({ planet, previous, next, total }: ExoplanetNeighbours): Place {
  const last = SOLAR_SEQUENCE[SOLAR_SEQUENCE.length - 1];
  return {
    position: SOLAR_SEQUENCE.length + planet.position,
    total: SOLAR_SEQUENCE.length + total,
    previous: previous
      ? toExoplanet(previous, previous.starSlug !== planet.starSlug)
      : { href: last.href, name: last.name, system: SOLAR_SYSTEM },
    next: next ? toExoplanet(next, next.starSlug !== planet.starSlug) : null,
    skipBack: null,
    skipAhead: null,
  };
}
