import { describe, expect, it } from "vitest";
import { moonsOf, SOLAR_BODIES } from "@/app/solar-system/bodies";
import { SOLAR_SYSTEM_PLANETS } from "@/app/solar-system/data";
import { isRetrograde, SMALL_MOON_LIST, smallMoon, smallMoonsOf } from "@/app/solar-system/smallMoons";
import { isSlug } from "@/shared/slug";

/** G·M of the parents in km³/s². Pluto's moons circle the Pluto–Charon pair, so its whole mass counts. */
const GM: Record<string, number> = {
  mars: 42828.37,
  jupiter: 126686534,
  saturn: 37931187,
  uranus: 5793939,
  neptune: 6836529,
  pluto: 975.5,
};

/** The numbers of known moons on JPL's list of discovery circumstances, as of November 2026. */
const JPL_COUNTS: Record<string, number> = { mars: 2, jupiter: 115, saturn: 293, uranus: 29, neptune: 16, pluto: 5 };

describe("the small moons", () => {
  it("together with the large ones number as many as JPL lists for every planet and Pluto", () => {
    for (const [parent, count] of Object.entries(JPL_COUNTS)) {
      expect(moonsOf(parent).length + smallMoonsOf(parent).length, parent).toBe(count);
    }
  });

  it("leave out the moons that have a page of their own", () => {
    const large = new Set(SOLAR_BODIES.map((body) => body.name));
    for (const parent of Object.keys(JPL_COUNTS)) {
      for (const moon of smallMoonsOf(parent)) expect(large.has(moon.name), moon.name).toBe(false);
    }
  });

  it("have addresses of their own that no other page of the solar system uses", () => {
    const taken = new Set([...SOLAR_BODIES, ...SOLAR_SYSTEM_PLANETS].map((body) => body.slug));
    const slugs = SMALL_MOON_LIST.map((moon) => moon.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(isSlug(slug), slug).toBe(true);
      expect(taken.has(slug), slug).toBe(false);
    }
    expect(smallMoon("s-2009-s1")?.name).toBe("S/2009 S1");
    expect(smallMoon("titan")).toBeUndefined();
  });

  it("have complete, plausible orbits that obey Kepler's third law", () => {
    for (const parent of Object.keys(JPL_COUNTS)) {
      const moons = smallMoonsOf(parent);
      for (let i = 1; i < moons.length; i++) expect(moons[i].a).toBeGreaterThanOrEqual(moons[i - 1].a);
      for (const moon of moons) {
        for (const value of [moon.a, moon.e, moon.i, moon.node, moon.peri, moon.M, moon.period]) {
          expect(Number.isFinite(value), moon.name).toBe(true);
        }
        expect(moon.e, moon.name).toBeGreaterThanOrEqual(0);
        // Captured moons can have very stretched orbits (S/2023 S38: 0.909), but every one is bound.
        expect(moon.e, moon.name).toBeLessThan(1);
        const kepler = (2 * Math.PI * Math.sqrt(moon.a ** 3 / GM[parent])) / 86400;
        expect(Math.abs(moon.period / kepler - 1), moon.name).toBeLessThan(parent === "pluto" ? 0.05 : 0.01);
      }
    }
  });

  it("know a size for almost every moon and say which sizes are only estimated", () => {
    const all = Object.keys(JPL_COUNTS).flatMap(smallMoonsOf);
    expect(all.filter((moon) => moon.radius === null).length).toBeLessThan(10);
    for (const moon of all) if (moon.radius !== null) expect(moon.radius, moon.name).toBeGreaterThan(0);
    expect(all.find((moon) => moon.name === "Thebe")?.measured).toBe(true);
    expect(all.filter((moon) => !moon.measured).length).toBeGreaterThan(300);
  });

  it("include the far, captured moons, most of which orbit backwards", () => {
    const outer = smallMoonsOf("saturn").filter((moon) => moon.a > 10_000_000);
    expect(outer.length).toBeGreaterThan(200);
    expect(outer.filter(isRetrograde).length / outer.length).toBeGreaterThan(0.6);
  });
});
