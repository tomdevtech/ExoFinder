/**
 * Lays out orbits for the system view, in two scales. Real proportions are hard to read (Neptune is 80
 * times as far out as Mercury, and next to their orbits the planets are dust), so the compressed scale
 * keeps the order, shape and relative speed of the orbits while it squeezes distances and enlarges the
 * planets. The true scale keeps every distance and size as it is, with TRUE_AU view units to the AU.
 */

import { AU_KM, EARTH_RADIUS_KM, SUN_RADIUS_KM } from "@/shared/units";

/** View units per AU in the true scale. One keeps Earth's radius (4.3e-5) far above the precision of 32-bit floats. */
export const TRUE_AU = 1;
/** View units that each doubling of the real distance adds in the compressed scale. */
export const DOUBLING_STEP = 1.6;

export interface OrbitInput {
  orbitalPeriodDays: number | null;
  semiMajorAxisAu: number | null;
  eccentricity: number | null;
  radiusEarth: number | null;
}

export interface OrbitLayout {
  /** The index of the planet in the input. */
  index: number;
  /** The semi-major axis in view units. */
  semiMajor: number;
  eccentricity: number;
  /** The angle of the point closest to the star, in radians. */
  periapsis: number;
  /** The seconds one orbit takes in the view. */
  period: number;
  /** The starting mean anomaly, from 0 to 2π. */
  phase: number;
  /** The planet radius in view units. */
  size: number;
  /** The real semi-major axis in AU, measured or derived from the period. */
  axisAu: number;
  /** The planet radius in view units in the true scale. */
  trueSize: number;
}

/** Returns the star radius in view units in the true scale. A missing radius is treated as the Sun's. */
export function trueStarSize(radiusSun: number | null): number {
  return (((radiusSun ?? 1) * SUN_RADIUS_KM) / AU_KM) * TRUE_AU;
}

/** Returns the planet radius in view units in the true scale. A missing radius is treated as two Earth radii. */
export function truePlanetSize(radiusEarth: number | null): number {
  return (((radiusEarth ?? 2) * EARTH_RADIUS_KM) / AU_KM) * TRUE_AU;
}

/**
 * Returns the star radius in view units, where the Sun is 1. Size differences are
 * compressed and clamped so that giants and dwarfs both stay readable.
 */
export function starSize(radiusSun: number | null): number {
  return Math.min(Math.max((radiusSun ?? 1) ** 0.3, 0.55), 2.2);
}

/**
 * Returns the planet radius in view units, where Earth is 0.12. A missing radius is
 * treated as two Earth radii, and the result is clamped to stay visible but not huge.
 */
export function planetSize(radiusEarth: number | null): number {
  return Math.min(Math.max(0.12 * (radiusEarth ?? 2) ** 0.45, 0.07), 0.5);
}

/** Returns the semi-major axis in AU for a period in days around a star of `massSun` solar masses (Kepler's third law). */
export function axisFromPeriod(periodDays: number, massSun: number): number {
  return Math.cbrt(massSun * (periodDays / 365.25) ** 2);
}

/** Returns the period in days for a semi-major axis in AU (Kepler's third law). */
export function periodFromAxis(axisAu: number, massSun: number): number {
  return 365.25 * Math.sqrt(axisAu ** 3 / massSun);
}

/**
 * Returns the seconds an orbit of `periodDays` takes in the view. Real periods range from hours to
 * centuries, so they are compressed; longer periods still take longer.
 */
export function viewPeriod(periodDays: number): number {
  return Math.min(Math.max(6 * (periodDays / 10) ** 0.4, 3), 240);
}

/**
 * Returns the seconds a moon's orbit of `periodDays` takes in the view. Moons run on their own, gentler
 * compression, so that the innermost do not race and the far captured ones still move.
 */
export function moonViewPeriod(periodDays: number): number {
  return Math.min(Math.max(8 * periodDays ** 0.4, 6), 120);
}

/** Solves Kepler's equation M = E − e·sin E for the eccentric anomaly E with Newton's method. */
export function solveKepler(meanAnomaly: number, eccentricity: number): number {
  // For high eccentricities, starting at π keeps Newton's method from diverging.
  let E = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let i = 0; i < 12; i++) {
    const step = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-9) break;
  }
  return E;
}

/** Returns the position in the orbital plane with the star at the origin; a `meanAnomaly` of 0 is the periapsis. */
export function orbitPoint(
  semiMajor: number,
  eccentricity: number,
  periapsis: number,
  meanAnomaly: number,
): [number, number] {
  const E = solveKepler(meanAnomaly % (2 * Math.PI), eccentricity);
  const x = semiMajor * (Math.cos(E) - eccentricity);
  const y = semiMajor * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E);
  const cos = Math.cos(periapsis);
  const sin = Math.sin(periapsis);
  return [x * cos - y * sin, x * sin + y * cos];
}

/** Hashes two integers to a number in [0, 1) that is always the same for the same inputs. */
function scatter(seed: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * Lays out a system's orbits, sorted from the inside out. A missing axis or period
 * is derived from the other, and planets with neither are placed outermost. The
 * `seed` keeps periapses and phases the same on every visit.
 */
export function layoutOrbits(
  planets: OrbitInput[],
  star: { massSun: number | null; radiusSun: number | null },
  seed = 1,
): OrbitLayout[] {
  const mass = star.massSun && star.massSun > 0 ? star.massSun : 1;

  const known = planets.map((planet, index) => {
    const period = positive(planet.orbitalPeriodDays);
    const axis = knownAxisAu(planet, mass);
    return { planet, index, axis, period: period ?? (axis ? periodFromAxis(axis, mass) : null) };
  });

  // Planets without any orbit data are placed beyond the outermost known one.
  let outermost = Math.max(0, ...known.map((entry) => entry.axis ?? 0));
  const placed = known
    .map((entry) => {
      if (entry.axis !== null && entry.period !== null) {
        return { ...entry, axis: entry.axis, period: entry.period };
      }
      outermost = outermost > 0 ? outermost * 1.6 : 1;
      return { ...entry, axis: outermost, period: periodFromAxis(outermost, mass) };
    })
    .sort((a, b) => a.axis - b.axis);

  const layouts: OrbitLayout[] = [];
  let previousAxis = 0;
  let previousRadius = 0;
  let previousSize = 0;

  for (const entry of placed) {
    const size = planetSize(entry.planet.radiusEarth);
    // Eccentricity is capped so that extreme orbits do not stretch the whole layout.
    const eccentricity = Math.min(Math.max(entry.planet.eccentricity ?? 0, 0), 0.75);
    let semiMajor: number;
    if (layouts.length === 0) {
      // The innermost orbit's closest point must stay clear of the star.
      semiMajor = (starSize(star.radiusSun) + 0.7 + size) / (1 - eccentricity);
    } else {
      // Each doubling of the real distance adds one fixed step, so spacing is
      // logarithmic. Steps are at least wide enough to avoid overlap and at most 4 units.
      const wanted = DOUBLING_STEP * Math.log2(entry.axis / previousAxis);
      const smallest = previousSize + size + 0.3;
      semiMajor = previousRadius + Math.min(Math.max(wanted, smallest), 4);
    }
    layouts.push({
      index: entry.index,
      semiMajor,
      eccentricity,
      periapsis: scatter(seed, entry.index * 2) * 2 * Math.PI,
      period: viewPeriod(entry.period),
      phase: scatter(seed, entry.index * 2 + 1) * 2 * Math.PI,
      size,
      axisAu: entry.axis,
      trueSize: truePlanetSize(entry.planet.radiusEarth),
    });
    previousAxis = entry.axis;
    previousRadius = semiMajor;
    previousSize = size;
  }
  return layouts;
}

/**
 * Returns the view radius at a real distance from the star, following the same compression as the orbits:
 * between two planets it is interpolated by the logarithm of the distance, and beyond the outermost one
 * each doubling adds 1.6 units, as in `layoutOrbits`. Inside the innermost orbit it is proportional.
 * `layouts` must be sorted from the inside out, as `layoutOrbits` returns them.
 */
export function viewRadius(layouts: OrbitLayout[], au: number): number {
  if (layouts.length === 0) return au;
  const first = layouts[0];
  if (au <= first.axisAu) return (first.semiMajor * au) / first.axisAu;
  for (let i = 1; i < layouts.length; i++) {
    const inner = layouts[i - 1];
    const outer = layouts[i];
    if (au <= outer.axisAu) {
      const share = Math.log(au / inner.axisAu) / Math.log(outer.axisAu / inner.axisAu);
      return inner.semiMajor + (outer.semiMajor - inner.semiMajor) * (Number.isFinite(share) ? share : 1);
    }
  }
  const last = layouts[layouts.length - 1];
  return last.semiMajor + DOUBLING_STEP * Math.log2(au / last.axisAu);
}

/**
 * Like `viewRadius`, but for what may lie inside the innermost orbit, such as the habitable zone of a
 * star whose only known planet is far out. The compressed scale enlarges the star, so a proportional
 * radius would land inside it; here the star's surface is one more knot, and distances between it and the
 * innermost orbit are interpolated by their logarithm. A star without planets gets 1.6 units per doubling
 * from its surface.
 */
export function viewRadiusOutsideStar(layouts: OrbitLayout[], radiusSun: number | null, au: number): number {
  const first = layouts[0];
  if (first && au >= first.axisAu) return viewRadius(layouts, au);
  const surface = starSize(radiusSun);
  const surfaceAu = trueStarSize(radiusSun) / TRUE_AU;
  if (au <= surfaceAu) return surface;
  if (!first) return surface + DOUBLING_STEP * Math.log2(au / surfaceAu);
  return surface + ((first.semiMajor - surface) * Math.log(au / surfaceAu)) / Math.log(first.axisAu / surfaceAu);
}

/**
 * Returns a planet's semi-major axis in AU: the measured one, or the one its period gives around a star of
 * `massSun` solar masses, or null if neither is known. `layoutOrbits` places planets by the same rule.
 */
export function knownAxisAu(planet: Pick<OrbitInput, "semiMajorAxisAu" | "orbitalPeriodDays">, massSun: number | null): number | null {
  const period = positive(planet.orbitalPeriodDays);
  return positive(planet.semiMajorAxisAu) ?? (period ? axisFromPeriod(period, positive(massSun) ?? 1) : null);
}

export interface MoonInput {
  semiMajorAxisKm: number;
  orbitalPeriodDays: number;
  eccentricity: number;
  radiusKm: number;
}

export interface MoonLayout {
  /** The index of the moon in the input. */
  index: number;
  /** The semi-major axis in radii of the planet, as it really is. */
  distance: number;
  /** The moon's radius in radii of the planet, as it really is. */
  size: number;
  /** The semi-major axis in radii of the planet in the compressed scale. */
  compressedDistance: number;
  /** The moon's radius in radii of the planet in the compressed scale. */
  compressedSize: number;
  eccentricity: number;
  periapsis: number;
  /** The seconds one orbit takes in the view. */
  period: number;
  phase: number;
}

/** Returns a moon's radius in view units of the compressed scale, with a smaller floor than planets have. */
export function moonSize(radiusKm: number): number {
  return Math.min(Math.max(0.12 * (radiusKm / EARTH_RADIUS_KM) ** 0.45, 0.02), 0.2);
}

/**
 * Lays out the large moons of a planet, in both scales and measured in radii of the planet. The true scale
 * keeps their real distances and sizes: Callisto 27 Jupiter radii out, the Moon 60 Earth radii. In the
 * compressed scale the planets are enlarged a thousandfold while their orbits are squeezed, so moon systems
 * at their real distances would reach past the star; there the moons start just outside the planet and its
 * rings (`planet.reach`, in radii) and each doubling of the real distance adds one radius, much as for the
 * planets. Either way they keep their order, and their periods are compressed alike.
 */
export function layoutMoons(
  moons: MoonInput[],
  planet: { radiusKm: number; size: number; reach: number },
  seed = 1,
): MoonLayout[] {
  const order = moons.map((moon, index) => ({ moon, index })).sort((a, b) => a.moon.semiMajorAxisKm - b.moon.semiMajorAxisKm);
  const layouts: MoonLayout[] = [];
  let previous: { axisKm: number; distance: number; size: number } | null = null;
  for (const { moon, index } of order) {
    const size = moonSize(moon.radiusKm) / planet.size;
    let distance: number;
    if (!previous) {
      // How far beyond the planet and its rings the moon really is, in doublings.
      const beyond = Math.max(0, Math.log2(moon.semiMajorAxisKm / (planet.radiusKm * planet.reach)));
      distance = planet.reach + 0.5 + 0.35 * beyond + size;
    } else {
      const wanted = Math.log2(moon.semiMajorAxisKm / previous.axisKm);
      distance = previous.distance + Math.max(wanted, previous.size + size + 0.04 / planet.size);
    }
    layouts.push({
      index,
      distance: moon.semiMajorAxisKm / planet.radiusKm,
      size: moon.radiusKm / planet.radiusKm,
      compressedDistance: distance,
      compressedSize: size,
      eccentricity: Math.min(Math.max(moon.eccentricity, 0), 0.9),
      periapsis: scatter(seed, index * 2) * 2 * Math.PI,
      period: moonViewPeriod(moon.orbitalPeriodDays),
      phase: scatter(seed, index * 2 + 1) * 2 * Math.PI,
    });
    previous = { axisKm: moon.semiMajorAxisKm, distance, size };
  }
  return layouts;
}

/**
 * Returns the compressed distance, in radii of the planet, of a small moon that is `distance` radii out,
 * so that the small moons squeeze the way the large ones do: between two large moons by the logarithm of
 * the distance, inside the innermost in proportion, and beyond the outermost one radius per doubling.
 * `layouts` must be sorted from the inside out, as `layoutMoons` returns them.
 */
export function compressedMoonDistance(layouts: MoonLayout[], distance: number): number {
  if (layouts.length === 0) return distance;
  const first = layouts[0];
  if (distance <= first.distance) return (first.compressedDistance * distance) / first.distance;
  for (let i = 1; i < layouts.length; i++) {
    const inner = layouts[i - 1];
    const outer = layouts[i];
    if (distance <= outer.distance) {
      const share = Math.log(distance / inner.distance) / Math.log(outer.distance / inner.distance);
      return inner.compressedDistance + (outer.compressedDistance - inner.compressedDistance) * (Number.isFinite(share) ? share : 1);
    }
  }
  const last = layouts[layouts.length - 1];
  return last.compressedDistance + Math.log2(distance / last.distance);
}

function positive(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}
