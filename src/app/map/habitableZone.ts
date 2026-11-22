/**
 * The habitable zone of a star: the distances at which a rocky planet with an atmosphere could keep
 * liquid water on its surface. The limits are those of Kopparapu et al. (2013, ApJ 765, 131) with the
 * coefficients of their 2014 update (ApJL 787, L29) for a planet of one Earth mass.
 */

export interface HabitableZone {
  /** The optimistic inner edge in AU ("recent Venus"): Venus may have had water at this much starlight. */
  optimisticInner: number;
  /** The conservative inner edge in AU ("runaway greenhouse"): closer in, the oceans boil away. */
  inner: number;
  /** The conservative outer edge in AU ("maximum greenhouse"): farther out, no amount of CO2 keeps water liquid. */
  outer: number;
  /** The optimistic outer edge in AU ("early Mars"): Mars had running water at this much starlight. */
  optimisticOuter: number;
}

export type ZonePlace = "conservative" | "optimistic";

const SUN_TEFF_K = 5772;
/** The limits are fitted for stars from 2600 K to 7200 K. */
const COOLEST_K = 2600;
const HOTTEST_K = 7200;

/**
 * The starlight at each limit in units of what Earth receives, as a polynomial in the star's temperature
 * minus 5780 K: cooler stars shine more in the infrared, which warms a planet more per watt.
 */
const LIMITS = {
  optimisticInner: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
  inner: [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15],
  outer: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
  optimisticOuter: [0.32, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16],
} as const;

/**
 * Returns the habitable zone of a star, or null if its temperature or radius is unknown: both are needed
 * for its luminosity. A star outside the fitted range of temperatures is treated as one at the nearest end.
 */
export function habitableZone(star: { teffK: number | null; radiusSun: number | null }): HabitableZone | null {
  const { teffK, radiusSun } = star;
  if (teffK === null || radiusSun === null || !(teffK > 0) || !(radiusSun > 0)) return null;
  const luminosity = radiusSun ** 2 * (teffK / SUN_TEFF_K) ** 4;
  const t = Math.min(Math.max(teffK, COOLEST_K), HOTTEST_K) - 5780;
  const distance = ([sun, a, b, c, d]: readonly number[]) =>
    Math.sqrt(luminosity / (sun + a * t + b * t ** 2 + c * t ** 3 + d * t ** 4));
  return {
    optimisticInner: distance(LIMITS.optimisticInner),
    inner: distance(LIMITS.inner),
    outer: distance(LIMITS.outer),
    optimisticOuter: distance(LIMITS.optimisticOuter),
  };
}

/** Returns which part of the zone a distance from the star lies in, or null outside it. */
export function zonePlace(zone: HabitableZone, au: number): ZonePlace | null {
  if (au >= zone.inner && au <= zone.outer) return "conservative";
  if (au >= zone.optimisticInner && au <= zone.optimisticOuter) return "optimistic";
  return null;
}
