import { CustomBlending, GLSL3, Mesh, OneFactor, PlaneGeometry, RawShaderMaterial, Vector4 } from "three";
import type { HabitableZone } from "../habitableZone";
import { TRUE_AU, viewRadiusOutsideStar, type OrbitLayout } from "../orbits";

const VERTEX = /* glsl */ `
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uReach;
out vec2 vPlace;
void main() {
  vPlace = position.xy * uReach;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The band is light added to the picture, like the star's glow. It swells from the optimistic edges to
 * the conservative ones, as the limits are estimates and not borders, and a hairline marks each
 * conservative edge so that the eye can tell which side of it an orbit lies on.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec4 uEdges;     // optimistic inner, inner, outer and optimistic outer edge, in view units
uniform float uOpacity;
uniform float uFill;     // how much of the band between the hairlines is shown, from 0 to 1
in vec2 vPlace;
out vec4 outColor;

const vec3 COLOR = vec3(0.30, 0.74, 0.46);

void main() {
  float r = length(vPlace);
  float pixel = fwidth(r);
  float fill = smoothstep(uEdges.x, uEdges.y, r) * (1.0 - smoothstep(uEdges.z, uEdges.w, r));
  float rim = 1.0 - smoothstep(0.0, 1.5, min(abs(r - uEdges.y), abs(r - uEdges.z)) / pixel);
  float light = (0.085 * fill * uFill + 0.14 * rim) * uOpacity;
  if (light < 0.001) discard;
  outColor = vec4(COLOR * light, 1.0);
}
`;

/** The habitable zone as a faint green band in the plane of the orbits, in the scale of the system view. */
export class HabitableZoneView {
  readonly mesh: Mesh<PlaneGeometry, RawShaderMaterial>;
  /** The four edges from the inside out in view units, in the compressed and in the true scale. */
  private readonly edges: [compressed: number[], real: number[]];

  /** `layouts` are the system's orbits from the inside out, which set the compressed distances. */
  constructor(zone: HabitableZone, layouts: OrbitLayout[], radiusSun: number | null) {
    const au = [zone.optimisticInner, zone.inner, zone.outer, zone.optimisticOuter];
    this.edges = [au.map((distance) => viewRadiusOutsideStar(layouts, radiusSun, distance)), au.map((distance) => distance * TRUE_AU)];
    this.mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: { uEdges: { value: new Vector4() }, uReach: { value: 1 }, uOpacity: { value: 0 }, uFill: { value: 1 } },
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
      }),
    );
    // The band passes through the middle of every planet, and drawn like other light it would tint the half
    // of each globe below it. Not marked as transparent, it is drawn with the solid bodies, and this order
    // puts it right after the sky, so that the star and the planets are drawn over it.
    this.mesh.renderOrder = -0.5;
    // PlaneGeometry is built upright, so it is laid flat into the plane of the orbits.
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
  }

  /** The radius of the optimistic outer edge in view units; `trueScale` runs from 0 (compressed) to 1. */
  outerRadius(trueScale: number): number {
    return this.radius(3, trueScale);
  }

  /**
   * How much of the band's fill is shown to a camera at `eye`, from 0 to 1. A camera that follows a planet
   * hovers close above a band many times as wide, in the true scale a thousand times: little or none of
   * its shape is in the picture then, only a green cast over everything. So the fill fades as the camera
   * comes closer than 0.4 widths of the band, and is gone at 0.02; the hairlines stay.
   */
  clearance(eye: { x: number; y: number; z: number }, trueScale: number): number {
    const inner = this.radius(0, trueScale);
    const outer = this.radius(3, trueScale);
    const fromAxis = Math.hypot(eye.x, eye.z);
    const away = Math.hypot(Math.max(inner - fromAxis, fromAxis - outer, 0), eye.y);
    const share = Math.min(Math.max((away / (outer - inner) - 0.02) / 0.38, 0), 1);
    return share * share * (3 - 2 * share);
  }

  /** Draws the band at a mix of scales, as seen from `eye`. At an `opacity` of 0 it is not drawn at all. */
  update(trueScale: number, opacity: number, eye: { x: number; y: number; z: number }): void {
    this.mesh.visible = opacity > 0.002;
    if (!this.mesh.visible) return;
    const { uniforms } = this.mesh.material;
    (uniforms.uEdges.value as Vector4).set(
      this.radius(0, trueScale),
      this.radius(1, trueScale),
      this.radius(2, trueScale),
      this.radius(3, trueScale),
    );
    const reach = this.radius(3, trueScale);
    uniforms.uReach.value = reach;
    uniforms.uOpacity.value = opacity;
    uniforms.uFill.value = this.clearance(eye, trueScale);
    this.mesh.scale.setScalar(reach);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  /** Mixes an edge between the scales by its logarithm, as the orbits are mixed. */
  private radius(edge: number, trueScale: number): number {
    const [compressed, real] = this.edges;
    return compressed[edge] * (real[edge] / compressed[edge]) ** trueScale;
  }
}
