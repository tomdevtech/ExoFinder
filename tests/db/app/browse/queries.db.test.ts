import { describe, expect, it } from "vitest";
import { ACTIVE_EXOPLANETS } from "@tests/support/catalog";
import { getExoplanetNeighbours, getExoplanetStart } from "@/app/browse/queries";

describe("the order the exoplanets are browsed in", () => {
  it("starts at the nearest system and counts the active exoplanets only", async () => {
    const { first, total } = await getExoplanetStart();
    expect(first).toMatchObject({ slug: "proxima-cen-b", starSlug: "proxima-cen", starName: "Proxima Cen", position: 1 });
    expect(first?.distPc).toBeCloseTo(1.30119, 5);
    // The eight planets of the solar system are counted with their moons, in the code.
    expect(total).toBe(ACTIVE_EXOPLANETS);
  });

  it("goes through a system from the inside out", async () => {
    const b = await getExoplanetNeighbours("trappist-1-b");
    expect(b?.planet.position).toBe(2);
    expect(b?.previous?.slug).toBe("proxima-cen-b");
    expect(b?.next?.slug).toBe("trappist-1-c");
    expect(b?.total).toBe(ACTIVE_EXOPLANETS);
  });

  it("leads from the outermost planet of a system to the innermost of the next farther one", async () => {
    const h = await getExoplanetNeighbours("trappist-1-h");
    expect(h?.previous?.slug).toBe("trappist-1-g");
    expect(h?.next).toMatchObject({ slug: "55-cnc-e", starSlug: "55-cnc", position: 9 });
  });

  it("puts a system at an unknown distance last", async () => {
    const lost = await getExoplanetNeighbours("nodist-1-b");
    expect(lost?.planet.position).toBe(ACTIVE_EXOPLANETS);
    expect(lost?.planet.distPc).toBeNull();
    expect(lost?.previous?.slug).toBe("kepler-12-b");
    expect(lost?.next).toBeNull();
    expect((await getExoplanetNeighbours("proxima-cen-b"))?.previous).toBeNull();
  });

  it("reaches every exoplanet once when followed from the start, farther and farther out", async () => {
    const { first, total } = await getExoplanetStart();
    const visited: { slug: string; distPc: number | null }[] = [];
    for (let slug = first?.slug; slug; ) {
      const here = await getExoplanetNeighbours(slug);
      visited.push({ slug, distPc: here!.planet.distPc });
      expect(here!.planet.position).toBe(visited.length);
      slug = here!.next?.slug;
    }
    expect(visited).toHaveLength(total);
    expect(new Set(visited.map((planet) => planet.slug)).size).toBe(total);
    const distances = visited.map((planet) => planet.distPc ?? Infinity);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("knows no place for a withdrawn planet, a planet of the solar system or an odd slug", async () => {
    for (const slug of ["retracted-1-b", "earth", "nope", "", "..%2F..%2Fetc", "earth'--", "TRAPPIST-1-B"]) {
      expect(await getExoplanetNeighbours(slug), slug).toBeNull();
    }
  });
});
