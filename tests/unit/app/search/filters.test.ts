import { describe, expect, it } from "vitest";
import { parseTypeFilter } from "@/app/planets/typeFilter";
import { searchHref } from "@/app/search/filters";

describe("searchHref", () => {
  it("leaves out whatever is empty, and page 1", () => {
    expect(searchHref("")).toBe("/search");
    expect(searchHref("kepler 22")).toBe("/search?q=kepler+22");
    expect(searchHref("", { planetClass: "gas_giant", climateClass: null })).toBe("/search?type=gas_giant");
    expect(searchHref("", { planetClass: null, climateClass: "temperate" }, 1)).toBe("/search?climate=temperate");
  });

  it("names the query, the filter and the page", () => {
    expect(searchHref("kepler", { planetClass: "rocky", climateClass: "temperate" }, 3)).toBe(
      "/search?q=kepler&type=rocky&climate=temperate&page=3",
    );
  });

  it("gives back what parseTypeFilter reads", () => {
    const filter = { planetClass: "neptune_like", climateClass: "scorching" } as const;
    const params = new URL(searchHref("", filter), "http://localhost").searchParams;
    expect(parseTypeFilter(params.get("type") ?? undefined, params.get("climate") ?? undefined)).toEqual(filter);
  });

  it("escapes the query", () => {
    expect(searchHref("a&type=rocky")).toBe("/search?q=a%26type%3Drocky");
  });
});
