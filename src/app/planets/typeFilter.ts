import { firstParam, type Param } from "@/shared/params";
import type { ClimateClass, PlanetClass } from "./classify";
import { CLIMATE_CLASS_ORDER, PLANET_CLASS_ORDER } from "./labels";

/**
 * The kind of planet a list is narrowed to, from `?type=` and `?climate=`. Either part may be left open.
 * Only planets have a class and a climate: a filtered search lists no stars and no moons.
 */
export interface TypeFilter {
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
}

export const NO_FILTER: TypeFilter = { planetClass: null, climateClass: null };

/** Reads the filter from the address. Anything but a known class or climate leaves that part open. */
export function parseTypeFilter(type: Param, climate: Param): TypeFilter {
  const wantedClass = firstParam(type);
  const wantedClimate = firstParam(climate);
  return {
    planetClass: PLANET_CLASS_ORDER.find((planetClass) => planetClass === wantedClass) ?? null,
    climateClass: CLIMATE_CLASS_ORDER.find((climateClass) => climateClass === wantedClimate) ?? null,
  };
}

export function isFiltered(filter: TypeFilter): boolean {
  return filter.planetClass !== null || filter.climateClass !== null;
}
