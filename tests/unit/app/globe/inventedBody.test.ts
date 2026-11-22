import { describe, expect, it } from "vitest";
import { inventedBody, shapeMesh } from "@/app/globe/shape";

describe("inventedBody", () => {
  it("gives the same body for the same seed and another for another", () => {
    const one = inventedBody(42);
    expect(inventedBody(42)).toEqual(one);
    expect(inventedBody(43).grid).not.toEqual(one.grid);
  });

  it("is a lumpy body, longest towards its planet and shortest along its axis, in radii of equal volume", () => {
    const { grid, maxRadius } = inventedBody(7);
    const mesh = shapeMesh(grid, maxRadius);
    const extent = [0, 1, 2].map((axis) => {
      let most = 0;
      for (let i = axis; i < mesh.positions.length; i += 3) most = Math.max(most, Math.abs(mesh.positions[i]));
      return most;
    });
    // x across, y the spin axis, z towards the planet.
    expect(extent[2]).toBeGreaterThan(extent[0]);
    expect(extent[0]).toBeGreaterThanOrEqual(extent[1] * 0.95);
    expect(maxRadius).toBeGreaterThan(1.1);
    expect(maxRadius).toBeLessThan(2.2);
  });

  it("has a dark, mottled surface map", () => {
    const { map, mapWidth, mapHeight } = inventedBody(11);
    expect(map).toHaveLength(mapWidth * mapHeight * 4);
    const reds = Array.from({ length: mapWidth * mapHeight }, (_, i) => map[i * 4]);
    const mean = reds.reduce((sum, value) => sum + value, 0) / reds.length;
    expect(mean).toBeGreaterThan(60);
    expect(mean).toBeLessThan(140);
    expect(Math.max(...reds) - Math.min(...reds)).toBeGreaterThan(20);
  });
});
