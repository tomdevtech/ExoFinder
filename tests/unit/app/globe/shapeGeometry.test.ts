import { describe, expect, it } from "vitest";
import { shapeMesh } from "@/app/globe/shape";
import { shapeGeometry } from "@/app/globe/shapeGeometry";

const WIDTH = 256;
const HEIGHT = 128;

/** A grid whose radius is the same in every direction, as steps of 65,535. */
function ball(radius: number): Uint16Array {
  return new Uint16Array(WIDTH * (HEIGHT + 1)).fill(radius);
}

describe("shapeGeometry", () => {
  it("hands three.js the surface, its normals and the direction of each point on the map", () => {
    const mesh = shapeMesh(ball(65535), 1, 4);
    const geometry = shapeGeometry(mesh);
    for (const [name, values] of [
      ["position", mesh.positions],
      ["normal", mesh.normals],
      ["direction", mesh.directions],
    ] as const) {
      const attribute = geometry.getAttribute(name);
      expect(attribute.itemSize, name).toBe(3);
      expect(attribute.array, name).toBe(values);
    }
    expect(geometry.getIndex()?.array).toBe(mesh.indices);
  });

  it("knows how far the surface reaches, so the body is not cut away at the edge of the picture", () => {
    const whole = shapeGeometry(shapeMesh(ball(65535), 1, 4));
    expect(whole.boundingSphere?.radius).toBeCloseTo(1, 5);
    const half = shapeGeometry(shapeMesh(ball(32768), 1.5, 4));
    expect(half.boundingSphere?.radius).toBeCloseTo((32768 / 65535) * 1.5, 4);
  });
});
