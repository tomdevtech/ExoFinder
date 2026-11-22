import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  GLSL3,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Mesh,
  OneFactor,
  RawShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { mixLog } from "@/shared/math";
import { compressedMoonDistance, moonSize, moonViewPeriod, solveKepler, type MoonLayout } from "../orbits";
import type { MapSmallMoon } from "../payload";
import { orbitAxes } from "./beltsView";
import { HAZE_LAYER } from "./hazeLayer";
import {
  BELT_FRAGMENT,
  MOON_KNOTS,
  SMALL_MOON_ORBITS_FRAGMENT,
  SMALL_MOON_ORBITS_VERTEX,
  SMALL_MOONS_VERTEX,
} from "./shaders";

const DEGREE = Math.PI / 180;
const ORBIT_SEGMENTS = 64;
/**
 * The opacity of each orbit in the haze. Its lines are two pixels wide when laid over the picture, so this
 * is half of what a line of one pixel would need.
 */
const ORBIT_OPACITY = 0.015;

/**
 * The two vectors that span each small moon's orbit, in the frame of the planet's anchor. Elements that
 * refer to the planet's equator are turned with the planet's axis; those that refer to the ecliptic
 * (most of the far, captured moons) are not.
 */
export function smallMoonAxes(moons: MapSmallMoon[], tiltDeg: number): { toPeriapsis: Float32Array; ahead: Float32Array } {
  const plane = new Float32Array(moons.length * 3);
  moons.forEach(([, , , i, node, peri], index) => plane.set([i * DEGREE, node * DEGREE, peri * DEGREE], index * 3));
  const axes = orbitAxes(plane, moons.length);
  const c = Math.cos(-tiltDeg * DEGREE);
  const s = Math.sin(-tiltDeg * DEGREE);
  moons.forEach((moon, index) => {
    if (moon[9] === 1) return;
    for (const vectors of [axes.toPeriapsis, axes.ahead]) {
      const x = vectors[index * 3];
      const y = vectors[index * 3 + 1];
      vectors[index * 3] = x * c - y * s;
      vectors[index * 3 + 1] = x * s + y * c;
    }
  });
  return axes;
}

/**
 * The small moons of one planet as a single instanced draw of tiny quads, which the GPU moves along their
 * orbits, and their orbits as a single set of faint lines in the haze (hazeLayer.ts), as there are hundreds
 * of them. The followed moon's orbit is traced by the system view. Lengths are in radii of the planet; the group
 * is scaled to the planet's radius in view units. In the compressed scale the GPU squeezes their distances
 * between those of the planet's large moons (`knots`), as `compressedMoonDistance` does.
 */
export class SmallMoonsView {
  readonly group = new Group();
  private readonly mesh: Mesh<InstancedBufferGeometry, RawShaderMaterial>;
  private readonly orbits: LineSegments<BufferGeometry, RawShaderMaterial>;
  /** Shared by the points and the lines, so both squeeze alike. */
  private readonly scale: Record<string, { value: unknown }>;
  /** What `place` needs to follow one moon on the CPU, kept from the construction. */
  private readonly orbit: Float32Array;
  private readonly axes: { toPeriapsis: Float32Array; ahead: Float32Array };
  private readonly knots: MoonLayout[];

  constructor(moons: MapSmallMoon[], planetRadiusKm: number, tiltDeg: number, knots: MoonLayout[]) {
    const count = moons.length;
    const orbit = new Float32Array(count * 4);
    const light = new Float32Array(count);
    moons.forEach(([, aKm, e, , , , meanAnomaly, periodDays, radiusKm], index) => {
      orbit.set([aKm / planetRadiusKm, e, meanAnomaly * DEGREE, moonViewPeriod(periodDays)], index * 4);
      light[index] = radiusKm > 0 ? Math.min(Math.max(Math.log10(radiusKm) / 2, 0), 1) : 0;
    });
    const { toPeriapsis, ahead } = smallMoonAxes(moons, tiltDeg);
    this.orbit = orbit;
    this.axes = { toPeriapsis, ahead };
    this.knots = knots;
    const used = knots.slice(0, MOON_KNOTS);
    const pad = (values: number[]) => [...values, ...new Array<number>(MOON_KNOTS - values.length).fill(1)];
    this.scale = {
      uKnotTrue: { value: pad(used.map((layout) => layout.distance)) },
      uKnotView: { value: pad(used.map((layout) => layout.compressedDistance)) },
      uKnots: { value: used.length },
      uTrue: { value: 0 },
    };

    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute("corner", new BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute("orbit", new InstancedBufferAttribute(orbit, 4));
    geometry.setAttribute("toPeriapsis", new InstancedBufferAttribute(toPeriapsis, 3));
    geometry.setAttribute("ahead", new InstancedBufferAttribute(ahead, 3));
    geometry.setAttribute("light", new InstancedBufferAttribute(light, 1));
    geometry.instanceCount = count;
    // The moons move on the GPU, so the bounds are set to the farthest apoapsis by hand. The compressed
    // distances are never larger than the true ones beyond the large moons.
    const reach = Math.max(1, ...moons.map(([, aKm, e]) => (aKm / planetRadiusKm) * (1 + e)), ...used.map((layout) => layout.compressedDistance * 2));
    geometry.boundingSphere = new Sphere(new Vector3(), reach);
    this.mesh = new Mesh(
      geometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SMALL_MOONS_VERTEX,
        fragmentShader: BELT_FRAGMENT,
        uniforms: {
          ...this.scale,
          uClock: { value: 0 },
          uResolution: { value: new Vector2(1, 1) },
          uPixelRatio: { value: 1 },
          uFade: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
      }),
    );

    // All orbits in one geometry: each ellipse as line segments in the plane its two vectors span.
    const points = new Float32Array(count * ORBIT_SEGMENTS * 2 * 3);
    let at = 0;
    const put = (index: number, a: number, e: number, angle: number) => {
      const x = a * (Math.cos(angle) - e);
      const y = a * Math.sqrt(1 - e * e) * Math.sin(angle);
      for (let k = 0; k < 3; k++) points[at++] = x * toPeriapsis[index * 3 + k] + y * ahead[index * 3 + k];
    };
    moons.forEach(([, aKm, e], index) => {
      const a = aKm / planetRadiusKm;
      for (let step = 0; step < ORBIT_SEGMENTS; step++) {
        put(index, a, e, (step / ORBIT_SEGMENTS) * 2 * Math.PI);
        put(index, a, e, ((step + 1) / ORBIT_SEGMENTS) * 2 * Math.PI);
      }
    });
    const orbitGeometry = new BufferGeometry();
    orbitGeometry.setAttribute("position", new BufferAttribute(points, 3));
    orbitGeometry.boundingSphere = new Sphere(new Vector3(), reach);
    this.orbits = new LineSegments(
      orbitGeometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SMALL_MOON_ORBITS_VERTEX,
        fragmentShader: SMALL_MOON_ORBITS_FRAGMENT,
        // The colour of the other orbit lines, 0x8fa3c8, as display values.
        uniforms: { ...this.scale, uColor: { value: [0x8f / 255, 0xa3 / 255, 0xc8 / 255] }, uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
      }),
    );
    this.orbits.layers.set(HAZE_LAYER);
    this.group.add(this.orbits, this.mesh);
  }

  /**
   * `size` is the planet's radius in view units, and `trueScale` runs from 0 (compressed) to 1 (true scale);
   * at a `fade` of 0 nothing is drawn.
   */
  update(
    clock: number,
    viewport: { width: number; height: number; pixelRatio: number },
    size: number,
    trueScale: number,
    fade: number,
  ): void {
    this.group.visible = fade > 0.002;
    if (!this.group.visible) return;
    this.group.scale.setScalar(size);
    this.scale.uTrue.value = trueScale;
    const { uniforms } = this.mesh.material;
    uniforms.uClock.value = clock;
    uniforms.uFade.value = fade;
    uniforms.uPixelRatio.value = viewport.pixelRatio;
    (uniforms.uResolution.value as Vector2).set(viewport.width * viewport.pixelRatio, viewport.height * viewport.pixelRatio);
    this.orbits.material.uniforms.uOpacity.value = ORBIT_OPACITY * fade;
  }

  /**
   * Where moon `index` is at `clock`, in radii of the planet in the group's frame, as the shader places it:
   * the camera follows a small moon with this. `trueScale` runs from 0 (compressed) to 1 (true).
   */
  place(index: number, clock: number, trueScale: number, out: Vector3): Vector3 {
    const [axis, e, start, period] = this.orbit.subarray(index * 4, index * 4 + 4);
    const anomaly = (((start + (clock * 2 * Math.PI) / period) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const E = solveKepler(anomaly, e);
    const x = axis * (Math.cos(E) - e);
    const y = axis * Math.sqrt(1 - e * e) * Math.sin(E);
    const r = Math.hypot(x, y);
    const distance = mixLog(compressedMoonDistance(this.knots, r), r, trueScale);
    const { toPeriapsis: p, ahead: q } = this.axes;
    return out
      .set(x * p[index * 3] + y * q[index * 3], x * p[index * 3 + 1] + y * q[index * 3 + 1], x * p[index * 3 + 2] + y * q[index * 3 + 2])
      .multiplyScalar(distance / r);
  }

  /** Moon `index`'s orbital period on the clock that `place` takes. */
  period(index: number): number {
    return this.orbit[index * 4 + 3];
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.orbits.geometry.dispose();
    this.orbits.material.dispose();
  }
}

/**
 * A small moon's radius in radii of its planet at the current mix of scales: in the true scale as it is (a
 * moon of unknown size counts as 1 km), in the compressed scale enlarged as the large moons are.
 */
export function smallMoonRadius(radiusKm: number, planetRadiusKm: number, planetSize: number, trueScale: number): number {
  const real = Math.max(radiusKm, 1) / planetRadiusKm;
  const compressed = moonSize(Math.max(radiusKm, 1)) / planetSize;
  return compressed * (real / compressed) ** trueScale;
}
