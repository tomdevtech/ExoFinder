import { describe, expect, it } from "vitest";
import { SOURCE_GROUPS } from "@/app/credits/sources";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SHAPE_SOURCES } from "@/app/solar-system/shapes";

const all = SOURCE_GROUPS.flatMap((group) => group.sources);
const group = (title: string) => SOURCE_GROUPS.find((candidate) => candidate.title === title)!;

describe("the sources", () => {
  it("name every map and every shape model by its body, so a new one is credited by itself", () => {
    const maps = group("Maps of the moons, the dwarf planets and Vesta").sources;
    expect(maps).toHaveLength(Object.keys(MAP_SOURCES).length);
    expect(maps.find((source) => source.subject === "Titan")).toMatchObject({
      credit: MAP_SOURCES.titan.credit,
      licence: { name: "public domain", url: null },
    });
    const shapes = group("Shapes of the irregular bodies").sources;
    expect(shapes).toHaveLength(Object.keys(SHAPE_SOURCES).length);
    expect(shapes.map((source) => source.subject)).toContain("Phobos");
  });

  it("give every source an address, and a licence with its address where the licence asks to be named", () => {
    for (const source of all) {
      expect(source.url, source.subject).toMatch(/^https:\/\//);
      expect(source.credit.length, source.subject).toBeGreaterThan(3);
    }
    const attributed = all.filter((source) => source.licence?.name === "CC BY 4.0");
    expect(attributed.map((source) => source.subject)).toEqual([
      "Sky panorama",
      "Picture of the galaxy",
      "The Sun, the eight planets and Saturn’s rings",
    ]);
    for (const source of attributed) expect(source.licence?.url).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("list each subject once within its group, which the page and the catalogue tell the entries apart by", () => {
    for (const { title, sources } of SOURCE_GROUPS) {
      const subjects = sources.map((source) => source.subject);
      expect(new Set(subjects).size, title).toBe(subjects.length);
    }
  });

  it("say where the values and the methods come from", () => {
    const credits = all.map((source) => source.credit).join("\n");
    for (const name of ["NASA Exoplanet Archive", "NASA Planetary Fact Sheet", "JPL Solar System Dynamics", "Chen", "Sudarsky", "Kopparapu", "Nimmo"]) {
      expect(credits, name).toContain(name);
    }
  });
});
