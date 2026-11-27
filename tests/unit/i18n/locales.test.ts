import { describe, expect, it } from "vitest";
import { hasLocale, localHref, matchLocale, splitLocale } from "@/i18n/locales";

describe("localHref", () => {
  it("puts the language in front of an address within the site", () => {
    expect(localHref("de", "/planets/earth")).toBe("/de/planets/earth");
    expect(localHref("tr", "/map?system=sun")).toBe("/tr/map?system=sun");
    expect(localHref("en", "/")).toBe("/en");
  });
});

describe("splitLocale", () => {
  it("tells the language of an address from the rest of it", () => {
    expect(splitLocale("/de/planets/earth")).toEqual({ locale: "de", rest: "/planets/earth" });
    expect(splitLocale("/tr")).toEqual({ locale: "tr", rest: "/" });
  });

  it("finds no language where the first part only resembles one", () => {
    expect(splitLocale("/planets/earth")).toEqual({ locale: null, rest: "/planets/earth" });
    expect(splitLocale("/dex")).toEqual({ locale: null, rest: "/dex" });
    expect(splitLocale("/")).toEqual({ locale: null, rest: "/" });
  });
});

describe("matchLocale", () => {
  it("picks the first language of the browser that the site has", () => {
    expect(matchLocale("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(matchLocale("fr-FR,tr;q=0.8,en;q=0.5")).toBe("tr");
    expect(matchLocale("TR")).toBe("tr");
  });

  it("follows the weights, not the order they are written in", () => {
    expect(matchLocale("en;q=0.3,de;q=0.9")).toBe("de");
    expect(matchLocale("de;q=0,tr;q=0.1")).toBe("tr");
  });

  it("falls back to English", () => {
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("")).toBe("en");
    expect(matchLocale("fr,es;q=0.8")).toBe("en");
    expect(matchLocale("*")).toBe("en");
  });
});

describe("hasLocale", () => {
  it("knows the three languages and nothing else", () => {
    expect(["en", "de", "tr"].every(hasLocale)).toBe(true);
    expect(hasLocale("fr")).toBe(false);
    expect(hasLocale("DE")).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
  });
});
