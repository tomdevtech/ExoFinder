import { describe, expect, it } from "vitest";
import { getPlanetsBySlug, listPlanets } from "@/app/planets/queries";
import { search, searchByType, type SearchHit } from "@/app/search/query";

const names = (hits: SearchHit[]) =>
  hits.map((hit) => (hit.kind === "planet" ? hit.planet.name : hit.kind === "star" ? hit.star.name : hit.body.name));

describe("search", () => {
  it("puts the exact name first", async () => {
    const { hits, similarOnly } = await search("Kepler-22 b", 10);
    expect(similarOnly).toBe(false);
    expect(names(hits)[0]).toBe("Kepler-22 b");
  });

  it("ignores spelling details", async () => {
    for (const query of ["kepler 22 b", "KEPLER22B", "kepler-22b", "  Kepler 22b  "]) {
      const { hits } = await search(query, 10);
      expect(names(hits)[0], query).toBe("Kepler-22 b");
    }
  });

  it("ranks whole numbers before names that merely start with the query", async () => {
    const { hits } = await search("kepler 22", 10);
    const found = names(hits);
    // An exact match ranks first, so the star and its planet come before Kepler-220.
    expect(found.slice(0, 2)).toEqual(["Kepler-22", "Kepler-22 b"]);
    expect(found.indexOf("Kepler-220 b")).toBeGreaterThan(found.indexOf("Kepler-22 b"));
    expect(found).not.toContain("Kepler-12 b");
  });

  it("finds planets and stars together", async () => {
    const { hits } = await search("trappist", 20);
    expect(hits.filter((hit) => hit.kind === "star")).toHaveLength(1);
    expect(hits.filter((hit) => hit.kind === "planet")).toHaveLength(7);
  });

  it("reports when there are more hits than the limit", async () => {
    const limited = await search("trappist", 5);
    expect(limited.hits).toHaveLength(5);
    expect(limited.hasMore).toBe(true);
    const all = await search("trappist", 8);
    expect(all.hasMore).toBe(false);
  });

  it("falls back to similar names for typos", async () => {
    const { hits, similarOnly } = await search("proxma cen", 10);
    expect(similarOnly).toBe(true);
    expect(names(hits)).toContain("Proxima Cen b");
  });

  it("answers with nothing for queries that are too short", async () => {
    for (const query of ["", "x", " k ", "!!", "%", "_", "--"]) {
      const result = await search(query, 10);
      expect(result, JSON.stringify(query)).toEqual({ hits: [], similarOnly: false, hasMore: false });
    }
  });

  it("finds the moons and dwarf planets, which live in code, among the planets and stars", async () => {
    const { hits } = await search("ganymede", 10);
    expect(hits[0]).toMatchObject({ kind: "body", body: { slug: "ganymede" } });
    // A two-letter name still comes first when it matches exactly.
    expect(names((await search("io", 10)).hits)[0]).toBe("Io");
    expect(names((await search("pluto", 10)).hits)).toContain("Pluto");
  });

  it("also lists planets that NASA withdrew, marked as removed", async () => {
    const { hits } = await search("retracted 1 b", 10);
    const planet = hits.find((hit) => hit.kind === "planet");
    expect(planet?.kind === "planet" && planet.planet.status).toBe("removed");
  });

  it("describes a planet exactly as the lists do, without the keys it sorted by", async () => {
    const { hits } = await search("Kepler-22 b", 10);
    const found = hits.find((hit) => hit.kind === "planet");
    const [listed] = await getPlanetsBySlug(["kepler-22-b"]);
    expect(found?.kind === "planet" && found.planet).toEqual(listed);
  });

  it("describes a star by its name, its temperature and the number of its planets", async () => {
    const { hits } = await search("trappist-1", 10);
    const found = hits.find((hit) => hit.kind === "star");
    expect(found?.kind === "star" && found.star).toEqual({
      slug: "trappist-1",
      name: "TRAPPIST-1",
      teffK: expect.any(Number),
      planetCount: 7,
    });
  });
});

describe("search with hostile input", () => {
  // The search reduces every query to a-z and 0-9 before it reaches SQL, so none
  // of these inputs may cause an error or match everything.
  const hostile = [
    "' OR 1=1 --",
    "'; DROP TABLE planets; --",
    "\" OR \"\"=\"",
    "%' OR '%'='",
    "kepler%",
    "kepler_22",
    ".*",
    "(a+)+$",
    "\\",
    "\u0000kepler",
    "<script>alert(1)</script>",
    "${7*7}",
    "😀🪐",
    "ΚΕΠΛΕΡ",
  ];

  it.each(hostile)("handles %j", async (query) => {
    const { hits } = await search(query, 50);
    // The catalogue has more than 20 entries, so matching all of them would mean
    // that the input changed the query.
    expect(hits.length).toBeLessThan(20);
  });

  it("cuts off very long queries", async () => {
    // A query of 30,000 characters reaches the database as 80. The similarity
    // search may still find Kepler names in "keplerkepler…", but nothing breaks.
    const result = await search("kepler".repeat(5_000), 10);
    expect(result.hits.length).toBeLessThanOrEqual(10);
    // Anything beyond the first 80 characters must be ignored.
    const tail = await search(`${"z".repeat(80)}kepler-22 b`, 10);
    expect(names(tail.hits)).not.toContain("Kepler-22 b");
  });

  it("still finds the planet when junk surrounds the name", async () => {
    const { hits } = await search("<b>kepler-22 b</b>", 10);
    // The tags reduce to "b" and "b", so the key is "bkepler22bb", which finds
    // nothing but must not cause an error either.
    expect(Array.isArray(hits)).toBe(true);
    const plain = await search("kepler-22 b'; --", 10);
    expect(names(plain.hits)[0]).toBe("Kepler-22 b");
  });
});

describe("searchByType", () => {
  const planetNames = (result: { planets: { name: string }[] }) => result.planets.map((planet) => planet.name);

  it("lists every planet of a class by name when there is no query", async () => {
    const giants = await searchByType("", { planetClass: "gas_giant", climateClass: null }, 1, 50);
    expect(giants.total).toBe(giants.planets.length);
    expect(giants.similarOnly).toBe(false);
    expect(giants.planets.every((planet) => planet.planetClass === "gas_giant")).toBe(true);
    // The exoplanets and the giants of the solar system are listed together.
    expect(planetNames(giants)).toEqual(expect.arrayContaining(["51 Peg b", "Kepler-12 b", "Jupiter", "Saturn"]));
    expect(planetNames(giants)).not.toContain("Kepler-22 b");
    // Digits sort as numbers, as in the list of all planets.
    expect(planetNames(giants).indexOf("51 Peg b")).toBeLessThan(planetNames(giants).indexOf("Jupiter"));
  });

  it("narrows by climate alone, and by class and climate together", async () => {
    const temperate = await searchByType("", { planetClass: null, climateClass: "temperate" }, 1, 50);
    expect(temperate.planets.every((planet) => planet.climateClass === "temperate")).toBe(true);
    expect(planetNames(temperate)).toEqual(expect.arrayContaining(["TRAPPIST-1 e", "K2-18 b", "Kepler-22 b", "Earth"]));

    const both = await searchByType("", { planetClass: "rocky", climateClass: "temperate" }, 1, 50);
    expect(planetNames(both)).toEqual(expect.arrayContaining(["TRAPPIST-1 d", "TRAPPIST-1 e", "Earth"]));
    expect(planetNames(both)).not.toContain("K2-18 b");
    expect(planetNames(both)).not.toContain("TRAPPIST-1 f");
    expect(both.total).toBeLessThan(temperate.total);
  });

  it("keeps the names that match the query, ranked as in the search by name", async () => {
    const rocky = { planetClass: "rocky", climateClass: null } as const;
    const trappist = await searchByType("trappist", rocky, 1, 50);
    expect(trappist.total).toBe(7);
    expect(planetNames(trappist)[0]).toBe("TRAPPIST-1 b");

    const kepler = await searchByType("kepler 22", { planetClass: "neptune_like", climateClass: null }, 1, 50);
    expect(planetNames(kepler)[0]).toBe("Kepler-22 b");
    expect(planetNames(kepler)).not.toContain("Kepler-220 b");
  });

  it("reads one page at a time and counts them all", async () => {
    const rocky = { planetClass: "rocky", climateClass: null } as const;
    const all = await searchByType("trappist", rocky, 1, 50);
    const first = await searchByType("trappist", rocky, 1, 3);
    const second = await searchByType("trappist", rocky, 2, 3);
    const last = await searchByType("trappist", rocky, 3, 3);
    expect(first.total).toBe(7);
    expect([...planetNames(first), ...planetNames(second), ...planetNames(last)]).toEqual(planetNames(all));
    expect(last.planets).toHaveLength(1);
    // A page that does not exist shows the last one.
    const beyond = await searchByType("trappist", rocky, 99, 3);
    expect(beyond.page).toBe(3);
    expect(planetNames(beyond)).toEqual(planetNames(last));
  });

  it("leaves withdrawn planets out of the plain list but finds them by name", async () => {
    const [found] = (await search("retracted 1 b", 10)).hits.flatMap((hit) => (hit.kind === "planet" ? [hit.planet] : []));
    expect(found.status).toBe("removed");
    const type = { planetClass: found.planetClass, climateClass: null };
    expect(planetNames(await searchByType("", type, 1, 200))).not.toContain(found.name);
    expect(planetNames(await searchByType("retracted", type, 1, 200))).toContain(found.name);
  });

  it("falls back to similar names of the type for typos", async () => {
    const similar = await searchByType("proxma cen", { planetClass: "rocky", climateClass: null }, 1, 10);
    expect(similar.similarOnly).toBe(true);
    expect(planetNames(similar)).toContain("Proxima Cen b");
    // Proxima Cen b is no gas giant, so nothing there resembles the query.
    const none = await searchByType("proxma cen", { planetClass: "gas_giant", climateClass: null }, 1, 10);
    expect(none).toEqual({ planets: [], total: 0, page: 1, similarOnly: false });
  });

  it("answers with nothing for a query that is too short, and for a type no planet has", async () => {
    const giants = { planetClass: "gas_giant", climateClass: null } as const;
    for (const query of ["k", "!!", "%", " _ "]) {
      expect(await searchByType(query, giants, 1, 10), JSON.stringify(query)).toEqual({ planets: [], total: 0, page: 1, similarOnly: false });
    }
    const frozenSuperEarths = await searchByType("", { planetClass: "super_earth", climateClass: "frozen" }, 1, 10);
    expect(frozenSuperEarths.planets).toEqual([]);
  });

  it("describes its planets exactly as the lists do", async () => {
    const giants = { planetClass: "gas_giant", climateClass: null } as const;
    const { planets } = await searchByType("", giants, 1, 200);
    expect(planets).toEqual(await getPlanetsBySlug(planets.map((planet) => planet.slug)));
  });

  it("lists the same planets of a kind, in the same order, as the list of all planets", async () => {
    for (const kind of [
      { planetClass: "gas_giant", climateClass: null },
      { planetClass: null, climateClass: "temperate" },
      { planetClass: "rocky", climateClass: "temperate" },
    ] as const) {
      const searched = await searchByType("", kind, 1, 200);
      const listed = await listPlanets("", 1, "name", kind);
      expect(searched.total, JSON.stringify(kind)).toBe(listed.total);
      expect(searched.planets.map((planet) => planet.slug)).toEqual(listed.planets.map((planet) => planet.slug));
    }
  });

  it("moves a page beyond the end to the last page, and one before the start to the first", async () => {
    const giants = { planetClass: "gas_giant", climateClass: null } as const;
    const { total } = await searchByType("", giants, 1, 2);
    expect((await searchByType("", giants, 999, 2)).page).toBe(Math.ceil(total / 2));
    expect((await searchByType("", giants, 0, 2)).page).toBe(1);
  });

  it("is not opened up by hostile input", async () => {
    const giants = { planetClass: "gas_giant", climateClass: null } as const;
    const all = await searchByType("", giants, 1, 200);
    for (const query of ["' OR 1=1 --", "%' OR '%'='", "kepler%", "'; DROP TABLE planets; --"]) {
      const result = await searchByType(query, giants, 1, 200);
      expect(result.planets.every((planet) => planet.planetClass === "gas_giant"), query).toBe(true);
      expect(result.total, query).toBeLessThan(all.total);
    }
  });
});
