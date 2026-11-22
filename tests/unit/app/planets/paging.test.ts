import { describe, expect, it } from "vitest";
import { listHref, parseFilter, parseSort } from "@/app/planets/paging";

describe("parseFilter", () => {
  it("trims the text and treats a missing value as empty", () => {
    expect(parseFilter("  kepler 22 ")).toBe("kepler 22");
    expect(parseFilter(undefined)).toBe("");
    expect(parseFilter(["trappist", "x"])).toBe("trappist");
  });
});

describe("parseSort", () => {
  it("knows the order by discovery and falls back to the order by name", () => {
    expect(parseSort("discovery")).toBe("discovery");
    expect(parseSort(["discovery", "name"])).toBe("discovery");
    expect(parseSort(" discovery ")).toBe("discovery");
    for (const value of [undefined, "", "name", "Discovery", "year", "discovery desc"]) {
      expect(parseSort(value)).toBe("name");
    }
  });
});

describe("listHref", () => {
  it("leaves out page 1 and an empty filter", () => {
    expect(listHref("")).toBe("/planets");
    expect(listHref("", 1)).toBe("/planets");
    expect(listHref("", 3)).toBe("/planets?page=3");
  });

  it("encodes the filter", () => {
    expect(listHref("kepler 22")).toBe("/planets?q=kepler+22");
    expect(listHref("a&b=c", 2)).toBe("/planets?q=a%26b%3Dc&page=2");
  });

  it("names the order only when it is not by name", () => {
    expect(listHref("", 1, "name")).toBe("/planets");
    expect(listHref("", 1, "discovery")).toBe("/planets?sort=discovery");
    expect(listHref("toi", 4, "discovery")).toBe("/planets?q=toi&sort=discovery&page=4");
  });
});

describe("listHref with a kind of planet", () => {
  it("names the class and the climate between the filter and the order", () => {
    expect(listHref("", 1, "name", { planetClass: "gas_giant", climateClass: null })).toBe("/planets?type=gas_giant");
    expect(listHref("", 1, "name", { planetClass: null, climateClass: "temperate" })).toBe("/planets?climate=temperate");
    expect(listHref("kepler", 2, "discovery", { planetClass: "rocky", climateClass: "hot" })).toBe(
      "/planets?q=kepler&type=rocky&climate=hot&sort=discovery&page=2",
    );
  });

  it("leaves an open filter out", () => {
    expect(listHref("", 1, "name", { planetClass: null, climateClass: null })).toBe("/planets");
  });
});
