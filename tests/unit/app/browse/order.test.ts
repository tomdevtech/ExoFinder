import { describe, expect, it } from "vitest";
import { SOLAR_SEQUENCE } from "@/app/browse/order";
import { SOLAR_BODIES, solarBody } from "@/app/solar-system/bodies";
import { SOLAR_SYSTEM_PLANETS } from "@/app/solar-system/data";
import { SMALL_MOON_LIST, smallMoon } from "@/app/solar-system/smallMoons";

const names = SOLAR_SEQUENCE.map((entry) => entry.name);
const slugOf = (href: string) => href.slice(href.lastIndexOf("/") + 1);

describe("the order of the solar system", () => {
  it("runs from the inside out, each body followed by its moons", () => {
    expect(names.slice(0, 10)).toEqual([
      "Mercury",
      "Venus",
      "Earth",
      "Moon",
      "Mars",
      "Phobos",
      "Deimos",
      "Vesta",
      "Ceres",
      "Jupiter",
    ]);
    expect(names.slice(-6)).toEqual(["Pluto", "Charon", "Styx", "Nix", "Kerberos", "Hydra"]);
  });

  it("lists the large moons of a planet before its small ones, both from the inside out", () => {
    const jupiter = names.indexOf("Jupiter");
    expect(names.slice(jupiter + 1, jupiter + 6)).toEqual(["Io", "Europa", "Ganymede", "Callisto", "Metis"]);
  });

  it("holds every planet, every body with a page and every small moon exactly once", () => {
    expect(SOLAR_SEQUENCE).toHaveLength(SOLAR_SYSTEM_PLANETS.length + SOLAR_BODIES.length + SMALL_MOON_LIST.length);
    expect(new Set(SOLAR_SEQUENCE.map((entry) => entry.href)).size).toBe(SOLAR_SEQUENCE.length);
  });

  it("links the planets to their planet pages and everything else to the pages of the solar system", () => {
    const planets = new Set(SOLAR_SYSTEM_PLANETS.map((planet) => planet.slug));
    for (const { href } of SOLAR_SEQUENCE) {
      const slug = slugOf(href);
      expect(href, href).toBe(planets.has(slug) ? `/planets/${slug}` : `/solar-system/${slug}`);
      if (!planets.has(slug)) expect(solarBody(slug) ?? smallMoon(slug), href).toBeDefined();
    }
  });

  it("puts every moon behind the body it orbits", () => {
    let orbited = "";
    for (const entry of SOLAR_SEQUENCE) {
      const slug = slugOf(entry.href);
      if (entry.orbitsSun) orbited = slug;
      else expect((solarBody(slug) ?? smallMoon(slug))?.parent, entry.name).toBe(orbited);
    }
  });
});
