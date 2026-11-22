/**
 * Sample populations of the small bodies of the solar system: the asteroid belt with Jupiter's trojans
 * and the Hildas, the Kuiper belt with the scattered disc, and the Oort cloud. Each point stands for a
 * great many real objects. The distributions of orbits follow the surveys (main-belt orbits from the Minor
 * Planet Center, Kuiper-belt classes from the Deep Ecliptic Survey); the Oort cloud has never been seen,
 * so its points follow the models of its shape (an inner, flatter Hills cloud and an outer, round shell).
 */

import { seededRandom } from "@/shared/math";
import { viewPeriod } from "./orbits";

/** One body per point: its orbit, the plane of the orbit and its colour. */
export interface BeltPoints {
  count: number;
  /** Semi-major axis in AU, eccentricity, mean anomaly at time 0 in radians, and the seconds an orbit takes in the view (0 for points that stand still). */
  orbit: Float32Array;
  /** Inclination, longitude of the ascending node and argument of periapsis, in radians. */
  plane: Float32Array;
  /** Linear red, green and blue, already multiplied by the brightness. */
  color: Float32Array;
}

/** Where Jupiter is and how fast it moves in the view, so that the trojans and Hildas keep their places relative to it. */
export interface BeltOptions {
  /** Jupiter's mean longitude at time 0 in radians, in the frame of the orbits. */
  jupiterLongitude: number;
  /** The seconds Jupiter's orbit takes in the view. */
  jupiterPeriod: number;
  seed?: number;
}

/** The Kirkwood gaps: semi-major axes in AU where resonances with Jupiter have cleared the belt, and their half widths. */
export const KIRKWOOD_GAPS: [axisAu: number, halfWidthAu: number][] = [
  [2.065, 0.03], // 4:1
  [2.502, 0.025], // 3:1
  [2.825, 0.018], // 5:2
  [2.958, 0.014], // 7:3
  [3.279, 0.03], // 2:1
];

export const BELT_COUNTS = { asteroids: 6000, trojans: 1100, hildas: 250, kuiper: 4200, oort: 3000 };

/** Builds all populations into one set of points, which the map draws with a single call. */
export function solarSystemBelts({ jupiterLongitude, jupiterPeriod, seed = 1 }: BeltOptions): BeltPoints {
  const random = seededRandom(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  /** Rayleigh-distributed, which is how eccentricities and inclinations of a relaxed population spread. */
  const rayleigh = (sigma: number) => sigma * Math.sqrt(-2 * Math.log(1 - random()));
  const degrees = (value: number) => (value * Math.PI) / 180;

  const total = Object.values(BELT_COUNTS).reduce((sum, count) => sum + count, 0);
  const orbit = new Float32Array(total * 4);
  const plane = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  let index = 0;
  const add = (
    axisAu: number,
    eccentricity: number,
    inclination: number,
    tint: [number, number, number],
    brightness: number,
    options: { anomaly?: number; node?: number; periapsis?: number; period?: number } = {},
  ) => {
    const node = options.node ?? random() * 2 * Math.PI;
    const periapsis = options.periapsis ?? random() * 2 * Math.PI;
    orbit.set(
      [axisAu, eccentricity, options.anomaly ?? random() * 2 * Math.PI, options.period ?? viewPeriod(365.25 * axisAu ** 1.5)],
      index * 4,
    );
    plane.set([inclination, node, periapsis], index * 3);
    color.set(tint.map((channel) => channel * brightness), index * 3);
    index++;
  };

  // Stony S-type asteroids dominate the inner belt and dark carbon-rich C-types the outer belt.
  const stony = linear("#a8927a");
  const carbon = linear("#77736d");
  for (let placed = 0; placed < BELT_COUNTS.asteroids; ) {
    const axis = 2.1 + 1.2 * random();
    // The number of asteroids rises towards 2.7 AU and falls off beyond, and the resonances empty the gaps.
    const density = Math.exp(-(((axis - 2.7) / 0.45) ** 2)) * gapFactor(axis);
    if (random() > density) continue;
    const outer = (axis - 2.1) / 1.2;
    add(
      axis,
      Math.min(rayleigh(0.09), 0.35),
      degrees(Math.min(rayleigh(7), 30)),
      mix(stony, carbon, Math.min(1, Math.max(0, outer + 0.25 * gauss()))),
      0.55 + 0.45 * random(),
    );
    placed++;
  }

  // The trojans share Jupiter's orbit, gathered round the points 60 degrees ahead of it and behind it. They
  // take exactly Jupiter's period, or the swarms would drift away from it.
  const trojan = linear("#8a7466");
  for (let i = 0; i < BELT_COUNTS.trojans; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const node = random() * 2 * Math.PI;
    // The mean longitude is node + periapsis + anomaly. The swarms stretch along the orbit, about 25 degrees either way.
    const longitude = jupiterLongitude + side * (Math.PI / 3) + degrees(18 * gauss());
    add(5.2 + 0.08 * gauss(), Math.min(rayleigh(0.06), 0.2), degrees(Math.min(rayleigh(12), 40)), trojan, 0.5 + 0.4 * random(), {
      node,
      periapsis: 0,
      anomaly: longitude - node,
      period: jupiterPeriod,
    });
  }

  // The Hildas orbit three times for every two orbits of Jupiter, which arranges them in a triangle.
  const hilda = linear("#7d7670");
  for (let i = 0; i < BELT_COUNTS.hildas; i++) {
    const corner = Math.floor(random() * 3);
    const eccentricity = 0.12 + 0.1 * random();
    // Their aphelia lie 60, 180 and 300 degrees from Jupiter, so they turn up at the corners of the triangle.
    const perihelion = jupiterLongitude + Math.PI / 3 + (corner * 2 * Math.PI) / 3 + Math.PI;
    const node = random() * 2 * Math.PI;
    add(3.97 + 0.03 * gauss(), eccentricity, degrees(Math.min(rayleigh(8), 25)), hilda, 0.5 + 0.4 * random(), {
      node,
      periapsis: perihelion - node,
      anomaly: Math.PI + degrees(40 * gauss()),
      period: (jupiterPeriod * 2) / 3,
    });
  }

  // Kuiper belt objects are reddish or neutral grey.
  const red = linear("#b08a72");
  const grey = linear("#8e8a86");
  const kuiper = () => mix(red, grey, random());
  for (let i = 0; i < BELT_COUNTS.kuiper; i++) {
    const kind = random();
    if (kind < 0.22) {
      // Plutinos, in the 3:2 resonance with Neptune like Pluto itself, which keeps them away from Neptune
      // even where their orbits come closer to the Sun than Neptune's, as Pluto's does.
      add(39.4 + 0.15 * gauss(), 0.1 + 0.15 * random(), degrees(Math.min(rayleigh(10), 35)), kuiper(), 0.45 + 0.45 * random());
    } else if (kind < 0.55) {
      // The cold classical belt: nearly circular orbits close to the ecliptic, and markedly red.
      add(42.5 + 4.5 * random(), Math.min(rayleigh(0.04), 0.12), degrees(rayleigh(2)), red, 0.45 + 0.45 * random());
    } else if (kind < 0.8) {
      // The hot classical belt: the same distances, but stirred up.
      add(40 + 8 * random(), Math.min(rayleigh(0.08), 0.25), degrees(Math.min(rayleigh(15), 45)), kuiper(), 0.45 + 0.45 * random());
    } else if (kind < 0.83) {
      // Twotinos, in the 2:1 resonance with Neptune.
      add(47.8 + 0.2 * gauss(), 0.1 + 0.25 * random(), degrees(Math.min(rayleigh(8), 30)), kuiper(), 0.45 + 0.45 * random());
    } else {
      // The scattered disc: Neptune has flung these out, so they come back to about 30 to 38 AU.
      const axis = 50 * 3 ** random();
      const perihelion = 30 + 8 * random();
      add(axis, 1 - perihelion / axis, degrees(Math.min(rayleigh(15), 50)), kuiper(), 0.35 + 0.4 * random());
    }
  }

  // The Oort cloud takes millions of years per orbit, so its points stand still. Nobody has seen it: these
  // are icy bodies at the distances the models give, and the comets that fall in from it show its shape.
  const ice = linear("#b8c4d6");
  for (let i = 0; i < BELT_COUNTS.oort; i++) {
    // Most bodies lie in the inner Hills cloud, which is still somewhat flattened towards the ecliptic;
    // the outer cloud is a round shell out to about 100,000 AU.
    const inner = random() < 0.6;
    const distance = inner ? 2000 * 10 ** random() : 20000 * 5 ** random();
    const flat = inner ? 0.5 + 0.5 * Math.log10(distance / 2000) : 1;
    // A uniform direction on the sphere, squashed towards the ecliptic by `flat`.
    const height = (2 * random() - 1) * flat;
    // At an anomaly of 90 degrees the height above the ecliptic is the sine of the inclination.
    add(distance, 0, Math.asin(height), ice, 0.25 + 0.35 * random(), {
      node: random() * 2 * Math.PI,
      periapsis: 0,
      anomaly: Math.PI / 2,
      period: 0,
    });
  }

  return { count: index, orbit, plane, color };
}

/** How much of the belt's density survives at `axis`: 0 in the middle of a Kirkwood gap, 1 away from them. */
export function gapFactor(axis: number): number {
  let factor = 1;
  for (const [gap, halfWidth] of KIRKWOOD_GAPS) factor *= 1 - Math.exp(-(((axis - gap) / halfWidth) ** 2) * 2);
  return factor;
}

/** Converts "#rrggbb" to linear red, green and blue. */
function linear(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [16, 8, 0].map((shift) => (((value >> shift) & 0xff) / 255) ** 2.2) as [number, number, number];
}

function mix(a: [number, number, number], b: [number, number, number], share: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share, a[2] + (b[2] - a[2]) * share];
}
