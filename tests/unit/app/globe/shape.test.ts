import { describe, expect, it } from "vitest";
import { shapeMesh } from "@/app/globe/shape";

const WIDTH = 256;
const HEIGHT = 128;
const COLUMNS = WIDTH + 1;

/** A grid whose radius in every direction is `radius(column, row)` steps of 65,535. */
function grid(radius: (column: number, row: number) => number): Uint16Array {
  return Uint16Array.from({ length: WIDTH * (HEIGHT + 1) }, (_, i) => radius(i % WIDTH, Math.floor(i / WIDTH)));
}

const vector = (array: Float32Array, index: number) => Array.from(array.subarray(index * 3, index * 3 + 3));

describe("shapeMesh", () => {
  it("builds a closed raster of triangles, the seam column twice", () => {
    const mesh = shapeMesh(grid(() => 65535), 1);
    expect(mesh.positions).toHaveLength(COLUMNS * (HEIGHT + 1) * 3);
    expect(mesh.indices).toHaveLength(WIDTH * HEIGHT * 6);
    expect(mesh.indices.reduce((largest, index) => Math.max(largest, index), 0)).toBe(COLUMNS * (HEIGHT + 1) - 1);
  });

  it("builds a coarse raster from every step-th point of the grid", () => {
    // Every radius tells its row, so the coarse rows must take the radii of every fourth row.
    const rows = grid((_, row) => 1000 + row * 100);
    const coarse = shapeMesh(rows, 1, 4);
    expect(coarse.indices).toHaveLength((WIDTH / 4) * (HEIGHT / 4) * 6);
    const columns = WIDTH / 4 + 1;
    for (const row of [0, 1, 17, HEIGHT / 4]) {
      const at = row * columns * 3;
      const radius = Math.hypot(coarse.positions[at], coarse.positions[at + 1], coarse.positions[at + 2]);
      expect(radius).toBeCloseTo((1000 + row * 4 * 100) / 65535, 6);
    }
    expect(() => shapeMesh(rows, 1, 3)).toThrow(/every 3th/);
  });

  it("refuses a grid of the wrong size", () => {
    expect(() => shapeMesh(new Uint16Array(10), 1)).toThrow(/radii/);
  });

  it("lays longitude 0 on +z with east towards +x and the north pole on +y, as the maps", () => {
    const { directions } = shapeMesh(grid(() => 65535), 1);
    const equator = HEIGHT / 2;
    // Column 128 is longitude 0, column 192 is 90° east.
    expect(vector(directions, equator * COLUMNS + 128).map((value) => Math.round(value * 1e6) / 1e6)).toEqual([0, 0, 1]);
    expect(vector(directions, equator * COLUMNS + 192)[0]).toBeCloseTo(1, 6);
    expect(vector(directions, 0)[1]).toBeCloseTo(1, 6);
  });

  it("scales the radii by the largest one and points every normal outwards", () => {
    const mesh = shapeMesh(grid((column, row) => 30000 + ((column * 7 + row * 13) % 30000)), 2.5);
    for (let i = 0; i < mesh.positions.length / 3; i += 97) {
      const position = vector(mesh.positions, i);
      const direction = vector(mesh.directions, i);
      const normal = vector(mesh.normals, i);
      expect(Math.hypot(...position)).toBeLessThanOrEqual(2.5 + 1e-6);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
      expect(normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2]).toBeGreaterThan(0);
    }
  });

  it("gives a sphere the normals of a sphere, without a seam at longitude 180 or a pole", () => {
    const mesh = shapeMesh(grid(() => 65535), 1);
    for (const index of [5 * COLUMNS, 5 * COLUMNS + WIDTH, 60 * COLUMNS, 60 * COLUMNS + WIDTH, 0, HEIGHT * COLUMNS + 3]) {
      const normal = vector(mesh.normals, index);
      const direction = vector(mesh.directions, index);
      for (let k = 0; k < 3; k++) expect(normal[k]).toBeCloseTo(direction[k], 2);
    }
    expect(vector(mesh.normals, 60 * COLUMNS)).toEqual(vector(mesh.normals, 60 * COLUMNS + WIDTH));
  });
});
