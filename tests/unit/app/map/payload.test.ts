import { en } from "@/i18n/messages/en";
import { describe, expect, it } from "vitest";
import { toMapStar, toMapSystem, type SystemPlanetRow, type SystemStarRow } from "@/app/map/payload";

const STAR: SystemStarRow = {
  slug: "trappist-1",
  name: "TRAPPIST-1",
  source: "nasa",
  teffK: 2566,
  radiusSun: 0.12,
  massSun: 0.09,
  distPc: 12.43,
};

function planet(overrides: Partial<SystemPlanetRow> = {}): SystemPlanetRow {
  return {
    slug: "trappist-1-e",
    name: "TRAPPIST-1 e",
    source: "nasa",
    planetClass: "rocky",
    climateClass: "temperate",
    orbitalPeriodDays: 6.1,
    semiMajorAxisAu: 0.029,
    eccentricity: 0.005,
    radiusEarth: 0.92,
    eqTempK: 251,
    densityEarth: null,
    ...overrides,
  };
}

describe("toMapStar", () => {
  it("packs a star into a short list and rounds what nobody can see", () => {
    expect(
      toMapStar({
        slug: "proxima-cen",
        name: "Proxima Cen",
        x: 0.4712345,
        y: -0.3609876,
        z: -1.1554321,
        teffK: 2900.4,
        planetCount: 2,
      }),
    ).toEqual(["proxima-cen", "Proxima Cen", 0.471, -0.361, -1.155, 2900, 2]);
  });

  it("keeps an unknown temperature unknown", () => {
    const star = toMapStar({ slug: "x", name: "X", x: 1, y: 2, z: 3, teffK: null, planetCount: 1 });
    expect(star[5]).toBeNull();
  });
});

describe("toMapSystem", () => {
  it("marks the Sun and no other star as our own", () => {
    expect(toMapSystem(STAR, [], en).star.isSun).toBe(false);
    expect(toMapSystem({ ...STAR, slug: "sun", source: "sol" }, [], en).star.isSun).toBe(true);
  });

  it("describes every planet and gives it the look of its page", () => {
    const { planets } = toMapSystem(STAR, [planet(), planet({ slug: "trappist-1-b", name: "TRAPPIST-1 b" })], en);
    expect(planets.map((item) => item.slug)).toEqual(["trappist-1-e", "trappist-1-b"]);
    expect(planets[0].description).toBe("Rocky planet, temperate");
    expect(planets[0].globe.kind).toBe("terrain");
    expect(planets[0].globe.seed).not.toBe(planets[1].globe.seed);
  });

  it("uses the real maps for the planets of the solar system", () => {
    const sun: SystemStarRow = { ...STAR, slug: "sun", name: "Sun", source: "sol", teffK: 5772 };
    const { planets } = toMapSystem(sun, [
      planet({ slug: "earth", name: "Earth", source: "sol" }),
      planet({ slug: "saturn", name: "Saturn", source: "sol", planetClass: "gas_giant", climateClass: "frozen" }),
    ], en);
    expect(planets[0].globe.kind).toBe("map");
    expect(planets[0].globe.maps?.day).toBe("earth");
    expect(planets[1].globe.rings).not.toBeNull();
  });

  it("adds the dwarf planets to the Sun in the order of their orbits, each with its page", () => {
    const sun: SystemStarRow = { ...STAR, slug: "sun", name: "Sun", source: "sol", teffK: 5772 };
    const { planets } = toMapSystem(sun, [
      planet({ slug: "mars", name: "Mars", source: "sol", orbitalPeriodDays: 687 }),
      planet({ slug: "jupiter", name: "Jupiter", source: "sol", orbitalPeriodDays: 4331, planetClass: "gas_giant" }),
      planet({ slug: "neptune", name: "Neptune", source: "sol", orbitalPeriodDays: 59800, planetClass: "neptune_like" }),
    ], en);
    expect(planets.map((item) => item.slug)).toEqual(["mars", "vesta", "ceres", "jupiter", "neptune", "pluto"]);
    expect(planets[1]).toMatchObject({ description: "Asteroid", shape: { url: "/shapes/vesta.bin", map: true, tumbling: false } });
    expect(planets[1].shape!.maxRadius).toBeGreaterThan(1);
    expect(planets[0].href).toBe("/planets/mars");
    expect(planets[2]).toMatchObject({ href: "/solar-system/ceres", description: "Dwarf planet", shape: null });
    expect(planets[2].globe.maps.day).toBe("ceres");
    expect(planets[2].semiMajorAxisAu).toBeCloseTo(2.77, 2);
  });

  it("gives the planets of the solar system their large moons, and exoplanets none", () => {
    const sun: SystemStarRow = { ...STAR, slug: "sun", name: "Sun", source: "sol", teffK: 5772 };
    const { planets } = toMapSystem(sun, [planet({ slug: "jupiter", name: "Jupiter", source: "sol", planetClass: "gas_giant" })], en);
    const jupiter = planets.find((item) => item.slug === "jupiter")!;
    expect(jupiter.moons.map((moon) => moon.slug)).toEqual(["io", "europa", "ganymede", "callisto"]);
    expect(jupiter.moons[0]).toMatchObject({ href: "/solar-system/io", ecliptic: false });
    expect(jupiter.moons[0].globe.maps.day).toBe("io");
    expect(planets.find((item) => item.slug === "pluto")!.moons.map((moon) => moon.slug)).toEqual(["charon"]);
    expect(toMapSystem(STAR, [planet()], en).planets[0].moons).toEqual([]);
    // The small moons travel as compact tuples, as there are hundreds of them.
    expect(jupiter.smallMoons).toHaveLength(111);
    expect(jupiter.smallMoons[0]).toHaveLength(10);
    expect(toMapSystem(STAR, [planet()], en).planets[0].smallMoons).toEqual([]);
    // A NASA planet keeps no moons even if its slug matched a solar-system planet.
    expect(toMapSystem(STAR, [planet({ slug: "jupiter" })], en).planets[0].moons).toEqual([]);
  });

  it("adds no dwarf planets to other stars", () => {
    expect(toMapSystem(STAR, [planet()], en).planets.map((item) => item.slug)).toEqual(["trappist-1-e"]);
  });

  it("passes missing measurements on as missing", () => {
    const { planets } = toMapSystem(STAR, [
      planet({ planetClass: null, climateClass: null, orbitalPeriodDays: null, radiusEarth: null }),
    ], en);
    expect(planets[0].orbitalPeriodDays).toBeNull();
    expect(planets[0].radiusEarth).toBeNull();
    expect(planets[0].description.length).toBeGreaterThan(0);
  });
});
