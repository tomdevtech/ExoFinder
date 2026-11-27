import { en } from "@/i18n/messages/en";
import { describe, expect, it } from "vitest";
import { SOLAR_SEQUENCE } from "@/app/browse/order";
import { exoplanetPlace, solarPlace } from "@/app/browse/place";
import type { ExoplanetStart, OrderedExoplanet } from "@/app/browse/queries";

const exoplanet = (name: string, star: string, distPc: number | null, position: number): OrderedExoplanet => ({
  slug: name.toLowerCase().replaceAll(" ", "-"),
  name,
  starSlug: star.toLowerCase().replaceAll(" ", "-"),
  starName: star,
  distPc,
  position,
});

const PROXIMA_B = exoplanet("Proxima Cen b", "Proxima Cen", 1.30119, 1);
const START: ExoplanetStart = { first: PROXIMA_B, total: 17 };
const SOLAR = SOLAR_SEQUENCE.length;
const step = (name: string, href: string, system: string | null = null) => ({ href, name, system });

describe("solarPlace", () => {
  it("starts the catalogue at Mercury", () => {
    expect(solarPlace("/planets/mercury", START, en)).toEqual({
      position: 1,
      total: SOLAR + 17,
      previous: null,
      next: step("Venus", "/planets/venus"),
      skipBack: null,
      skipAhead: null,
    });
  });

  it("leads from a planet to its moons and offers to skip them", () => {
    const earth = solarPlace("/planets/earth", START, en);
    expect(earth?.previous).toEqual(step("Venus", "/planets/venus"));
    expect(earth?.next).toEqual(step("Moon", "/solar-system/moon"));
    expect(earth?.skipBack).toBeNull();
    expect(earth?.skipAhead).toEqual(step("Mars", "/planets/mars"));
  });

  it("offers no skip where the plain step already leads to a planet", () => {
    const moon = solarPlace("/solar-system/moon", START, en);
    expect(moon?.previous).toEqual(step("Earth", "/planets/earth"));
    expect(moon?.next).toEqual(step("Mars", "/planets/mars"));
    expect(moon?.skipBack).toBeNull();
    expect(moon?.skipAhead).toBeNull();
  });

  it("lets a moon in the middle of Saturn's skip back to Saturn and ahead to Uranus", () => {
    const titan = solarPlace("/solar-system/titan", START, en);
    expect(titan?.skipBack).toEqual(step("Saturn", "/planets/saturn"));
    expect(titan?.skipAhead).toEqual(step("Uranus", "/planets/uranus"));
  });

  it("leads from the last moon of Pluto to the nearest exoplanet and names its system", () => {
    const beyond = step("Proxima Cen b", "/planets/proxima-cen-b", "Proxima Cen · 4.24 light-years");
    const hydra = solarPlace("/solar-system/hydra", START, en);
    expect(hydra?.position).toBe(SOLAR);
    expect(hydra?.next).toEqual(beyond);
    expect(hydra?.skipAhead).toBeNull();
    expect(hydra?.skipBack).toEqual(step("Pluto", "/solar-system/pluto"));
    // Past Pluto no body orbits the Sun any more, so skipping its moons leaves the solar system.
    expect(solarPlace("/solar-system/charon", START, en)?.skipAhead).toEqual(beyond);
  });

  it("still knows the neighbours within the solar system before the database has answered", () => {
    const earth = solarPlace("/planets/earth", null, en);
    expect(earth?.total).toBeNull();
    expect(earth?.next).toEqual(step("Moon", "/solar-system/moon"));
    expect(solarPlace("/solar-system/hydra", null, en)?.next).toBeNull();
    expect(solarPlace("/solar-system/hydra", { first: null, total: 0 }, en)).toMatchObject({ next: null, total: SOLAR });
  });

  it("knows no place for a page outside the solar system", () => {
    expect(solarPlace("/planets/proxima-cen-b", START, en)).toBeNull();
    expect(solarPlace("/stars/sun", START, en)).toBeNull();
  });
});

describe("exoplanetPlace", () => {
  const b = exoplanet("TRAPPIST-1 b", "TRAPPIST-1", 12.429, 2);
  const c = exoplanet("TRAPPIST-1 c", "TRAPPIST-1", 12.429, 3);

  it("counts on from the solar system and follows its last body", () => {
    const place = exoplanetPlace({ planet: PROXIMA_B, previous: null, next: b, total: 17 }, en);
    const last = SOLAR_SEQUENCE[SOLAR - 1];
    expect(place.position).toBe(SOLAR + 1);
    expect(place.total).toBe(SOLAR + 17);
    expect(place.previous).toEqual(step(last.name, last.href, "Solar system"));
    expect(place.next).toEqual(step("TRAPPIST-1 b", "/planets/trappist-1-b", "TRAPPIST-1 · 40.5 light-years"));
  });

  it("names a system only where the step leaves the current one", () => {
    const place = exoplanetPlace({ planet: b, previous: PROXIMA_B, next: c, total: 17 }, en);
    expect(place.previous?.system).toBe("Proxima Cen · 4.24 light-years");
    expect(place.next).toEqual(step("TRAPPIST-1 c", "/planets/trappist-1-c"));
    expect(place.skipBack).toBeNull();
    expect(place.skipAhead).toBeNull();
  });

  it("names a system at an unknown distance by its star alone, and ends the catalogue there", () => {
    const far = exoplanet("Kepler-12 b", "Kepler-12", 590, 16);
    const lost = exoplanet("Nodist-1 b", "Nodist-1", null, 17);
    expect(exoplanetPlace({ planet: far, previous: null, next: lost, total: 17 }, en).next?.system).toBe("Nodist-1");
    expect(exoplanetPlace({ planet: lost, previous: far, next: null, total: 17 }, en).next).toBeNull();
  });
});
