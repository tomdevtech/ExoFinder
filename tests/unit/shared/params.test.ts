import { describe, expect, it } from "vitest";
import { firstParam, hrefWith } from "@/shared/params";

describe("firstParam", () => {
  it("returns the value without the spaces around it", () => {
    expect(firstParam("kepler")).toBe("kepler");
    expect(firstParam("  kepler 22 ")).toBe("kepler 22");
  });

  it("takes the first value of a param that the address gives twice", () => {
    expect(firstParam(["trappist", "kepler"])).toBe("trappist");
    expect(firstParam([" trappist "])).toBe("trappist");
  });

  it("is empty for a missing param", () => {
    expect(firstParam(undefined)).toBe("");
    expect(firstParam([])).toBe("");
    expect(firstParam("")).toBe("");
  });
});

describe("hrefWith", () => {
  it("is the bare path when nothing is asked for", () => {
    expect(hrefWith("/planets", {})).toBe("/planets");
    expect(hrefWith("/planets", { q: "", type: null, page: false })).toBe("/planets");
  });

  it("keeps the params in the order given and leaves out the empty ones", () => {
    expect(hrefWith("/search", { q: "kepler", type: null, climate: "hot", page: "3" })).toBe(
      "/search?q=kepler&climate=hot&page=3",
    );
  });

  it("encodes what the visitor typed, so it cannot add a param of its own", () => {
    expect(hrefWith("/search", { q: "a&type=rocky" })).toBe("/search?q=a%26type%3Drocky");
    expect(hrefWith("/planets", { q: "kepler 22" })).toBe("/planets?q=kepler+22");
  });
});
