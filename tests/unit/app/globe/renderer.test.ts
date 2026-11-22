import { describe, expect, it } from "vitest";
import { planetAppearance } from "@/app/planets/appearance";
import { poseUniforms } from "@/app/globe/renderer";
import { globeRadius, globeRotation, lightDirection, type GlobeSpec } from "@/app/globe/spec";

function globe(overrides: Partial<GlobeSpec> = {}): GlobeSpec {
  return {
    ...planetAppearance({
      slug: "some-b",
      source: "nasa",
      planetClass: "rocky",
      climateClass: "temperate",
      starTeffK: 5800,
      radiusEarth: null,
      eqTempK: null,
      densityEarth: null,
      orbitalPeriodDays: null,
    }).globe,
    moon: null,
    ...overrides,
  };
}

const rect = { x: 40, y: 10, width: 200, height: 120 };

describe("poseUniforms", () => {
  it("puts the planet in the middle of its rectangle, as large as the shorter side allows", () => {
    const spec = globe();
    const values = poseUniforms(spec, { seconds: 3 }, rect);
    expect(values.uCenter).toEqual([140, 70]);
    expect(values.uRadius).toBeCloseTo(60 * globeRadius(spec), 9);
    expect(values.uTime).toBe(3);
  });

  it("enlarges the planet and adds detail when zoomed in, up to three more layers", () => {
    const spec = globe();
    const near = poseUniforms(spec, { seconds: 0, zoom: 4 }, rect);
    expect(near.uRadius).toBeCloseTo(4 * 60 * globeRadius(spec), 9);
    expect(near.uDetail).toBe(2);
    expect(poseUniforms(spec, { seconds: 0 }, rect).uDetail).toBe(0);
    expect(poseUniforms(spec, { seconds: 0, zoom: 0.5 }, rect).uDetail).toBe(0);
    expect(poseUniforms(spec, { seconds: 0, zoom: 64 }, rect).uDetail).toBe(3);
  });

  it("turns the planet and the light with the viewer", () => {
    const spec = globe();
    const values = poseUniforms(spec, { seconds: 7, yaw: 0.4, pitch: -0.2 }, rect);
    expect(values.uViewToObj).toEqual(globeRotation(spec, 7, 0.4, -0.2));
    expect(values.uLightView).toEqual(lightDirection(0.4, -0.2));
  });

  it("swings the view around a rocky planet that is held by its star", () => {
    const held = globe({ locked: 1, spin: 0 });
    const early = poseUniforms(held, { seconds: 10 }, rect);
    const late = poseUniforms(held, { seconds: 30 }, rect);
    // A locked planet does not turn, but its sway still moves the light across the picture.
    expect(late.uLightView).not.toEqual(early.uLightView);
    const free = globe();
    expect(poseUniforms(free, { seconds: 30 }, rect).uLightView).toEqual(poseUniforms(free, { seconds: 10 }, rect).uLightView);
  });

  it("holds the bands of a gas planet unless they are asked to drift", () => {
    const spec = globe({ flow: 1 });
    expect(poseUniforms(spec, { seconds: 0 }, rect).uFlow).toBe(0);
    // When flow is requested, the planet's own value stays in force.
    expect(poseUniforms(spec, { seconds: 0, flow: true }, rect)).not.toHaveProperty("uFlow");
  });

  it("hands the shape and the moon to the shader", () => {
    expect(poseUniforms(globe({ flattening: 0.08 }), { seconds: 0 }, rect).uFlatten).toBe(0.08);
    expect(poseUniforms(globe(), { seconds: 0 }, rect).uMoon).toEqual([0, 0, 0, 0]);
    const moon = { size: 0.12, distance: 1.4, period: 20, phase: 0 };
    const [x, y, z, size] = poseUniforms(globe({ moon }), { seconds: 5 }, rect).uMoon as number[];
    expect(Math.hypot(x, y, z)).toBeCloseTo(1.4, 9);
    expect(size).toBe(0.12);
  });
});
