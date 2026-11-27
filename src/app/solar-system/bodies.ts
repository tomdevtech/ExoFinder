/**
 * The round moons of the solar system and the dwarf planets Ceres and Pluto.
 *
 * Moons: JPL Solar System Dynamics, planetary satellite physical parameters
 * (https://ssd.jpl.nasa.gov/sats/phys_par/) and mean orbital elements (https://ssd.jpl.nasa.gov/sats/elem/).
 * Ceres: JPL Small-Body Database. Pluto: NASA Pluto Fact Sheet for the orbit and JPL for the mass.
 * Charon's density is the New Horizons value (Nimmo et al. 2017); JPL's table lists 1.853 g/cm³, which does
 * not fit its own mass and the measured radius of 606 km. Vesta: JPL Small-Body Database.
 *
 * Bodies marked `shape` are far from round and are drawn from a shape model (shapes.ts); their radius is the
 * radius of a sphere of the same volume.
 *
 * These bodies never change through the NASA sync, so they live in code rather than in the database.
 */
import { planetAppearance, type Appearance } from "@/app/planets/appearance";
import { AU_KM, EARTH_RADIUS_KM } from "@/shared/units";
import { SOLAR_SYSTEM_PLANETS } from "./data";

export interface SolarBody {
  slug: string;
  name: string;
  kind: "moon" | "dwarf_planet" | "asteroid";
  /** The slug of the planet or dwarf planet the moon orbits, or "sun". */
  parent: string;
  /** Mean radius in km. */
  radiusKm: number;
  /**
   * Gravitational parameter G·M in km³/s², which is measured far more precisely than the mass itself, or
   * null for the few small moons whose pull no spacecraft has measured.
   */
  gm: number | null;
  /** Mean density in g/cm³, or null where the mass is unknown. */
  density: number | null;
  semiMajorAxisKm: number;
  orbitalPeriodDays: number;
  eccentricity: number;
  /**
   * Inclination in degrees against the plane the orbit precesses about: for most moons close to the planet's
   * equator, for the Moon and the dwarf planets the ecliptic (see `ecliptic`). Above 90 the orbit is retrograde.
   */
  inclinationDeg: number;
  /** True for a moon whose orbit is measured against the ecliptic rather than its planet's equator. */
  ecliptic?: true;
  /** True for a body drawn from its shape model rather than as a sphere. */
  shape?: true;
  /** True for a moon that tumbles chaotically instead of turning one face to its planet. */
  tumbling?: true;
  /** Null when the body has been known since antiquity. */
  discoveryYear: number | null;
  discoverer: string | null;
  summary: string;
}

/** G·M of Earth in km³/s², to express masses relative to Earth. */
const EARTH_GM = 398600.4418;

const au = (value: number) => value * AU_KM;

// prettier-ignore
export const SOLAR_BODIES: SolarBody[] = [
  { slug: "phobos", name: "Phobos", kind: "moon", parent: "mars", radiusKm: 11.08, gm: 0.0007087, density: 1.872, semiMajorAxisKm: 9375, orbitalPeriodDays: 0.3187, eccentricity: 0.015, inclinationDeg: 1.1, shape: true, discoveryYear: 1877, discoverer: "Asaph Hall",
    summary: "The larger of Mars' two moons, a lumpy body 26 km long. It circles Mars three times a day, closer than any other moon to its planet, and is slowly spiralling in: in some 50 million years the tides will pull it apart." },
  { slug: "deimos", name: "Deimos", kind: "moon", parent: "mars", radiusKm: 6.2, gm: 0.0000962, density: 1.471, semiMajorAxisKm: 23457, orbitalPeriodDays: 1.2625, eccentricity: 0, inclinationDeg: 1.8, shape: true, discoveryYear: 1877, discoverer: "Asaph Hall",
    summary: "The smaller, outer moon of Mars, 16 km long. A thick blanket of dust has filled most of its craters and smoothed its surface." },

  { slug: "moon", name: "Moon", kind: "moon", parent: "earth", radiusKm: 1737.4, gm: 4902.8, density: 3.344, semiMajorAxisKm: 384400, orbitalPeriodDays: 27.322, eccentricity: 0.0554, inclinationDeg: 5.16, ecliptic: true, discoveryYear: null, discoverer: null,
    summary: "Earth's only natural satellite. The dark plains are ancient lava floods; the bright highlands are older crust, battered by impacts." },

  { slug: "io", name: "Io", kind: "moon", parent: "jupiter", radiusKm: 1821.49, gm: 5959.91547, density: 3.5276, semiMajorAxisKm: 421800, orbitalPeriodDays: 1.762732, eccentricity: 0.004, inclinationDeg: 0, discoveryYear: 1610, discoverer: "Galileo Galilei",
    summary: "The most volcanically active body known. Jupiter's tides knead its interior, feeding hundreds of volcanoes whose sulphur paints the surface yellow, orange and white." },
  { slug: "europa", name: "Europa", kind: "moon", parent: "jupiter", radiusKm: 1560.8, gm: 3202.7121, density: 3.013, semiMajorAxisKm: 671100, orbitalPeriodDays: 3.525463, eccentricity: 0.009, inclinationDeg: 0.5, discoveryYear: 1610, discoverer: "Galileo Galilei",
    summary: "A shell of ice, criss-crossed by long cracks, covers a salty ocean. It is one of the most promising places in the solar system to look for life." },
  { slug: "ganymede", name: "Ganymede", kind: "moon", parent: "jupiter", radiusKm: 2631.2, gm: 9887.83275, density: 1.9416, semiMajorAxisKm: 1070400, orbitalPeriodDays: 7.155588, eccentricity: 0.001, inclinationDeg: 0.2, discoveryYear: 1610, discoverer: "Galileo Galilei",
    summary: "The largest moon in the solar system, wider than Mercury, and the only one with a magnetic field of its own. Dark, old terrain alternates with younger, grooved ice." },
  { slug: "callisto", name: "Callisto", kind: "moon", parent: "jupiter", radiusKm: 2410.3, gm: 7179.2834, density: 1.834, semiMajorAxisKm: 1882700, orbitalPeriodDays: 16.69044, eccentricity: 0.007, inclinationDeg: 0.3, discoveryYear: 1610, discoverer: "Galileo Galilei",
    summary: "One of the most heavily cratered surfaces known. Its dark, icy crust has hardly changed in four billion years." },

  { slug: "pan", name: "Pan", kind: "moon", parent: "saturn", radiusKm: 14, gm: 0.00028, density: 0.365, semiMajorAxisKm: 133600, orbitalPeriodDays: 0.575051, eccentricity: 0, inclinationDeg: 0, shape: true, discoveryYear: 1990, discoverer: "Mark Showalter",
    summary: "A walnut-shaped moon that orbits inside the Encke Gap of Saturn's A ring and keeps it open. A ridge of ring material it swept up runs round its equator." },
  { slug: "daphnis", name: "Daphnis", kind: "moon", parent: "saturn", radiusKm: 3.9, gm: null, density: null, semiMajorAxisKm: 136500, orbitalPeriodDays: 0.59408, eccentricity: 0, inclinationDeg: 0, shape: true, discoveryYear: 2005, discoverer: "Cassini Imaging Science Team",
    summary: "A tiny moon in the Keeler Gap of the A ring. Its pull raises waves along the edges of the gap, which cast long shadows when the Sun stands low over the rings." },
  { slug: "atlas", name: "Atlas", kind: "moon", parent: "saturn", radiusKm: 15.1, gm: 0.00037, density: 0.385, semiMajorAxisKm: 137700, orbitalPeriodDays: 0.604602, eccentricity: 0.001, inclinationDeg: 0, shape: true, discoveryYear: 1980, discoverer: "Voyager Science Team",
    summary: "A moon just outside the A ring, shaped like a flying saucer by a ridge of ring particles round its equator." },
  { slug: "prometheus", name: "Prometheus", kind: "moon", parent: "saturn", radiusKm: 43.1, gm: 0.01071, density: 0.4784, semiMajorAxisKm: 139400, orbitalPeriodDays: 0.615878, eccentricity: 0.002, inclinationDeg: 0, shape: true, discoveryYear: 1980, discoverer: "Voyager Science Team",
    summary: "The inner shepherd of the narrow F ring. On every pass it draws streamers and channels out of the ring." },
  { slug: "pandora", name: "Pandora", kind: "moon", parent: "saturn", radiusKm: 40.6, gm: 0.00926, density: 0.4948, semiMajorAxisKm: 141700, orbitalPeriodDays: 0.631369, eccentricity: 0.004, inclinationDeg: 0, shape: true, discoveryYear: 1980, discoverer: "Voyager Science Team",
    summary: "The outer shepherd of the F ring: an elongated, cratered moon blanketed in fine dust." },
  { slug: "epimetheus", name: "Epimetheus", kind: "moon", parent: "saturn", radiusKm: 58.2, gm: 0.03514, density: 0.6375, semiMajorAxisKm: 151400, orbitalPeriodDays: 0.697012, eccentricity: 0.02, inclinationDeg: 0.3, shape: true, discoveryYear: 1966, discoverer: "Richard Walker",
    summary: "It shares its orbit with Janus. Every four years the two swap places: the inner one moves out and the outer one in." },
  { slug: "janus", name: "Janus", kind: "moon", parent: "saturn", radiusKm: 89.2, gm: 0.12662, density: 0.6381, semiMajorAxisKm: 151500, orbitalPeriodDays: 0.697353, eccentricity: 0.007, inclinationDeg: 0.2, shape: true, discoveryYear: 1966, discoverer: "Audouin Dollfus",
    summary: "The larger of the two moons that share one orbit: a cratered, potato-shaped body that swaps places with Epimetheus every four years." },
  { slug: "telesto", name: "Telesto", kind: "moon", parent: "saturn", radiusKm: 12.4, gm: null, density: null, semiMajorAxisKm: 295000, orbitalPeriodDays: 1.887802, eccentricity: 0.001, inclinationDeg: 1.2, shape: true, discoveryYear: 1980, discoverer: "Bradford Smith, Harold Reitsema, Stephen Larson and John Fountain",
    summary: "A small, smooth moon that leads Tethys by 60 degrees along the same orbit, at one of its Lagrange points." },
  { slug: "calypso", name: "Calypso", kind: "moon", parent: "saturn", radiusKm: 9.6, gm: null, density: null, semiMajorAxisKm: 295000, orbitalPeriodDays: 1.887803, eccentricity: 0.001, inclinationDeg: 1.5, shape: true, discoveryYear: 1980, discoverer: "Dan Pascu, P. Kenneth Seidelmann, William Baum and Douglas Currie",
    summary: "A small, bright moon that trails Tethys by 60 degrees along the same orbit, at one of its Lagrange points." },
  { slug: "helene", name: "Helene", kind: "moon", parent: "saturn", radiusKm: 18.0, gm: 0.00048, density: 0.2918, semiMajorAxisKm: 377600, orbitalPeriodDays: 2.736916, eccentricity: 0.007, inclinationDeg: 0.2, shape: true, discoveryYear: 1980, discoverer: "Pierre Laques and Jean Lecacheux",
    summary: "It leads Dione by 60 degrees along the same orbit. Long streaks show where fine material has slid downhill across its surface." },
  { slug: "mimas", name: "Mimas", kind: "moon", parent: "saturn", radiusKm: 198.2, gm: 2.50349, density: 1.1501, semiMajorAxisKm: 186000, orbitalPeriodDays: 0.942422, eccentricity: 0.02, inclinationDeg: 1.6, discoveryYear: 1789, discoverer: "William Herschel",
    summary: "The crater Herschel spans a third of its width and makes the small moon look like a staring eye." },
  { slug: "enceladus", name: "Enceladus", kind: "moon", parent: "saturn", radiusKm: 252.1, gm: 7.21037, density: 1.6097, semiMajorAxisKm: 238400, orbitalPeriodDays: 1.370218, eccentricity: 0.005, inclinationDeg: 0, discoveryYear: 1789, discoverer: "William Herschel",
    summary: "Geysers at its south pole spray water from an ocean under the ice into space and feed Saturn's E ring. Its fresh ice reflects almost all the sunlight." },
  { slug: "tethys", name: "Tethys", kind: "moon", parent: "saturn", radiusKm: 531.1, gm: 41.21353, density: 0.984, semiMajorAxisKm: 295000, orbitalPeriodDays: 1.887802, eccentricity: 0.001, inclinationDeg: 1.1, discoveryYear: 1684, discoverer: "Giovanni Domenico Cassini",
    summary: "Made almost entirely of water ice. The huge crater Odysseus and the canyon Ithaca Chasma, which runs across three quarters of its circumference, scar the surface." },
  { slug: "dione", name: "Dione", kind: "moon", parent: "saturn", radiusKm: 561.4, gm: 73.11607, density: 1.4781, semiMajorAxisKm: 377700, orbitalPeriodDays: 2.736916, eccentricity: 0.002, inclinationDeg: 0, discoveryYear: 1684, discoverer: "Giovanni Domenico Cassini",
    summary: "Bright ice cliffs, hundreds of metres high, streak its trailing side; the side that leads along the orbit is covered in craters." },
  { slug: "rhea", name: "Rhea", kind: "moon", parent: "saturn", radiusKm: 763.5, gm: 153.94175, density: 1.2372, semiMajorAxisKm: 527200, orbitalPeriodDays: 4.517503, eccentricity: 0.001, inclinationDeg: 0.3, discoveryYear: 1672, discoverer: "Giovanni Domenico Cassini",
    summary: "Saturn's second-largest moon: a cold, heavily cratered ball of ice and some rock." },
  { slug: "titan", name: "Titan", kind: "moon", parent: "saturn", radiusKm: 2574.76, gm: 8978.1371, density: 1.8814, semiMajorAxisKm: 1221900, orbitalPeriodDays: 15.945448, eccentricity: 0.029, inclinationDeg: 0.3, discoveryYear: 1655, discoverer: "Christiaan Huygens",
    summary: "The only moon with a thick atmosphere, denser than Earth's. Below the orange haze, rivers, lakes and seas of liquid methane and ethane shape the land." },
  { slug: "hyperion", name: "Hyperion", kind: "moon", parent: "saturn", radiusKm: 135, gm: 0.37049, density: 0.5386, semiMajorAxisKm: 1481500, orbitalPeriodDays: 21.276658, eccentricity: 0.105, inclinationDeg: 0.6, shape: true, tumbling: true, discoveryYear: 1848, discoverer: "William Cranch Bond, George Phillips Bond and William Lassell",
    summary: "A sponge-like moon, so porous that almost half of it is empty space, pitted with deep, sharp-rimmed craters. Titan's pull keeps it from settling, so it tumbles chaotically instead of turning about a fixed axis." },
  { slug: "phoebe", name: "Phoebe", kind: "moon", parent: "saturn", radiusKm: 106.5, gm: 0.55479, density: 1.6428, semiMajorAxisKm: 12929400, orbitalPeriodDays: 550.30391, eccentricity: 0.164, inclinationDeg: 175.2, ecliptic: true, shape: true, discoveryYear: 1898, discoverer: "William Henry Pickering",
    summary: "A dark body that orbits Saturn backwards, far beyond the large moons: a captured relic of the outer solar system. Dust knocked off it forms a huge, faint ring." },
  { slug: "iapetus", name: "Iapetus", kind: "moon", parent: "saturn", radiusKm: 734.3, gm: 120.51511, density: 1.0887, semiMajorAxisKm: 3561700, orbitalPeriodDays: 79.331002, eccentricity: 0.028, inclinationDeg: 7.6, discoveryYear: 1671, discoverer: "Giovanni Domenico Cassini",
    summary: "One side is as dark as coal and the other as bright as snow, and a ridge up to 20 km high runs along much of its equator." },

  { slug: "miranda", name: "Miranda", kind: "moon", parent: "uranus", radiusKm: 235.8, gm: 4.3, density: 1.178, semiMajorAxisKm: 129846, orbitalPeriodDays: 1.413479, eccentricity: 0.001, inclinationDeg: 4.4, discoveryYear: 1948, discoverer: "Gerard Kuiper",
    summary: "A patchwork of grooved terrain and cliffs that drop about 20 km. The small moon must have been torn up and reshaped in its past." },
  { slug: "ariel", name: "Ariel", kind: "moon", parent: "uranus", radiusKm: 578.9, gm: 83.5, density: 1.539, semiMajorAxisKm: 190929, orbitalPeriodDays: 2.520379, eccentricity: 0.001, inclinationDeg: 0, discoveryYear: 1851, discoverer: "William Lassell",
    summary: "The brightest of Uranus' large moons, with a young surface cut by long fault valleys." },
  { slug: "umbriel", name: "Umbriel", kind: "moon", parent: "uranus", radiusKm: 584.7, gm: 85.1, density: 1.523, semiMajorAxisKm: 265986, orbitalPeriodDays: 4.144177, eccentricity: 0.004, inclinationDeg: 0.1, discoveryYear: 1851, discoverer: "William Lassell",
    summary: "The darkest of Uranus' large moons: old and heavily cratered, apart from a puzzling bright ring, the crater Wunda, near its equator." },
  { slug: "titania", name: "Titania", kind: "moon", parent: "uranus", radiusKm: 788.9, gm: 226.9, density: 1.653, semiMajorAxisKm: 436298, orbitalPeriodDays: 8.705869, eccentricity: 0.002, inclinationDeg: 0.1, discoveryYear: 1787, discoverer: "William Herschel",
    summary: "Uranus' largest moon. Huge canyons split its icy crust, which probably cracked when the interior froze and expanded." },
  { slug: "oberon", name: "Oberon", kind: "moon", parent: "uranus", radiusKm: 761.4, gm: 205.3, density: 1.664, semiMajorAxisKm: 583511, orbitalPeriodDays: 13.463237, eccentricity: 0.002, inclinationDeg: 0.1, discoveryYear: 1787, discoverer: "William Herschel",
    summary: "The outermost large moon of Uranus: old and cratered, with dark material on the floors of many craters." },

  { slug: "triton", name: "Triton", kind: "moon", parent: "neptune", radiusKm: 1352.6, gm: 1428.49546, density: 2.0649, semiMajorAxisKm: 354800, orbitalPeriodDays: 5.8792, eccentricity: 0, inclinationDeg: 157.3, discoveryYear: 1846, discoverer: "William Lassell",
    summary: "It orbits Neptune backwards, so it was probably captured from the Kuiper belt. Geysers of nitrogen rise from its frozen surface." },

  { slug: "vesta", name: "Vesta", kind: "asteroid", parent: "sun", radiusKm: 261.4, gm: 17.2882844, density: 3.46, semiMajorAxisKm: au(2.36), orbitalPeriodDays: 1330, eccentricity: 0.0902, inclinationDeg: 7.14, shape: true, discoveryYear: 1807, discoverer: "Heinrich Wilhelm Olbers",
    summary: "The second-largest body of the asteroid belt and its brightest. A giant impact near its south pole dug the basin Rheasilvia, 500 km across with a central peak over 20 km high, and pieces of Vesta still fall to Earth as meteorites." },
  { slug: "ceres", name: "Ceres", kind: "dwarf_planet", parent: "sun", radiusKm: 469.7, gm: 62.6284, density: 2.162, semiMajorAxisKm: au(2.77), orbitalPeriodDays: 1680, eccentricity: 0.0797, inclinationDeg: 10.6, discoveryYear: 1801, discoverer: "Giuseppe Piazzi",
    summary: "The largest object in the asteroid belt and the only dwarf planet in the inner solar system. Bright salt deposits shine on the floor of the crater Occator." },
  { slug: "pluto", name: "Pluto", kind: "dwarf_planet", parent: "sun", radiusKm: 1188.3, gm: 869.6, density: 1.854, semiMajorAxisKm: au(39.48), orbitalPeriodDays: 90560, eccentricity: 0.2488, inclinationDeg: 17.16, discoveryYear: 1930, discoverer: "Clyde Tombaugh",
    summary: "The best-known dwarf planet of the Kuiper belt. A vast plain of nitrogen ice, Sputnik Planitia, forms the bright heart on its face." },
  { slug: "charon", name: "Charon", kind: "moon", parent: "pluto", radiusKm: 606, gm: 106.1, density: 1.702, semiMajorAxisKm: 19600, orbitalPeriodDays: 6.387222, eccentricity: 0, inclinationDeg: 0, discoveryYear: 1978, discoverer: "James Christy",
    summary: "Half as wide as Pluto, so the two circle a point between them. A reddish cap of material lost by Pluto's atmosphere covers its north pole." },
];

export function solarBody(slug: string): SolarBody | undefined {
  return SOLAR_BODIES.find((body) => body.slug === slug);
}

/** The moons of a planet or dwarf planet, from the inside out. */
export function moonsOf(parent: string): SolarBody[] {
  return SOLAR_BODIES.filter((body) => body.kind === "moon" && body.parent === parent).sort(
    (a, b) => a.semiMajorAxisKm - b.semiMajorAxisKm,
  );
}

/** The bodies with a page that orbit the Sun directly: the dwarf planets and Vesta. */
export const SUN_BODIES = SOLAR_BODIES.filter((body) => body.parent === "sun");

export function massEarth(body: SolarBody): number | null {
  return body.gm === null ? null : body.gm / EARTH_GM;
}

export function radiusEarth(body: SolarBody): number {
  return body.radiusKm / EARTH_RADIUS_KM;
}

/** Surface gravity in m/s², from G·M / r². */
export function surfaceGravity(body: SolarBody): number | null {
  return body.gm === null ? null : (body.gm / body.radiusKm ** 2) * 1000;
}

/** The look of a body: its real map, as for the planets of the solar system. */
export function bodyAppearance(body: SolarBody): Appearance {
  return planetAppearance({
    slug: body.slug,
    source: "sol",
    planetClass: null,
    climateClass: null,
    starTeffK: null,
    radiusEarth: radiusEarth(body),
    eqTempK: null,
    densityEarth: null,
    orbitalPeriodDays: body.orbitalPeriodDays,
  });
}

/** The name of what the body orbits: a planet, a dwarf planet or the Sun. */
export function parentName(body: { parent: string }): string {
  if (body.parent === "sun") return "Sun";
  return (
    SOLAR_SYSTEM_PLANETS.find((planet) => planet.slug === body.parent)?.name ??
    solarBody(body.parent)?.name ??
    body.parent
  );
}

/** A short label such as "Moon of Jupiter" or "Dwarf planet". */
export function describeBody(body: SolarBody): string {
  if (body.kind === "dwarf_planet") return "Dwarf planet";
  if (body.kind === "asteroid") return "Asteroid";
  return `Moon of ${parentName(body)}`;
}

/** The page of the body's parent: a planet page, a body page, or the Sun's star page. */
export function parentHref(body: { parent: string }): string {
  if (body.parent === "sun") return "/stars/sun";
  return solarBody(body.parent) ? `/solar-system/${body.parent}` : `/planets/${body.parent}`;
}
