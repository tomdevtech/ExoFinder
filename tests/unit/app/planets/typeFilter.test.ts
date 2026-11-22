import { describe, expect, it } from "vitest";
import { isFiltered, NO_FILTER, parseTypeFilter } from "@/app/planets/typeFilter";

describe("parseTypeFilter", () => {
  it("reads the class and the climate from the address", () => {
    expect(parseTypeFilter("gas_giant", "hot")).toEqual({ planetClass: "gas_giant", climateClass: "hot" });
    expect(parseTypeFilter(" rocky ", undefined)).toEqual({ planetClass: "rocky", climateClass: null });
    expect(parseTypeFilter(undefined, "temperate")).toEqual({ planetClass: null, climateClass: "temperate" });
  });

  it("takes the first value when the address names a part twice", () => {
    expect(parseTypeFilter(["super_earth", "rocky"], ["cold", "hot"])).toEqual({ planetClass: "super_earth", climateClass: "cold" });
  });

  it("leaves open whatever is not a known class or climate", () => {
    for (const value of [undefined, "", "Gas_Giant", "gas-giant", "hot", "planet", "' or 1=1 --", "rocky,gas_giant"]) {
      expect(parseTypeFilter(value, undefined).planetClass, String(value)).toBeNull();
    }
    for (const value of [undefined, "", "warm", "rocky", "HOT", "%"]) {
      expect(parseTypeFilter(undefined, value).climateClass, String(value)).toBeNull();
    }
  });
});

describe("isFiltered", () => {
  it("is true as soon as one part is set", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(isFiltered({ planetClass: "rocky", climateClass: null })).toBe(true);
    expect(isFiltered({ planetClass: null, climateClass: "frozen" })).toBe(true);
  });
});
