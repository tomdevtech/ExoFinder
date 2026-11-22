import { describe, expect, it } from "vitest";
import { countText, emptyText, rangeText } from "@/app/planets/listText";
import { NO_FILTER, type TypeFilter } from "@/app/planets/typeFilter";

const GAS_GIANTS: TypeFilter = { planetClass: "gas_giant", climateClass: null };
const HOT_GAS_GIANTS: TypeFilter = { planetClass: "gas_giant", climateClass: "hot" };
const TEMPERATE: TypeFilter = { planetClass: null, climateClass: "temperate" };

describe("countText", () => {
  it("counts the planets of a kind with thousands separators", () => {
    expect(countText(NO_FILTER, 6478, "")).toBe("6,478 planets");
    expect(countText(GAS_GIANTS, 2220, "")).toBe("2,220 gas giants");
    expect(countText(HOT_GAS_GIANTS, 512, "")).toBe("512 hot gas giants");
    expect(countText(TEMPERATE, 87, "")).toBe("87 temperate planets");
  });

  it("uses the singular for one planet", () => {
    expect(countText(NO_FILTER, 1, "")).toBe("1 planet");
    expect(countText(GAS_GIANTS, 1, "")).toBe("1 gas giant");
  });

  it("names the text the planets match, with the verb in the right number", () => {
    expect(countText(NO_FILTER, 7, "trapp")).toBe("7 planets match “trapp”");
    expect(countText(NO_FILTER, 1, "kepler-22")).toBe("1 planet matches “kepler-22”");
    expect(countText(GAS_GIANTS, 3, "hd")).toBe("3 gas giants match “hd”");
  });
});

describe("rangeText", () => {
  it("is empty when the whole list fits on one page", () => {
    expect(rangeText(1, 200, 7, 7)).toBe("");
    expect(rangeText(1, 200, 200, 200)).toBe("");
    expect(rangeText(1, 60, 0, 0)).toBe("");
  });

  it("names the first and the last planet of the page", () => {
    expect(rangeText(1, 200, 200, 6478)).toBe(" · showing 1–200");
    expect(rangeText(3, 200, 200, 6478)).toBe(" · showing 401–600");
    expect(rangeText(2, 60, 60, 2220)).toBe(" · showing 61–120");
  });

  it("ends a last page that is not full at its last planet", () => {
    expect(rangeText(33, 200, 78, 6478)).toBe(" · showing 6,401–6,478");
  });
});

describe("emptyText", () => {
  it("says that the catalogue has no planet of the kind when nothing was typed", () => {
    expect(emptyText(HOT_GAS_GIANTS, "")).toBe(
      "The catalogue lists no hot gas giants. Remove one of the two filters to see more.",
    );
  });

  it("says that no planet of the kind matches the text", () => {
    expect(emptyText(GAS_GIANTS, "xyz")).toBe(
      "No gas giant matches “xyz”. Try a shorter part of the name, or remove a filter.",
    );
    expect(emptyText(TEMPERATE, "xyz")).toBe(
      "No temperate planet matches “xyz”. Try a shorter part of the name, or remove a filter.",
    );
  });
});
