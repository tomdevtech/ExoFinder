import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOLAR_SEQUENCE } from "@/app/browse/order";
import { withDerived } from "@/app/planets/measurements";
import { SOLAR_SYSTEM_PLANETS, SUN } from "@/app/solar-system/data";
import type { Planet, Star } from "@/db/schema";
import { exoplanetEntries, solarEntries, type CatalogueEntry } from "../../scripts/catalogue-entries";
import { catalogueStamp, writeCatalogue } from "../../scripts/catalogue-pdf";
import { meshView } from "../../scripts/catalogue-pictures";

const star = (values: Partial<Star>): Star => ({
  id: 1,
  slug: "sun",
  name: "Sun",
  searchName: "sun",
  source: "sol",
  hip: null,
  hd: null,
  gaiaId: null,
  ra: null,
  dec: null,
  distPc: 0,
  x: 0,
  y: 0,
  z: 0,
  spectralType: null,
  teffK: 5772,
  radiusSun: 1,
  massSun: 1,
  vmag: null,
  planetCount: 8,
  updatedAt: new Date(0),
  ...values,
});

const planet = (name: string, slug: string, values: Partial<Planet>): Planet => ({
  id: 1,
  slug,
  name,
  searchName: slug,
  starId: 1,
  source: "nasa",
  status: "active",
  firstSeenAt: new Date(0),
  updatedAt: new Date(0),
  removedAt: null,
  ...withDerived({
    discoveryMethod: null,
    discoveryYear: null,
    discoveryFacility: null,
    orbitalPeriodDays: null,
    semiMajorAxisAu: null,
    eccentricity: null,
    radiusEarth: null,
    radiusCalculated: false,
    massEarth: null,
    massCalculated: false,
    massIsMinimum: false,
    density: null,
    densityCalculated: false,
    eqTempK: null,
    eqTempCalculated: false,
    insolation: null,
    insolationCalculated: false,
  }),
  ...values,
});

const SUN_ROW = star({ ...SUN });
const SOLAR_ROWS = SOLAR_SYSTEM_PLANETS.map(({ name, slug, ...measured }) => ({
  planet: withDerived({ ...planet(name, slug, { source: "sol" }), ...measured }),
  star: SUN_ROW,
  densityEarth: null,
}));
const SOLAR = solarEntries(SUN_ROW, SOLAR_ROWS);
const byName = (name: string) => SOLAR.find((entry) => entry.name === name)!;

describe("the pages of the solar system", () => {
  it("open with the Sun and follow the order and the numbers of the site", () => {
    expect(SOLAR[0]).toMatchObject({ name: "Sun", number: null, rank: "star", href: "/stars/sun", picture: { kind: "sun" } });
    const bodies = SOLAR.slice(1);
    expect(bodies.map((entry) => entry.href)).toEqual(SOLAR_SEQUENCE.map((entry) => entry.href));
    expect(bodies.map((entry) => entry.number)).toEqual(SOLAR_SEQUENCE.map((_, index) => index + 1));
  });

  it("draw each body the way the site does: from its map, its measured shape, or a made-up one", () => {
    expect(byName("Earth").picture.kind).toBe("globe");
    expect(byName("Titan").picture.kind).toBe("globe");
    expect(byName("Phobos").picture).toMatchObject({ kind: "shape", slug: "phobos", map: "/textures/planets/phobos-lg.jpg" });
    // No spacecraft mapped all of Hyperion, so it has a shape but no map.
    expect(byName("Hyperion").picture).toMatchObject({ kind: "shape", map: null });
    expect(byName("Himalia").picture.kind).toBe("invented");
    expect(byName("Himalia").pictureNote).toMatch(/^Illustration:/);
    expect(byName("Earth").pictureNote).toMatch(/real map/);
  });

  it("group every moon under the body it orbits, large moons apart from small ones", () => {
    expect(byName("Saturn")).toMatchObject({ group: "Saturn", rank: "main" });
    expect(byName("Titan")).toMatchObject({ group: "Saturn", rank: "moon", kind: "Moon of Saturn" });
    expect(byName("Charon")).toMatchObject({ group: "Pluto", rank: "moon" });
    expect(byName("Hydra")).toMatchObject({ group: "Pluto", rank: "small" });
    expect(byName("Ceres")).toMatchObject({ group: "Ceres", rank: "main", kind: "Dwarf planet orbiting the Sun" });
  });

  it("show the facts of the body's page on the site", () => {
    const sections = (entry: CatalogueEntry) => Object.fromEntries(entry.sections.map((section) => [section.title, section.rows]));
    expect(sections(byName("Saturn")).Orbit).toContainEqual({ label: "Known moons", value: "293" });
    expect(sections(byName("Mercury")).Orbit).toContainEqual({ label: "Known moons", value: "none" });
    expect(sections(byName("Moon")).Discovery).toEqual([{ label: "Known since", value: "antiquity" }]);
    expect(sections(byName("Europa")).Moon[0]).toEqual({ label: "Radius", value: "1,561 km (0.245 × Earth)" });
    expect(byName("Europa").text).toMatch(/shell of ice/);
  });
});

describe("the pages of the exoplanets", () => {
  const trappist = star({ id: 2, slug: "trappist-1", name: "TRAPPIST-1", source: "nasa", distPc: 12.429, teffK: 2566, spectralType: "M8 V" });
  const lost = star({ id: 3, slug: "nodist-1", name: "Nodist-1", source: "nasa", distPc: null });
  const row = (name: string, host: Star, values: Partial<Planet> = {}) => ({
    planet: planet(name, name.toLowerCase().replaceAll(" ", "-"), values),
    star: host,
    densityEarth: null,
  });
  const entries = exoplanetEntries([
    row("TRAPPIST-1 b", trappist, { radiusEarth: 1.116, radiusCalculated: true, planetClass: "rocky", climateClass: "hot", discoveryYear: 2016 }),
    row("Nodist-1 b", lost),
  ]);

  it("count on from the solar system", () => {
    expect(entries.map((entry) => entry.number)).toEqual([SOLAR_SEQUENCE.length + 1, SOLAR_SEQUENCE.length + 2]);
  });

  it("name the kind of planet, its star and the distance, where it is known", () => {
    expect(entries[0]).toMatchObject({
      kind: "Rocky planet, hot orbiting TRAPPIST-1, 40.5 light-years from the Sun",
      group: "TRAPPIST-1",
      groupNote: "40.5 light-years",
      chapter: "exoplanets",
      href: "/planets/trappist-1-b",
    });
    expect(entries[1]).toMatchObject({ kind: "Planet orbiting Nodist-1", groupNote: null });
  });

  it("carry the facts of the planet and its star, and say that the picture is an illustration", () => {
    const [b] = entries;
    expect(b.sections.map((section) => section.title)).toEqual(["Planet", "Orbit", "Discovery", "Host star: TRAPPIST-1"]);
    expect(b.sections[0].rows[0]).toEqual({ label: "Radius", value: "1.12 × Earth", note: "calculated" });
    expect(b.sections[3].rows[0]).toEqual({ label: "Spectral type", value: "M8 V" });
    expect(b.pictureNote).toMatch(/^Illustration: nobody has seen this planet up close/);
    expect(b.picture.kind).toBe("globe");
  });
});

describe("meshView", () => {
  it("stands far enough back for the whole body, slightly above it, with the star to the upper left", () => {
    const view = meshView(1.5, 0);
    const distance = Math.hypot(...view.camera);
    // The farthest point of the body, with a little room, fills half the field of view of 20 degrees.
    expect(distance * Math.sin((10 * Math.PI) / 180)).toBeCloseTo(1.5 * 1.08, 6);
    expect(view.camera[0]).toBeCloseTo(0, 9);
    expect(view.camera[1]).toBeGreaterThan(0);
    expect(view.camera[2]).toBeGreaterThan(0);
    expect(view.star[0]).toBeLessThan(0);
    expect(view.star[1]).toBeGreaterThan(0);
  });

  it("projects the centre of the body to the middle of the picture", () => {
    const { modelView, projection } = meshView(1, 0.7);
    // The fourth column of the model-view matrix is where the origin of the body lands in view space.
    const [x, y, z] = modelView.slice(12, 15);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeLessThan(0);
    expect(projection[11]).toBe(-1);
  });

  it("turns the camera and the star into the body's space when the body turns", () => {
    const still = meshView(1, 0);
    const turned = meshView(1, Math.PI / 2);
    // A quarter turn about the axis leaves the height and the distance of the camera as they were.
    expect(turned.camera[1]).toBeCloseTo(still.camera[1], 9);
    expect(Math.hypot(...turned.camera)).toBeCloseTo(Math.hypot(...still.camera), 9);
    expect(turned.camera[0]).toBeCloseTo(-still.camera[2], 9);
  });
});

describe("catalogueStamp", () => {
  const edition = { title: "The catalogue", claim: "A test", site: "https://example.org", date: new Date(Date.UTC(2026, 10, 27)) };
  const entries = SOLAR.slice(0, 12);
  const pictures = new Map(entries.map((entry, index) => [entry, `/somewhere/${index}.jpg`]));
  const stamp = catalogueStamp(edition, entries, pictures);

  it("is the same on another day and in another folder, so an unchanged catalogue is not written again", () => {
    const elsewhere = new Map(entries.map((entry, index) => [entry, `/elsewhere/${index}.jpg`]));
    expect(catalogueStamp({ ...edition, date: new Date(Date.UTC(2027, 0, 1)) }, entries, elsewhere)).toBe(stamp);
  });

  it("changes with a value, with a picture, with a new body and with the address of the site", () => {
    const earth = entries.findIndex((entry) => entry.name === "Earth");
    const corrected = entries.map((entry, index) => (index === earth ? { ...entry, kind: "Rocky planet, hot orbiting the Sun" } : entry));
    const stamps = [
      catalogueStamp(edition, corrected, new Map(corrected.map((entry, index) => [entry, `/somewhere/${index}.jpg`]))),
      catalogueStamp(edition, entries, new Map(pictures).set(entries[earth], "/somewhere/redrawn.jpg")),
      catalogueStamp(edition, SOLAR.slice(0, 13), new Map(SOLAR.slice(0, 13).map((entry, index) => [entry, `/somewhere/${index}.jpg`]))),
      catalogueStamp({ ...edition, site: "https://example.com" }, entries, pictures),
    ];
    expect(new Set([stamp, ...stamps]).size).toBe(5);
  });
});

describe("writeCatalogue", () => {
  let folder: string;
  let picture: string;
  beforeAll(async () => {
    folder = mkdtempSync(path.join(tmpdir(), "exofinder-catalogue-"));
    picture = path.join(folder, "picture.jpg");
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#203040" } }).jpeg().toFile(picture);
  });
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("writes a page for every body between the front matter and the sources, and counts them right", async () => {
    const entries = SOLAR.slice(0, 40);
    const file = path.join(folder, "catalogue.pdf");
    const edition = { title: "The catalogue", claim: "A test", site: "https://example.org", date: new Date(Date.UTC(2026, 10, 27)) };
    const { pages } = await writeCatalogue(file, edition, entries, new Map(entries.map((entry) => [entry, picture])));

    const pdf = readFileSync(file).toString("latin1");
    expect(pdf.startsWith("%PDF-1.7")).toBe(true);
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(pages);
    // Cover, foreword, one page of contents, the chapter page and the bodies; then the sources and one page of index.
    const sources = pages - (3 + 1 + entries.length) - 1;
    expect(sources).toBeGreaterThanOrEqual(2);
    expect(sources).toBeLessThanOrEqual(6);
    // Every page can be reached by name, which is how the contents and the index link to it.
    for (const page of [1, 4, 5, pages]) expect(pdf).toContain(`(page-${page})`);
    // The same picture is stored once, however many pages show it.
    expect(pdf.match(/\/Subtype \/Image\b/g)).toHaveLength(1);
  });

  it("refuses to write a body without a picture", async () => {
    const edition = { title: "The catalogue", claim: "A test", site: "https://example.org", date: new Date() };
    await expect(writeCatalogue(path.join(folder, "broken.pdf"), edition, SOLAR.slice(0, 3), new Map())).rejects.toThrow(/has no picture/);
  });
});
