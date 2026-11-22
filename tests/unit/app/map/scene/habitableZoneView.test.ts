import { describe, expect, it } from "vitest";
import { habitableZone } from "@/app/map/habitableZone";
import { layoutOrbits, starSize } from "@/app/map/orbits";
import { HabitableZoneView } from "@/app/map/scene/habitableZoneView";

const SUN = { massSun: 1, radiusSun: 1, teffK: 5772 };
const zone = habitableZone(SUN)!;
const orbit = (axis: number) => ({ orbitalPeriodDays: null, semiMajorAxisAu: axis, eccentricity: 0, radiusEarth: 1 });
const FAR = { x: 0, y: 50, z: 0 };

describe("HabitableZoneView", () => {
  const layouts = layoutOrbits([0.72, 1, 1.52, 5.2].map(orbit), SUN);
  const [venus, earth, mars, jupiter] = layouts;

  it("stays hidden until it is shown", () => {
    const view = new HabitableZoneView(zone, layouts, 1);
    expect(view.mesh.visible).toBe(false);
    view.update(0, 0, FAR);
    expect(view.mesh.visible).toBe(false);
    view.update(0, 1, FAR);
    expect(view.mesh.visible).toBe(true);
    view.dispose();
  });

  it("lies between the same orbits in the compressed scale as in the true one", () => {
    const view = new HabitableZoneView(zone, layouts, 1);
    view.update(0, 1, FAR);
    const edges = view.mesh.material.uniforms.uEdges.value;
    // Venus is inside even the optimistic edge, Earth and Mars are within the conservative ones.
    expect(edges.x).toBeGreaterThan(venus.semiMajor);
    expect(edges.y).toBeLessThan(earth.semiMajor);
    expect(edges.z).toBeGreaterThan(mars.semiMajor);
    expect(edges.w).toBeLessThan(jupiter.semiMajor);
    view.dispose();
  });

  it("is drawn at its real distances in the true scale", () => {
    const view = new HabitableZoneView(zone, layouts, 1);
    view.update(1, 1, FAR);
    const edges = view.mesh.material.uniforms.uEdges.value;
    expect(edges.toArray()).toEqual([zone.optimisticInner, zone.inner, zone.outer, zone.optimisticOuter].map((au) => expect.closeTo(au, 9)));
    expect(view.outerRadius(1)).toBeCloseTo(zone.optimisticOuter, 9);
    // The quad reaches exactly to the outermost edge.
    expect(view.mesh.scale.x).toBeCloseTo(zone.optimisticOuter, 9);
    expect(view.mesh.material.uniforms.uReach.value).toBeCloseTo(zone.optimisticOuter, 9);
    view.dispose();
  });

  it("stays outside the enlarged star when the only planet is far beyond it", () => {
    const far = layoutOrbits([orbit(50)], SUN);
    const view = new HabitableZoneView(zone, far, 1);
    view.update(0, 1, FAR);
    const edges = view.mesh.material.uniforms.uEdges.value;
    expect(edges.x).toBeGreaterThan(starSize(1));
    expect(edges.w).toBeLessThan(far[0].semiMajor);
    view.dispose();
  });

  it("is drawn right after the sky, so that the planets it passes through cover it", () => {
    const view = new HabitableZoneView(zone, layouts, 1);
    expect(view.mesh.material.transparent).toBe(false);
    expect(view.mesh.material.depthWrite).toBe(false);
    expect(view.mesh.renderOrder).toBeGreaterThan(-1);
    expect(view.mesh.renderOrder).toBeLessThan(0);
    view.dispose();
  });

  it("keeps only its hairlines for a camera that hovers just above it", () => {
    const view = new HabitableZoneView(zone, layouts, 1);
    // A camera a few Earth radii above the band, which is one AU wide, sees none of its shape.
    expect(view.clearance({ x: 1, y: 0.0002, z: 0 }, 1)).toBe(0);
    expect(view.clearance({ x: 1, y: 0.5, z: 0 }, 1)).toBe(1);
    const between = view.clearance({ x: 1, y: 0.2, z: 0 }, 1);
    expect(between).toBeGreaterThan(0);
    expect(between).toBeLessThan(1);
    // From beside the star the band is a ring in the distance, however low the camera is.
    expect(view.clearance({ x: 0.01, y: 0.0002, z: 0 }, 1)).toBe(1);
    view.update(1, 1, { x: 1, y: 0.0002, z: 0 });
    expect(view.mesh.visible).toBe(true);
    expect(view.mesh.material.uniforms.uFill.value).toBe(0);
    expect(view.mesh.material.uniforms.uOpacity.value).toBe(1);
    view.dispose();
  });
});
