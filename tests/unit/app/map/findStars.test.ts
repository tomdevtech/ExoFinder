import { describe, expect, it } from "vitest";
import { findStars, MIN_LENGTH } from "@/app/map/findStars";
import type { MapStar } from "@/app/map/payload";

/** A star of the map by name alone, at the place of its index: the list arrives sorted by distance. */
const star = (name: string, index: number): MapStar => [name.toLowerCase().replace(/\s+/g, "-"), name, index, 0, 0, 5000, 1];
const stars = (...names: string[]) => names.map(star);

const found = (list: MapStar[], query: string) => findStars(list, query).map((index) => list[index][1]);

describe("findStars", () => {
  const sky = stars("Sun", "Proxima Cen", "Kepler-22", "TRAPPIST-1", "HD 10180", "Kepler-220", "tau Cet", "GJ 3512 Kepler");

  it("finds the stars whose name contains the text, whatever the case", () => {
    expect(found(sky, "trapp")).toEqual(["TRAPPIST-1"]);
    expect(found(sky, "CEN")).toEqual(["Proxima Cen"]);
  });

  it("puts names that start with the text before names that only contain it", () => {
    expect(found(sky, "kepler")).toEqual(["Kepler-22", "Kepler-220", "GJ 3512 Kepler"]);
  });

  it("keeps the nearest first among equal matches", () => {
    const far = stars("HD 2", "HD 1", "HD 3");
    expect(found(far, "hd")).toEqual(["HD 2", "HD 1", "HD 3"]);
  });

  it("ignores the spaces around the text", () => {
    expect(found(sky, "  sun ")).toEqual(["Sun"]);
  });

  it("asks for at least two characters", () => {
    expect(MIN_LENGTH).toBe(2);
    expect(found(sky, "")).toEqual([]);
    expect(found(sky, "k")).toEqual([]);
    expect(found(sky, " k ")).toEqual([]);
    expect(found(sky, "ke")).toHaveLength(3);
  });

  it("offers eight stars at most, names that start with the text first", () => {
    const many = stars(...Array.from({ length: 30 }, (_, i) => (i % 3 === 0 ? `Wolf ${i}` : `HIP ${i} Wolf`)));
    const hits = found(many, "wolf");
    expect(hits).toHaveLength(8);
    expect(hits).toEqual(["Wolf 0", "Wolf 3", "Wolf 6", "Wolf 9", "Wolf 12", "Wolf 15", "Wolf 18", "Wolf 21"]);
  });

  it("fills up with names that contain the text when few start with it", () => {
    const many = stars("Wolf 1", ...Array.from({ length: 20 }, (_, i) => `HIP ${i} Wolf`));
    const hits = found(many, "wolf");
    expect(hits).toHaveLength(8);
    expect(hits[0]).toBe("Wolf 1");
    expect(hits.slice(1)).toEqual(Array.from({ length: 7 }, (_, i) => `HIP ${i} Wolf`));
  });

  it("finds nothing in an empty sky or for a name no star has", () => {
    expect(found([], "kepler")).toEqual([]);
    expect(found(sky, "zzz")).toEqual([]);
  });

  it("reads the text as text, not as a pattern", () => {
    expect(found(sky, ".*")).toEqual([]);
    expect(found(sky, "kepler-22")).toEqual(["Kepler-22", "Kepler-220"]);
  });
});
