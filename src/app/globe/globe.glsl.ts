import { SURFACE_GLSL } from "./surface.glsl";
import { defineLines, type SurfaceDefines } from "./uniforms";

/**
 * Vertex shader that draws one planet into a rectangle of the canvas. A single triangle covers the
 * rectangle, and the fragment shader works out which point of the sphere lies behind each pixel.
 * This gives a perfectly round edge at any size; the view is orthographic, as through a telescope.
 */
export const GLOBE_VERTEX = /* glsl */ `#version 300 es
void main() {
  // One triangle covers the whole rectangle, so no vertex buffer is needed.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Returns the fragment shader for one combination of surface parts (see surfaceDefines). */
export function globeFragment(defines: SurfaceDefines): string {
  // GLSL requires #version on the very first line.
  return `#version 300 es\n${defineLines(defines)}${GLOBE_FRAGMENT_BODY}`;
}

const GLOBE_FRAGMENT_BODY = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
${SURFACE_GLSL}
uniform vec2 uCenter;      // planet centre in pixels
uniform float uRadius;     // planet radius in pixels
uniform mat3 uViewToObj;   // view space to planet space
uniform vec3 uLightView;   // direction to the star in view space
uniform float uFlatten;    // polar flattening
uniform vec4 uMoon;        // moon centre in view space (planet radii) and radius (0: no moon)

out vec4 outColor;

// Composites a layer with the given opacity over what is already there.
void over(inout vec4 below, vec3 color, float opacity) {
  below = vec4(color * opacity + below.rgb * (1.0 - opacity), opacity + below.a * (1.0 - opacity));
}

void main() {
  // The pixel position in planet radii, with x to the right and y up; the viewer looks along -z.
  vec2 d = (gl_FragCoord.xy - uCenter) / uRadius;
  float pixel = 1.0 / uRadius;
  vec4 result = vec4(0.0);

  // A fast-spinning giant is flattened at its poles, so seen from the side it is an ellipse. r is 1
  // on its edge.
  vec3 axis = vec3(uViewToObj[0][1], uViewToObj[1][1], uViewToObj[2][1]);
  float squeeze = 1.0 / ((1.0 - uFlatten) * (1.0 - uFlatten)) - 1.0;
  float depthTerm = 1.0 + squeeze * axis.z * axis.z;
  float alongAxis = dot(d, axis.xy);
  float r = sqrt(dot(d, d) + squeeze * alongAxis * alongAxis / depthTerm);

  // The air glows in a thin line beyond the edge, on the side facing the star and a little past
  // the terminator.
  if (uAtmo.a > 0.0 && r > 1.0 - pixel) {
    float lit = smoothstep(-0.14, 0.1, dot(d / r, uLightView.xy));
#if AIR
    vec4 glow = limbGlow(uAtmo.rgb, uAtmo.a, r - 1.0);
    // A red star has little of the light that air scatters (see the veil in shadePlanet).
    over(result, glow.rgb / max(glow.a, 1e-4) * uLight * uLight * uLight, glow.a * lit);
#else
    // A planet of gas has no sharp edge for the line to stand on, so its haze only fades out.
    over(result, uAtmo.rgb * uLight, exp(-max(r - 1.0, 0.0) / 0.006) * lit * uAtmo.a * 0.3);
#endif
  }

  // The rings lie in the equatorial plane through the centre.
  vec4 ring = vec4(0.0);
  float ringZ = 0.0;
  if (uRing.z > 0.5 && abs(axis.z) > 0.02) {
    ringZ = -dot(d, axis.xy) / axis.z;
    vec3 point = vec3(d, ringZ);
    ring = ringSample(length(point), pixel / max(abs(axis.z), 0.2));
    if (ring.a > 0.0) {
      // At a grazing angle the line of sight passes through more of the rings.
      ring.a = 1.0 - pow(1.0 - ring.a, 1.0 / max(abs(axis.z), 0.15));
      // The planet casts a shadow on the rings behind it.
      float towards = dot(point, uLightView);
      float hit = towards * towards - (dot(point, point) - 1.0);
      float shadow = towards < 0.0 ? smoothstep(0.0, 0.03, hit) : 0.0;
      float lit = 0.3 + 0.7 * clamp(abs(dot(axis, uLightView)) * 1.8, 0.0, 1.0);
      ring.rgb *= uLight * lit * (1.0 - shadow * 0.93);
    }
  }

  // The sphere is shaded two pixels beyond its edge as well, so the differences between
  // neighbouring pixels are defined everywhere on it.
  float cover = clamp((1.0 - r) / pixel + 0.5, 0.0, 1.0);
  float ballZ = 0.0;
  vec3 ball = vec3(0.0);
  if (r < 1.0 + 2.5 * pixel) {
    vec2 dc = d * min(1.0, 0.9995 / max(r, 1e-6));
    // Finds where the line of sight meets the flattened sphere.
    float along = dot(dc, axis.xy);
    float halfway = squeeze * along * axis.z;
    float rest = dot(dc, dc) + squeeze * along * along - 1.0;
    ballZ = (-halfway + sqrt(max(halfway * halfway - depthTerm * rest, 0.0))) / depthTerm;
    // The surface is defined on a sphere, so the point is stretched back onto one.
    vec3 onBall = uViewToObj * vec3(dc, ballZ);
    onBall.y /= 1.0 - uFlatten;
    ball = shadePlanet(
      normalize(onBall),
      uViewToObj * uLightView,
      uViewToObj * vec3(0.0, 0.0, 1.0));
  }

  vec4 moon = vec4(0.0);
  float moonZ = 0.0;
  if (uMoon.w > 0.0) {
    vec2 md = (d - uMoon.xy) / uMoon.w;
    float mr = length(md);
    float moonPixel = pixel / uMoon.w;
    if (mr < 1.0 + moonPixel) {
      vec2 mc = md * min(1.0, 0.9995 / max(mr, 1e-6));
      vec3 n = vec3(mc, sqrt(1.0 - dot(mc, mc)));
      moonZ = uMoon.z + n.z * uMoon.w;
      // Behind the planet, as seen from the star, the moon lies in its shadow.
      float towards = dot(uMoon.xyz, uLightView);
      float miss = length(uMoon.xyz - towards * uLightView);
      float lit = towards < 0.0 ? smoothstep(0.92, 1.06, miss) : 1.0;
      // The moon is smaller than the planet, so it needs its own pixel size for the noise
      // filtering.
      gPixel = moonPixel;
      float rock = 0.36 + 0.3 * fbm(n * 2.6 + uSeed.zyx + 40.0, 3, 2.6);
      moon = vec4(
        vec3(rock, rock * 0.97, rock * 0.93) * uLight * max(dot(n, uLightView), 0.0) * lit,
        clamp((1.0 - mr) / moonPixel + 0.5, 0.0, 1.0));
    }
  }

  bool ringInFront = cover <= 0.0 || ringZ > ballZ;
  bool moonInFront = cover <= 0.0 || moonZ > ballZ;
  if (!ringInFront) over(result, ring.rgb, ring.a);
  if (!moonInFront) over(result, moon.rgb, moon.a);
  over(result, ball, cover);
  if (ringInFront) over(result, ring.rgb, ring.a);
  if (moonInFront) over(result, moon.rgb, moon.a);

  outColor = vec4(toDisplay(result.rgb / max(result.a, 1e-4)) * result.a, result.a);
}
`;
