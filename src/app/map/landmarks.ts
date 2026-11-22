/**
 * Famous nebulae, clusters and the Magellanic Clouds, placed from rounded published
 * galactic longitudes, latitudes and distances. Map coordinates are parsecs with the
 * Sun at the origin, x towards the galactic centre, y along the rotation and z north.
 */

import { seededRandom } from "@/shared/math";

export type LandmarkKind = "nebula" | "planetary" | "remnant" | "cluster" | "globular" | "galaxy";

export interface Landmark {
  name: string;
  kind: LandmarkKind;
  position: [number, number, number];
  /** The drawn radius in parsecs. */
  radius: number;
  /** The main colour as RGB from 0 to 1. */
  color: [number, number, number];
  /** The number of member stars drawn, which is 0 for gas clouds. */
  members: number;
}

/** Converts galactic longitude and latitude in degrees plus a distance in parsecs to map coordinates. */
export function fromGalactic(longitudeDeg: number, latitudeDeg: number, distance: number): [number, number, number] {
  const l = (longitudeDeg * Math.PI) / 180;
  const b = (latitudeDeg * Math.PI) / 180;
  const round = (value: number) => Math.round(value * 10) / 10;
  return [
    round(distance * Math.cos(b) * Math.cos(l)),
    round(distance * Math.cos(b) * Math.sin(l)),
    round(distance * Math.sin(b)),
  ];
}

const PINK: [number, number, number] = [1, 0.42, 0.55];
const BLUE: [number, number, number] = [0.55, 0.7, 1];
const GOLD: [number, number, number] = [1, 0.86, 0.62];
const TEAL: [number, number, number] = [0.45, 0.9, 0.85];
const PALE: [number, number, number] = [0.82, 0.86, 1];

export const LANDMARKS: readonly Landmark[] = [
  { name: "Orion Nebula", kind: "nebula", position: fromGalactic(209.0, -19.4, 412), radius: 6, color: PINK, members: 0 },
  { name: "Rosette Nebula", kind: "nebula", position: fromGalactic(206.3, -2.1, 1600), radius: 18, color: PINK, members: 0 },
  { name: "North America Nebula", kind: "nebula", position: fromGalactic(85.6, -0.7, 800), radius: 15, color: PINK, members: 0 },
  { name: "Lagoon Nebula", kind: "nebula", position: fromGalactic(6.0, -1.2, 1250), radius: 16, color: PINK, members: 0 },
  { name: "Eagle Nebula", kind: "nebula", position: fromGalactic(17.0, 0.8, 1740), radius: 12, color: PINK, members: 0 },
  { name: "Carina Nebula", kind: "nebula", position: fromGalactic(287.6, -0.6, 2300), radius: 35, color: PINK, members: 0 },
  { name: "Trifid Nebula", kind: "nebula", position: fromGalactic(7.0, -0.3, 1300), radius: 8, color: PINK, members: 0 },
  { name: "Omega Nebula", kind: "nebula", position: fromGalactic(15.1, -0.7, 1700), radius: 9, color: PINK, members: 0 },
  { name: "Heart Nebula", kind: "nebula", position: fromGalactic(134.7, 0.9, 2000), radius: 30, color: PINK, members: 0 },
  // The Crab is a young supernova remnant that still looks like a filled nebula.
  { name: "Crab Nebula", kind: "nebula", position: fromGalactic(184.6, -5.8, 2000), radius: 2, color: [0.75, 0.82, 1], members: 0 },
  { name: "Veil Nebula", kind: "remnant", position: fromGalactic(74.0, -8.5, 735), radius: 20, color: [0.6, 0.75, 1], members: 0 },
  { name: "Ring Nebula", kind: "planetary", position: fromGalactic(63.2, 14.0, 790), radius: 0.8, color: TEAL, members: 0 },
  { name: "Helix Nebula", kind: "planetary", position: fromGalactic(36.2, -57.1, 200), radius: 1, color: TEAL, members: 0 },
  { name: "Pleiades", kind: "cluster", position: fromGalactic(166.6, -23.5, 136), radius: 4, color: BLUE, members: 120 },
  { name: "Hyades", kind: "cluster", position: fromGalactic(180.1, -22.3, 47), radius: 5, color: GOLD, members: 80 },
  { name: "Beehive Cluster", kind: "cluster", position: fromGalactic(205.9, 32.5, 187), radius: 4, color: PALE, members: 100 },
  { name: "Double Cluster", kind: "cluster", position: fromGalactic(134.6, -3.7, 2300), radius: 9, color: BLUE, members: 300 },
  { name: "Omega Centauri", kind: "globular", position: fromGalactic(309.1, 15.0, 5200), radius: 25, color: GOLD, members: 4000 },
  { name: "47 Tucanae", kind: "globular", position: fromGalactic(305.9, -44.9, 4500), radius: 18, color: GOLD, members: 3000 },
  { name: "Hercules Cluster (M13)", kind: "globular", position: fromGalactic(59.0, 40.9, 7100), radius: 15, color: GOLD, members: 2500 },
  { name: "Large Magellanic Cloud", kind: "galaxy", position: fromGalactic(280.5, -32.9, 49970), radius: 2600, color: PALE, members: 9000 },
  { name: "Small Magellanic Cloud", kind: "galaxy", position: fromGalactic(302.8, -44.3, 62000), radius: 1600, color: PALE, members: 5000 },
];

/**
 * Returns made-up positions for the Milky Way's roughly 150 globular clusters as
 * point stars, seven floats each as in starfield.ts. They follow the real spread,
 * mostly within 20 kpc and denser towards the centre, so the halo shows from outside.
 */
export function globularSystem(count = 150): Float32Array {
  const rand = seededRandom(4242);
  const data = new Float32Array(count * 7);
  for (let n = 0; n < count; n++) {
    // A steep power of a uniform number concentrates the clusters towards the centre.
    const r = 500 + 22000 * rand() ** 2.2;
    const cos = 2 * rand() - 1;
    const sin = Math.sqrt(1 - cos * cos);
    const angle = 2 * Math.PI * rand();
    data.set(
      [
        8200 + r * sin * Math.cos(angle),
        r * sin * Math.sin(angle),
        r * cos,
        1,
        0.86 + 0.08 * rand(),
        0.62 + 0.12 * rand(),
        // Real globular clusters shine like tens of thousands to a million suns. These
        // are drawn somewhat brighter so that the halo stays visible from outside.
        100000 + 1500000 * rand() ** 3,
      ],
      n * 7,
    );
  }
  return data;
}

/**
 * Returns the member stars of a landmark, seven floats each as in starfield.ts.
 * Open clusters are loose groups, globular clusters are Plummer spheres and the
 * Magellanic Clouds are lopsided discs with a bar.
 */
export function clusterStars(landmark: Landmark, index: number): Float32Array {
  const rand = seededRandom(9001 + index * 7919);
  const data = new Float32Array(landmark.members * 7);
  const globular = landmark.kind === "globular";
  const galaxy = landmark.kind === "galaxy";
  const tilt = rand() * Math.PI;
  for (let n = 0; n < landmark.members; n++) {
    let x: number;
    let y: number;
    let z: number;
    if (galaxy) {
      const bell = () => rand() + rand() + rand() - 1.5;
      const inBar = rand() < 0.35;
      const along = bell() * landmark.radius * (inBar ? 0.9 : 0.75);
      const across = bell() * landmark.radius * (inBar ? 0.25 : 0.75);
      x = along * Math.cos(tilt) - across * Math.sin(tilt);
      y = along * Math.sin(tilt) + across * Math.cos(tilt);
      z = bell() * landmark.radius * 0.15;
    } else if (globular) {
      // The radius is drawn by inverting the Plummer profile. Its long tail is cut
      // at twice the landmark radius so that no stray stars end up far away.
      const r = (landmark.radius * 0.25) / Math.sqrt(Math.max(rand(), 1e-6) ** (-2 / 3) - 1);
      const cos = 2 * rand() - 1;
      const sin = Math.sqrt(1 - cos * cos);
      const angle = 2 * Math.PI * rand();
      const far = Math.min(r, landmark.radius * 2);
      x = far * sin * Math.cos(angle);
      y = far * sin * Math.sin(angle);
      z = far * cos;
    } else {
      const bell = () => (rand() + rand() + rand() - 1.5) * landmark.radius * 0.8;
      x = bell();
      y = bell();
      z = bell();
    }
    const [red, green, blue] = globular
      ? [1, 0.82 + 0.1 * rand(), 0.55 + 0.15 * rand()]
      : landmark.color.map((value) => Math.min(1, value * (0.9 + 0.2 * rand())));
    // Steep powers give few bright members and many faint ones. In the galaxies
    // only the giants are bright enough to show.
    const light = galaxy
      ? 500 + 80000 * rand() ** 4
      : globular
        ? 0.5 + 60 * rand() ** 6
        : 0.8 + 250 * rand() ** 5;
    data.set(
      [landmark.position[0] + x, landmark.position[1] + y, landmark.position[2] + z, red, green, blue, light],
      n * 7,
    );
  }
  return data;
}
