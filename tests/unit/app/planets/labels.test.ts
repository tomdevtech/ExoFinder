import { describe, expect, it } from "vitest";
import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import { classifyClimate, classifyPlanet } from "@/app/planets/classify";
import { CLIMATE_CLASS_ORDER, PLANET_CLASS_ORDER } from "@/app/planets/labels";

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
