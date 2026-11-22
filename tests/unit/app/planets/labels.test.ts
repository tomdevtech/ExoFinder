import { describe, expect, it } from "vitest";
import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import { classifyClimate, classifyPlanet } from "@/app/planets/classify";
import { CLIMATE_CLASS_ORDER, PLANET_CLASS_ORDER, planetTypeNoun } from "@/app/planets/labels";

describe("the orders of the classes", () => {
  it("name every class a planet can get, from the smallest to the largest", () => {
    const classes = [0.5, 1.5, 4, 11].map((radius) => classifyPlanet(radius, null));
    expect(PLANET_CLASS_ORDER).toEqual(classes satisfies (PlanetClass | null)[]);
  });

  it("name every climate a planet can get, from the coldest to the hottest", () => {
    const climates = [100, 200, 300, 600, 2000].map((kelvin) => classifyClimate(kelvin));
    expect(CLIMATE_CLASS_ORDER).toEqual(climates satisfies (ClimateClass | null)[]);
  });
});

describe("planetTypeNoun", () => {
  it("names a class for one planet and for several", () => {
    expect(planetTypeNoun("gas_giant", null, 1)).toBe("gas giant");
    expect(planetTypeNoun("gas_giant", null, 1912)).toBe("gas giants");
    expect(planetTypeNoun("super_earth", null, 2)).toBe("super-Earths");
    expect(planetTypeNoun("neptune_like", null, 1)).toBe("Neptune-like planet");
  });

  it("puts the climate in front", () => {
    expect(planetTypeNoun("rocky", "temperate", 23)).toBe("temperate rocky planets");
    expect(planetTypeNoun("gas_giant", "scorching", 1)).toBe("scorching gas giant");
  });

  it("speaks of planets when only the climate is given, or nothing", () => {
    expect(planetTypeNoun(null, "frozen", 0)).toBe("frozen planets");
    expect(planetTypeNoun(null, "hot", 1)).toBe("hot planet");
    expect(planetTypeNoun(null, null, 5)).toBe("planets");
  });
});
