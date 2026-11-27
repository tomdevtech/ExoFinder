import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { SOLAR_SYSTEM_PLANETS } from "@/app/solar-system/data";
import {
  bodyAppearance,
  describeBody,
  massEarth,
  moonsOf,
  parentHref,
  parentName,
  radiusEarth,
  SOLAR_BODIES,
  solarBody,
  SUN_BODIES,
  surfaceGravity,
} from "@/app/solar-system/bodies";
import { shapeGrid } from "@/app/solar-system/shapes";
import { isSlug } from "@/shared/slug";

const PLANETS = new Set(SOLAR_SYSTEM_PLANETS.map((planet) => planet.slug));

describe("the moons and dwarf planets", () => {
  it("have unique slugs that no planet uses", () => {
    const slugs = SOLAR_BODIES.map((body) => body.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(isSlug(slug), slug).toBe(true);
      expect(PLANETS.has(slug), slug).toBe(false);
    }
  });

  it("orbit a planet, a dwarf planet or the Sun", () => {
    for (const body of SOLAR_BODIES) {
      if (body.kind !== "moon") expect(body.parent, body.slug).toBe("sun");
      else expect(PLANETS.has(body.parent) || solarBody(body.parent)?.kind === "dwarf_planet", body.slug).toBe(true);
    }
  });

  it("have plausible measurements", () => {
    for (const body of SOLAR_BODIES) {
      // Only the bodies drawn from a shape model may be too small to have pulled themselves round.
      expect(body.radiusKm, body.slug).toBeGreaterThan(body.shape ? 3 : 150);
      expect(body.eccentricity, body.slug).toBeGreaterThanOrEqual(0);
      expect(body.eccentricity, body.slug).toBeLessThan(0.3);
      expect(body.summary.length, body.slug).toBeGreaterThan(40);
      // Mass and density are known together or not at all.
      expect(body.gm === null, body.slug).toBe(body.density === null);
      const mass = massEarth(body);
      if (mass === null || body.density === null) continue;
      // Small irregular moons are rubble and ice full of holes, lighter than water.
      expect(body.density, body.slug).toBeGreaterThan(body.shape ? 0.25 : 0.9);
      expect(body.density, body.slug).toBeLessThan(4);
      // The density must agree with mass and radius, which checks the units of all three.
      const derived = (mass * 5.9722e27) / ((4 / 3) * Math.PI * (body.radiusKm * 1e5) ** 3);
      expect(derived / body.density, body.slug).toBeCloseTo(1, 1);
    }
  });

  it("derive mass, radius and gravity in the units the pages show", () => {
    const moon = solarBody("moon")!;
    expect(massEarth(moon)).toBeCloseTo(0.0123, 4);
    expect(radiusEarth(moon)).toBeCloseTo(0.2727, 3);
    expect(surfaceGravity(moon)).toBeCloseTo(1.62, 2);
    // Ganymede is wider than Mercury but has less than half its mass.
    const ganymede = solarBody("ganymede")!;
    expect(radiusEarth(ganymede)).toBeGreaterThan(0.383);
    expect(massEarth(ganymede)).toBeLessThan(0.0553 / 2);
  });

  it("lists the moons of a body from the inside out", () => {
    expect(moonsOf("jupiter").map((moon) => moon.slug)).toEqual(["io", "europa", "ganymede", "callisto"]);
    expect(moonsOf("saturn").map((moon) => moon.slug)).toEqual([
      "pan",
      "daphnis",
      "atlas",
      "prometheus",
      "pandora",
      "epimetheus",
      "janus",
      "mimas",
      "enceladus",
      "telesto",
      "calypso",
      "tethys",
      "helene",
      "dione",
      "rhea",
      "titan",
      "hyperion",
      "iapetus",
      "phoebe",
    ]);
    expect(moonsOf("mars").map((moon) => moon.slug)).toEqual(["phobos", "deimos"]);
    expect(moonsOf("pluto").map((moon) => moon.slug)).toEqual(["charon"]);
    expect(moonsOf("mercury")).toEqual([]);
    expect(SOLAR_BODIES.filter((body) => body.kind === "dwarf_planet").map((body) => body.slug)).toEqual(["ceres", "pluto"]);
    expect(SUN_BODIES.map((body) => body.slug)).toEqual(["vesta", "ceres", "pluto"]);
  });

  it("marks Triton as orbiting backwards and the Moon as measured against the ecliptic", () => {
    expect(solarBody("triton")!.inclinationDeg).toBeGreaterThan(90);
    // Phoebe circles so far out that the Sun's pull sets its plane rather than Saturn's equator.
    expect(SOLAR_BODIES.filter((body) => body.ecliptic).map((body) => body.slug)).toEqual(["moon", "phoebe"]);
  });

  it("say what they orbit and link to it", () => {
    expect(describeBody(solarBody("titan")!, en)).toBe("Moon of Saturn");
    expect(describeBody(solarBody("ceres")!, en)).toBe("Dwarf planet");
    expect(parentName(solarBody("charon")!, en)).toBe("Pluto");
    expect(parentHref(solarBody("charon")!)).toBe("/solar-system/pluto");
    expect(parentHref(solarBody("europa")!)).toBe("/planets/jupiter");
    expect(parentHref(solarBody("pluto")!)).toBe("/stars/sun");
  });

  it("draw the irregular ones from a shape model, and only Hyperion tumbles", () => {
    expect(SOLAR_BODIES.filter((body) => body.shape)).toHaveLength(15);
    expect(SOLAR_BODIES.filter((body) => !body.shape && body.radiusKm < 150)).toEqual([]);
    for (const body of SOLAR_BODIES.filter((each) => each.shape)) {
      // The published mean radius and the volume of the shape agree.
      expect(shapeGrid(body.slug)!.meanRadiusKm / body.radiusKm, body.slug).toBeCloseTo(1, 1);
    }
    expect(SOLAR_BODIES.filter((body) => body.tumbling).map((body) => body.slug)).toEqual(["hyperion"]);
    // Where no spacecraft measured a moon's pull, the page says the mass is unknown.
    expect(massEarth(solarBody("daphnis")!)).toBeNull();
    expect(surfaceGravity(solarBody("daphnis")!)).toBeNull();
    expect(describeBody(solarBody("vesta")!, en)).toBe("Asteroid");
  });

  it("each show their own real map, without an atmosphere except for Titan", () => {
    for (const body of SOLAR_BODIES) {
      const { globe, atmosphere } = bodyAppearance(body);
      expect(globe.kind, body.slug).toBe("map");
      expect(globe.maps.day, body.slug).toBe(body.slug);
      expect(globe.rings, body.slug).toBeNull();
      expect(atmosphere !== null, body.slug).toBe(body.slug === "titan");
    }
  });
});
