import { describe, expect, it } from "vitest";
import { LANDMARKS } from "@/app/map/landmarks";
import { SOLAR_SYSTEM_PLANETS } from "@/app/solar-system/data";
import { SOLAR_BODIES } from "@/app/solar-system/bodies";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SMALL_MOON_LIST } from "@/app/solar-system/smallMoons";
import { LOCALES } from "@/i18n/locales";
import { messagesFor, nameOf } from "@/i18n/messages";
import { de } from "@/i18n/messages/de";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";

const TRANSLATIONS = [
  ["German", de],
  ["Turkish", tr],
] as const;

/** Every text of a catalogue with the path that leads to it. Functions are left out: the compiler checks those. */
function texts(node: unknown, path = ""): [path: string, text: string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, index) => texts(item, `${path}[${index}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => texts(value, path ? `${path}.${key}` : key));
  }
  return [];
}

const places = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

/** The tables that hold translations by name. English leaves them empty, so they have no counterpart to compare with. */
const BY_NAME = /^(names|client\.map\.landmarks|facts\.methods|facts\.groups|body\.summaries|body\.mapNotes)\./;

describe.each(TRANSLATIONS)("the %s texts", (_, m) => {
  const english = new Map(texts(en).filter(([path]) => !BY_NAME.test(path)));
  const translated = new Map(texts(m).filter(([path]) => !BY_NAME.test(path)));

  it("hold every text the English ones hold, and lists of the same length", () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("keep every place that is filled in, such as {name}", () => {
    for (const [path, text] of english) expect(places(translated.get(path) ?? ""), path).toEqual(places(text));
  });

  it("leave no text empty and none in English that has a sentence to translate", () => {
    for (const [path, text] of translated) {
      expect(text.trim(), path).not.toBe("");
      // The names of the sources stay as their publishers write them.
      const properName = /(^|\.)(factSheets?|plutoFactSheet|jpl|subtitle)$/.test(path);
      if (/\s\w+\s\w+\s/.test(text) && !properName) expect(text, path).not.toBe(english.get(path));
    }
  });

  it("tell about every body of the solar system and every map that is not what it seems", () => {
    expect(Object.keys(m.body.summaries).sort()).toEqual(SOLAR_BODIES.map((body) => body.slug).sort());
    const noted = Object.entries(MAP_SOURCES).filter(([, source]) => source.note);
    expect(Object.keys(m.body.mapNotes).sort()).toEqual(noted.map(([slug]) => slug).sort());
  });

  it("name only bodies, sights and groups that exist", () => {
    const slugs = new Set(["sun", ...SOLAR_SYSTEM_PLANETS.map((planet) => planet.slug), ...SOLAR_BODIES.map((body) => body.slug)]);
    for (const slug of Object.keys(m.names)) expect(slugs, slug).toContain(slug);
    const sights = new Set(LANDMARKS.map((landmark) => landmark.name));
    for (const name of Object.keys(m.client.map.landmarks)) expect(sights, name).toContain(name);
    const groups = new Set(SMALL_MOON_LIST.map((moon) => moon.group));
    for (const group of groups) if (group !== null) expect(m.facts.groups[group], group).toBeTruthy();
  });

  it("say their own language", () => {
    expect(messagesFor(m.locale)).toBe(m);
    expect(LOCALES).toContain(m.locale);
  });
});

describe("the names of bodies", () => {
  it("are the ones of the language, and the English ones where a language has none of its own", () => {
    expect(nameOf(de, "earth", "Earth")).toBe("Erde");
    expect(nameOf(tr, "earth", "Earth")).toBe("Dünya");
    expect(nameOf(tr, "moon", "Moon")).toBe("Ay");
    expect(nameOf(de, "titan", "Titan")).toBe("Titan");
    expect(nameOf(en, "earth", "Earth")).toBe("Earth");
  });
});

const kind = (planetClass: "rocky" | "super_earth" | "neptune_like" | "gas_giant" | null, climateClass: "frozen" | "cold" | "temperate" | "hot" | null = null) => ({
  planetClass,
  climateClass,
});

describe("German sentences", () => {
  it("give the adjective the ending its noun and its place ask for", () => {
    expect(de.list.count(kind("rocky", "temperate"), 1, "")).toBe("1 gemäßigter Gesteinsplanet");
    expect(de.list.count(kind("super_earth", "hot"), 1, "")).toBe("1 heiße Supererde");
    expect(de.list.count(kind("neptune_like", "cold"), 12, "")).toBe("12 kalte neptunähnliche Planeten");
    expect(de.list.count(kind("gas_giant"), 2220, "")).toBe("2.220 Gasriesen");
    expect(de.list.empty(kind("gas_giant", "hot"), "")).toMatch(/^Der Katalog führt keine heißen Gasriesen\./);
    expect(de.list.empty(kind("super_earth", "frozen"), "x")).toMatch(/^Keine eisige Supererde passt zu „x“\./);
    expect(de.search.kindSimilar(kind("neptune_like"), "x")).toMatch(/^Kein neptunähnlicher Planet hat „x“ im Namen\./);
    expect(de.search.kindTooShort(2, kind(null))).toMatch(/um alle Planeten aufzulisten\.$/);
  });

  it("tell one match from several", () => {
    expect(de.list.count(kind(null), 1, "trapp")).toBe("1 Planet passt zu „trapp“");
    expect(de.list.count(kind(null), 7, "trapp")).toBe("7 Planeten passen zu „trapp“");
    expect(de.star.headline(false, "40,5", 1)).toBe("Stern, 40,5 Lichtjahre von der Sonne entfernt, mit einem bekannten Planeten");
    expect(de.star.headline(true, null, 8)).toBe("Unser eigener Stern mit 8 bekannten Planeten");
  });

  it("give the bodies of the solar system their article", () => {
    expect(de.body.moonOf("Erde")).toBe("Mond der Erde");
    expect(de.body.moonOf("Jupiter")).toBe("Mond des Jupiter");
    expect(de.body.headline("moon", "Erde")).toEqual(["Mond der ", ""]);
    expect(de.body.headline("dwarf_planet", "Sonne")).toEqual(["Zwergplanet, umkreist die ", ""]);
    expect(de.browse.onTo("Erde")).toBe("weiter zur Erde");
    expect(de.browse.backTo("Saturn")).toBe("zurück zum Saturn");
    expect(de.browse.onTo("Proxima Cen b")).toBe("weiter zu Proxima Cen b");
    expect(de.planet.headline("Gesteinsplanet, gemäßigt", true)).toEqual(["Gesteinsplanet, gemäßigt, umkreist die ", ""]);
  });
});

describe("Turkish sentences", () => {
  it("give each name the ending its last vowel asks for", () => {
    const owners = ["Dünya", "Mars", "Jüpiter", "Satürn", "Uranüs", "Neptün", "Plüton"].map((name) => tr.body.moonOf(name));
    expect(owners).toEqual([
      "Dünya’nın uydusu",
      "Mars’ın uydusu",
      "Jüpiter’in uydusu",
      "Satürn’ün uydusu",
      "Uranüs’ün uydusu",
      "Neptün’ün uydusu",
      "Plüton’un uydusu",
    ]);
    expect(tr.facts.distanceFrom("Dünya")).toBe("Dünya’ya uzaklık");
    expect(tr.facts.distanceFrom("Satürn")).toBe("Satürn’e uzaklık");
    expect(tr.facts.distanceFrom("Mars")).toBe("Mars’a uzaklık");
  });

  it("put the ending behind the link to what a body orbits", () => {
    expect(tr.body.headline("moon", "Satürn")).toEqual(["", "’ün uydusu"]);
    expect(tr.body.headline("dwarf_planet", "Güneş")).toEqual(["", "’in çevresinde dönen cüce gezegen"]);
    expect(tr.planet.headline("Kayalık gezegen, ılıman", true)).toEqual(["Kayalık gezegen, ılıman · ", "’in çevresinde dönüyor"]);
  });

  it("keep the noun in the singular after a number", () => {
    expect(tr.list.count(kind("gas_giant", "hot"), 3, "")).toBe("3 sıcak gaz devi");
    expect(tr.list.count(kind("gas_giant", "hot"), 3, "kep")).toBe("“kep” ile eşleşen 3 sıcak gaz devi");
    expect(tr.search.kindTooShort(2, kind("gas_giant"))).toMatch(/tüm gaz devlerini listelemek için/);
  });
});
