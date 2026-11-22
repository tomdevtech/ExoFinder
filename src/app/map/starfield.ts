import { seededRandom } from "@/shared/math";
import {
  BULGE_HEIGHT,
  BULGE_WIDTH,
  GALACTIC_CENTRE,
  GALAXY_EDGE,
  GALAXY_PICTURE_WIDTH,
  starColor,
} from "./galaxy";

/**
 * Generates the background stars procedurally. Space is split into cells per
 * luminosity class, and each cell's stars are derived from its coordinates, so they
 * are the same on every visit. Lengths are parsecs in map coordinates (galaxy.ts).
 */

export interface StarClass {
  name: string;
  /** The luminosity range of the class, in solar luminosities. */
  light: [number, number];
  /** The surface temperature range in kelvin; a `hot.share` fraction of stars uses `hot.teff` instead. */
  teff: [number, number];
  hot?: { share: number; teff: [number, number] };
  /** The number of stars per cubic parsec in the galactic plane near the Sun. */
  density: number;
  /** The vertical scale height in parsecs. */
  height: number;
  /** The distance from the camera, in parsecs, up to which stars of this class are generated. */
  reach: number;
  /**
   * Whether the sky photograph already shows these stars near the Sun. Generated
   * stars of such a class only fade in as the photograph fades, to avoid duplicates.
   */
  photographed: boolean;
}

/**
 * Together the classes give about 0.1 stars per cubic parsec near the Sun, mostly
 * red dwarfs. Reach grows with the square root of luminosity, so the faintest star
 * of every class has about the same apparent brightness where its class ends.
 */
export const STAR_CLASSES: readonly StarClass[] = [
  { name: "red dwarfs", light: [0.004, 0.08], teff: [2700, 3800], density: 0.075, height: 300, reach: 20, photographed: false },
  { name: "suns", light: [0.1, 1.6], teff: [4400, 6400], density: 0.02, height: 300, reach: 80, photographed: false },
  { name: "bright stars", light: [2, 40], teff: [6500, 10000], density: 0.0035, height: 150, reach: 220, photographed: true },
  {
    name: "giants",
    light: [40, 600],
    teff: [3600, 5000],
    hot: { share: 0.15, teff: [10000, 18000] },
    density: 0.00022,
    height: 280,
    reach: 650,
    photographed: true,
  },
  {
    name: "supergiants",
    light: [2000, 120000],
    teff: [3400, 4200],
    hot: { share: 0.65, teff: [15000, 32000] },
    density: 0.0000007,
    height: 90,
    reach: 4000,
    photographed: true,
  },
];

/** The number of cells that a class's reach spans. */
export const CELLS_PER_REACH = 3;

/** The maximum number of stars per class at once. In crowded regions the reach shrinks instead. */
export const STARS_PER_CLASS = 50_000;

/** Caps the stars per cell so that one very dense cell cannot exhaust the budget. */
const STARS_PER_CELL = 6000;

/** Returns the edge length of the class's cells in parsecs. */
export function cellSize(starClass: StarClass): number {
  return starClass.reach / CELLS_PER_REACH;
}

/** Returns the relative stellar density of the galactic plane at (x, y), where 1 is the solar neighbourhood. */
export type Plan = (x: number, y: number) => number;

/** A fallback plan without spiral arms: an exponential disc with a 2,600 pc scale length plus a bulge. */
export const SMOOTH_PLAN: Plan = (x, y) => {
  const fromCentre = Math.hypot(x - GALACTIC_CENTRE[0], y - GALACTIC_CENTRE[1]);
  if (fromCentre > GALAXY_EDGE) return 0;
  const disc = Math.exp(-(fromCentre - GALACTIC_CENTRE[0]) / 2600);
  const bulge = 6 * Math.exp(-((fromCentre / BULGE_WIDTH) ** 2));
  return disc + bulge;
};

/**
 * Builds a plan from a `size` × `size` brightness grid of the artist's impression,
 * stored row by row from the top. The result is 1 at the Sun and clamped to
 * [0.05, 40], so gaps never become completely empty and the core never explodes.
 */
export function planFromPicture(brightness: Float32Array, size: number): Plan {
  const at = (x: number, y: number) => {
    // In the picture the galactic centre is up and galactic longitude 90 degrees is to the left.
    const column = (0.5 - y / GALAXY_PICTURE_WIDTH) * size - 0.5;
    const row = (0.5 - (x - GALACTIC_CENTRE[0]) / GALAXY_PICTURE_WIDTH) * size - 0.5;
    if (column < 0 || row < 0 || column > size - 1 || row > size - 1) return 0;
    const c = Math.floor(column);
    const r = Math.floor(row);
    const fc = column - c;
    const fr = row - r;
    const c1 = Math.min(size - 1, c + 1);
    const r1 = Math.min(size - 1, r + 1);
    const top = brightness[r * size + c] * (1 - fc) + brightness[r * size + c1] * fc;
    const bottom = brightness[r1 * size + c] * (1 - fc) + brightness[r1 * size + c1] * fc;
    return top * (1 - fr) + bottom * fr;
  };
  // The Sun sits in a dark gap of the picture, so we normalise to the mean
  // brightness within about 300 pc instead of the single pixel at the Sun.
  let sun = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) sun += at(dx * 300, dy * 300);
  sun = Math.max(sun / 9, 1e-4);
  return (x, y) => {
    const fromCentre = Math.hypot(x - GALACTIC_CENTRE[0], y - GALACTIC_CENTRE[1]);
    if (fromCentre > GALAXY_EDGE) return 0;
    return Math.min(40, Math.max(0.05, at(x, y) / sun));
  };
}

/** Returns the class's scale height at `fromCentre` parsecs from the centre, which grows in the bulge. */
function thickness(starClass: StarClass, fromCentre: number): number {
  return starClass.height + BULGE_HEIGHT * Math.exp(-((fromCentre / BULGE_WIDTH) ** 2));
}

/**
 * Returns how far the class is generated around a point. In crowded regions the
 * reach shrinks to stay within `STARS_PER_CLASS`, and the galaxy glow fills in beyond.
 */
export function reachAt(starClass: StarClass, plan: Plan, x: number, y: number, z: number): number {
  const reach = starClass.reach;
  const fromCentre = Math.hypot(x - GALACTIC_CENTRE[0], y - GALACTIC_CENTRE[1]);
  const height = thickness(starClass, fromCentre);
  const above = Math.abs(z);
  // Far above the disc the reach barely touches any stars, so no limit is needed.
  if (above > reach + 4 * height) return reach;
  const depth = Math.min(2 * reach, 2 * height);
  const expected = starClass.density * plan(x, y) * Math.PI * reach * reach * depth * Math.exp(-above / height);
  if (expected <= STARS_PER_CLASS) return reach;
  return reach * Math.sqrt(STARS_PER_CLASS / expected);
}

export interface CellStars {
  /** Seven floats per star: x, y, z, red, green, blue and luminosity in suns. */
  data: Float32Array;
  count: number;
}

export function cellKey(classIndex: number, ix: number, iy: number, iz: number): string {
  return `${classIndex}:${ix}:${iy}:${iz}`;
}

/** Returns the indices of the class's cells that lie at least partly within `reach` of a point, nearest first. */
export function cellsAround(classIndex: number, reach: number, x: number, y: number, z: number): [number, number, number][] {
  const size = cellSize(STAR_CLASSES[classIndex]);
  const cx = Math.floor(x / size);
  const cy = Math.floor(y / size);
  const cz = Math.floor(z / size);
  const span = Math.ceil(reach / size);
  const corner = size * Math.sqrt(3) * 0.5;
  const cells: { cell: [number, number, number]; distance: number }[] = [];
  for (let ix = cx - span; ix <= cx + span; ix++) {
    for (let iy = cy - span; iy <= cy + span; iy++) {
      for (let iz = cz - span; iz <= cz + span; iz++) {
        const distance = Math.hypot((ix + 0.5) * size - x, (iy + 0.5) * size - y, (iz + 0.5) * size - z);
        if (distance <= reach + corner) cells.push({ cell: [ix, iy, iz], distance });
      }
    }
  }
  cells.sort((a, b) => a.distance - b.distance);
  return cells.map((item) => item.cell);
}

/** Derives a seed from the class and cell indices with an FNV-1a style hash. */
function cellSeed(classIndex: number, ix: number, iy: number, iz: number): number {
  let h = 0x811c9dc5 ^ classIndex;
  for (const value of [ix, iy, iz]) {
    h = Math.imul(h ^ (value & 0xffff), 0x01000193);
    h = Math.imul(h ^ ((value >>> 16) & 0xffff), 0x01000193);
  }
  return h >>> 0;
}

/** Draws a Poisson-distributed count with the given mean. */
function countAround(mean: number, rand: () => number): number {
  if (mean <= 0) return 0;
  if (mean > 40) {
    // For large means a normal approximation is accurate enough and avoids a long loop.
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.max(0, Math.round(mean + Math.sqrt(mean) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
  }
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rand();
  while (p > limit) {
    k++;
    p *= rand();
  }
  return k;
}

/**
 * Generates the stars of a cell; the same cell and plan always give the same stars.
 * The plan is only sampled inside the cell, so a finer plan changes stars only where it differs.
 */
export function cellStars(classIndex: number, ix: number, iy: number, iz: number, plan: Plan): CellStars {
  const starClass = STAR_CLASSES[classIndex];
  const size = cellSize(starClass);
  const rand = seededRandom(cellSeed(classIndex, ix, iy, iz));
  const x0 = ix * size;
  const y0 = iy * size;
  const z0 = iz * size;
  const fromCentre = Math.hypot(x0 + size / 2 - GALACTIC_CENTRE[0], y0 + size / 2 - GALACTIC_CENTRE[1]);
  const height = thickness(starClass, fromCentre);

  // The densest of the corners and the centre bounds the cell for rejection sampling.
  let crowded = 0;
  for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
    crowded = Math.max(crowded, plan(x0 + fx * size, y0 + fy * size));
  }
  if (crowded <= 0) return { data: new Float32Array(0), count: 0 };
  // `below` is the signed cumulative share of the exponential disc up to height z,
  // so `share` is the fraction of the disc's stars between the cell's bottom and top.
  const below = (z: number) => (z < 0 ? -1 : 1) * (1 - Math.exp(-Math.abs(z) / height));
  const share = Math.abs(below(z0 + size) - below(z0)) / 2;
  const mean = starClass.density * crowded * size * size * 2 * height * share;
  const candidates = Math.min(STARS_PER_CELL * 2, countAround(mean, rand));

  const data = new Float32Array(Math.min(candidates, STARS_PER_CELL) * 7);
  let count = 0;
  const [lightLow, lightHigh] = starClass.light;
  for (let n = 0; n < candidates && count < STARS_PER_CELL; n++) {
    const x = x0 + rand() * size;
    const y = y0 + rand() * size;
    // The height is drawn by inverting the exponential profile within the cell.
    const a = below(z0);
    const b = below(z0 + size);
    const t = a + (b - a) * rand();
    const z = (t < 0 ? -1 : 1) * -height * Math.log(1 - Math.min(Math.abs(t), 0.999999));
    const keep = rand();
    const light = lightLow * (lightHigh / lightLow) ** (rand() ** 1.6);
    const hot = starClass.hot && rand() < starClass.hot.share;
    const [low, high] = hot && starClass.hot ? starClass.hot.teff : starClass.teff;
    const teff = low + (high - low) * rand();
    // Rejecting against the plan thins out the gaps between the arms. All random
    // numbers are drawn before this test, so the sequence does not depend on the plan.
    if (keep > plan(x, y) / crowded) continue;
    const [red, green, blue] = starColor(teff);
    data.set([x, y, z, red, green, blue, light], count * 7);
    count++;
  }
  return { data: count * 7 === data.length ? data : data.slice(0, count * 7), count };
}
