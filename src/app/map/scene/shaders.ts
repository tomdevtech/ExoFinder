import { AIR_GLSL, SURFACE_GLSL } from "@/app/globe/surface.glsl";
import { DOUBLING_STEP, TRUE_AU } from "../orbits";
import {
  BULGE_HEIGHT,
  BULGE_WIDTH,
  DISC_HEIGHT,
  GALACTIC_CENTRE,
  GALAXY_EDGE,
  GALAXY_PICTURE_WIDTH,
} from "../galaxy";

/**
 * Shader programs of the map. All are GLSL ES 3.00 and output display-ready (sRGB) colours, so three.js
 * must not convert them again.
 */

const HEADER = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
`;

/** Renders a sphere at infinity around the camera, where only the view direction matters. */
export const SKY_VERTEX = /* glsl */ `
in vec3 position;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vDirection;
void main() {
  vDirection = position;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  // Setting z to w places the sky at the far plane, behind everything else.
  gl_Position = clip.xyww;
}
`;

/** Samples the all-sky photo, which has the galactic centre in the middle, longitude growing to the left and north up. */
export const SKY_FRAGMENT = /* glsl */ `${HEADER}
uniform sampler2D uMap;
uniform float uOpacity;
uniform mat3 uToGalactic;
in vec3 vDirection;
out vec4 outColor;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(uToGalactic * vDirection);
  float longitude = atan(d.y, d.x);
  float latitude = asin(clamp(d.z, -1.0, 1.0));
  vec2 uv = vec2(0.5 - longitude / (2.0 * PI), 0.5 + latitude / PI);
  outColor = vec4(texture(uMap, uv).rgb * uOpacity, 1.0);
}
`;

/**
 * Gives the top-down artist's impression of the Milky Way a third dimension. Part of the light lies in a
 * thin sheet in the plane, sampled sharply where the view ray crosses it. The rest is a soft glow of old
 * stars, thickest in the bulge, integrated along the ray while a thin dust layer absorbs light. The result
 * looks like the picture from above, like a thin streak with a dark lane from the side, and like the
 * Milky Way band with its dark rift from inside.
 */
export const GALAXY_GLOW_FRAGMENT = /* glsl */ `${HEADER}
uniform sampler2D uMap;  // The top-down galaxy picture.
uniform vec3 uEye;       // The camera position in parsecs, relative to the Sun.
uniform vec3 uForward;   // The view direction. uRight and uUp are the screen half-extents at distance 1.
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uFade;
uniform float uOutside;  // This is 0 for a camera inside the disc and 1 outside it.
uniform float uClouds;   // The share of the sheet's light carried by the clouds of galaxyClouds.ts.
in vec2 vUv;
out vec4 outColor;

const vec3 CENTRE = vec3(${GALACTIC_CENTRE.map((value) => value.toFixed(1)).join(", ")});
const float PICTURE_WIDTH = ${GALAXY_PICTURE_WIDTH.toFixed(1)};
const float EDGE = ${GALAXY_EDGE.toFixed(1)};
const float DISC_HEIGHT = ${DISC_HEIGHT.toFixed(1)};
const float BULGE_HEIGHT = ${BULGE_HEIGHT.toFixed(1)};
const float BULGE_WIDTH = ${BULGE_WIDTH.toFixed(1)};
// The scale height of the dust layer in parsecs.
const float DUST_HEIGHT = 90.0;
// Beyond this height above or below the plane there is almost no light, so rays are clipped there.
const float HALF_HEIGHT = 6000.0;
// Seen from outside, the bulge is an ellipsoid flattened by BULGE_FLAT. Its light is spread over its
// depth through the centre, which is sqrt(pi) * BULGE_FLAT * BULGE_OVAL.
const float BULGE_FLAT = 0.62;
const float BULGE_OVAL = BULGE_WIDTH * 1.35;
const float BULGE_DEPTH = 1.7725 * BULGE_FLAT * BULGE_OVAL;
// The share of the light in the thin sheet away from the bulge (carried by the clouds once they exist).
// The rest is the smooth light of the old disc, drawn as a soft glow.
const float SHEET = 0.5;
const int STEPS = 22;

// Maps a galactic position to picture coordinates. In the picture the centre direction is up and the
// direction of rotation is to the left.
vec2 inPicture(vec2 g) {
  return vec2(0.5 - g.y / PICTURE_WIDTH, 0.5 + g.x / PICTURE_WIDTH);
}

// The picture fades out before its edge so that no hard border shows.
float within(float radius) {
  return 1.0 - smoothstep(EDGE * 0.82, EDGE, radius);
}

// Returns the share of light in the thin sheet at a given radius. The bulge and bar consist of old
// stars in a thick cloud, so there nearly all light belongs to the glow.
float inSheet(float radius) {
  return SHEET * (1.0 - 0.85 * exp(-radius * radius / (BULGE_WIDTH * BULGE_WIDTH)));
}

// Returns the dust density in the plane. Dust is assumed where the picture is darker than its blurred
// surroundings ("around"), plus a little everywhere in the disc, but none in the bulge.
float dustAt(vec3 seen, vec3 around, float radius) {
  float dark = max(dot(around - seen, vec3(0.3, 0.6, 0.1)), 0.0);
  return (0.0004 + 0.016 * dark) * smoothstep(300.0, 1500.0, radius);
}

void main() {
  vec2 screen = vUv * 2.0 - 1.0;
  vec3 direction = normalize(uForward + screen.x * uRight + screen.y * uUp);
  vec3 from = uEye - CENTRE;

  // The ray is clipped to the slab between two planes above and below the disc and to the edge cylinder.
  float start = 0.0;
  float end = 1e9;
  if (abs(direction.z) > 1e-5) {
    float a = (-HALF_HEIGHT - from.z) / direction.z;
    float b = (HALF_HEIGHT - from.z) / direction.z;
    start = max(start, min(a, b));
    end = min(end, max(a, b));
  } else if (abs(from.z) > HALF_HEIGHT) {
    end = -1.0;
  }
  float qa = dot(direction.xy, direction.xy);
  float qb = dot(from.xy, direction.xy);
  float qc = dot(from.xy, from.xy) - EDGE * EDGE;
  if (qa > 1e-9) {
    float root = qb * qb - qa * qc;
    if (root <= 0.0) {
      end = -1.0;
    } else {
      root = sqrt(root);
      start = max(start, (-qb - root) / qa);
      end = min(end, (-qb + root) / qa);
    }
  } else if (qc > 0.0) {
    end = -1.0;
  }
  if (end <= start) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 light = vec3(0.0);
  // The thin sheet is sampled sharply where the ray crosses the plane. A shallow view passes through more
  // of the sheet and its dust, which produces the dark lane of an edge-on galaxy. From inside the disc,
  // or when looking almost along the plane, the sheet's light goes into the glow instead.
  float sheetSeen = uOutside * smoothstep(0.03, 0.3, abs(direction.z));
  // The mip levels below assume a 4096-pixel picture; this offset corrects them for smaller pictures.
  float level0 = log2(float(textureSize(uMap, 0).x) / 4096.0);
  float meets = abs(direction.z) > 1e-5 ? -from.z / direction.z : -1.0;
  if (sheetSeen > 0.0 && meets > start && meets < end) {
    vec2 place = from.xy + direction.xy * meets;
    vec2 at = inPicture(place);
    vec3 seen = texture(uMap, at).rgb;
    float radius = length(place);
    float steep = max(abs(direction.z), 0.01);
    float depth = dustAt(seen, textureLod(uMap, at, 5.5 + level0).rgb, radius) * 1.7725 * DUST_HEIGHT / steep;
    float through = depth > 1e-4 ? (1.0 - exp(-depth)) / depth : 1.0;
    light = pow(seen, vec3(2.2)) * within(radius) * inSheet(radius) * sheetSeen
      * pow(1.0 / max(steep, 0.25), 0.5) * through * (1.0 - uClouds);
  }

  // A per-pixel jittered start turns step artefacts into fine grain instead of rings. From inside the
  // galaxy the steps are short near the camera and grow with distance.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float reach = end - start;
  float bend = start > 0.0 ? 1.0 : 2.0;
  float texels = float(textureSize(uMap, 0).x) / PICTURE_WIDTH * length(direction.xy);
  float clear = 1.0;
  float before = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float after = pow(float(i + 1) / float(STEPS), bend);
    float stride = (after - before) * reach;
    vec3 g = from + direction * (start + (before + jitter * (after - before)) * reach);
    before = after;

    // A step that spans several texels reads a blurred mip level so that it does not miss what lies
    // between samples. The old-star glow is soft anyway.
    vec2 at = inPicture(g.xy);
    // From outside, the picture is only sampled blurred, because the clouds and clusters provide the detail.
    float blur = max(log2(max(stride * texels, 1.0)), mix(3.0, 5.5, uOutside * uClouds) + level0);
    vec3 seen = textureLod(uMap, at, blur).rgb;
    vec3 around = textureLod(uMap, at, max(blur, 5.5 + level0)).rgb;
    float radius = length(g.xy);
    float edge = within(radius);

    // The picture holds the light summed over the height, so the glow is spread over the disc thickness,
    // which is larger in the bulge. From outside the disc glow is spread higher to show the thick disc of
    // old stars, which a top-down picture cannot show.
    float inBulge = exp(-radius * radius / (BULGE_WIDTH * BULGE_WIDTH));
    float thick = DISC_HEIGHT * mix(1.0, 5.0, uOutside) + BULGE_HEIGHT * (1.0 - uOutside) * inBulge;
    // The Gaussian term makes the glow fall off faster than exponential far above the plane.
    float high = g.z / (2.5 * thick);
    vec3 shine = pow(seen, vec3(2.2)) * exp(-abs(g.z) / thick - high * high) / (2.0 * thick) * edge;
    // The glow carries the light that the sheet does not, including the unseen part of the sheet
    // (1 - sheetSeen) that the clouds do not carry either.
    float share = 1.0 - inSheet(radius) * (uOutside - (uOutside - sheetSeen) * (1.0 - uClouds));
    vec3 glow = shine * share * (1.0 - inBulge * uOutside);
    // From outside, the bulge is drawn as an ellipsoid. Spreading it like the disc would make its narrow
    // core stand up like a pillar, so each point takes the picture's brightness at the same ellipsoidal
    // distance from the centre.
    float oval = length(vec3(g.xy, g.z / BULGE_FLAT));
    float inOval = exp(-oval * oval / (BULGE_OVAL * BULGE_OVAL));
    // Beyond about three bulge widths the contribution is below 0.001, so the four samples are skipped.
    if (uOutside > 0.0 && inOval > 0.001) {
      // Four samples a quarter turn apart are averaged; a single direction would make the bar cast wedges of light.
      vec2 out1 = g.xy * (oval / max(radius, 1.0));
      vec2 out2 = vec2(-out1.y, out1.x);
      vec3 core = pow(textureLod(uMap, inPicture(out1), blur).rgb, vec3(2.2))
        + pow(textureLod(uMap, inPicture(-out1), blur).rgb, vec3(2.2))
        + pow(textureLod(uMap, inPicture(out2), blur).rgb, vec3(2.2))
        + pow(textureLod(uMap, inPicture(-out2), blur).rgb, vec3(2.2));
      glow += core * 0.25 * inOval / BULGE_DEPTH * uOutside;
    }
    light += glow * clear * stride;

    // The dust is confined to a thin layer, so it barely matters from above but hides what is behind it
    // when looking along the plane.
    float dust = dustAt(seen, around, radius) * exp(-pow(g.z / DUST_HEIGHT, 2.0)) * edge;
    clear *= exp(-dust * stride);
    if (clear < 0.004) break;
  }

  // The picture is as bright as a long exposure from far away. From inside, that exposure would turn the
  // whole sky into fog, so a much shorter one is used to leave the Milky Way band.
  light *= mix(0.05, 1.0, uOutside);
  // A soft knee tone-maps values above middle brightness so that views along the plane, where much light
  // adds up, do not burn out.
  const float knee = 0.55;
  vec3 over = max(light - knee, 0.0) / (1.0 - knee);
  vec3 pressed = min(light, knee) + (1.0 - knee) * (1.0 - exp(-over));
  vec3 color = pow(pressed, vec3(1.0 / 2.2));
  // Dithering below one 8-bit step keeps the faint outskirts from showing banding.
  outColor = vec4(color * uFade + (jitter - 0.5) / 255.0, 1.0);
}
`;

/**
 * Draws the galaxy clouds from galaxyClouds.ts: soft light clouds at different heights and dust clouds in
 * the plane. Each light cloud spreads its share of the picture's light over its disc, so together they
 * match the picture from any distance. Clouds close to the camera fade out so the starfield takes over.
 */
export const CLOUDS_VERTEX = /* glsl */ `
in vec3 position;
in vec3 color;
in float radius;   // The cloud radius in parsecs.
in float share;    // The share of the picture's light, or for dust how much light it hides.
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPixelsPerUnit;
uniform float uPixelRatio;
uniform float uGain;
uniform float uFade;
uniform float uDust;     // This is 1 for dust clouds and 0 for light clouds.
uniform vec3 uEye;       // The camera position.
out vec3 vColor;
out float vStrength;
void main() {
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * eye;
  float distance = max(length(eye.xyz), 1.0);
  float pixels = radius * uPixelsPerUnit / distance;
  gl_PointSize = clamp(pixels * 1.7, 1.0, 256.0 * uPixelRatio);
  // A cloud keeps its surface brightness at any distance by spreading its light over its disc area.
  // A cloud smaller than a pixel spreads it over that pixel instead.
  float perPixel = distance / uPixelsPerUnit;
  float area = max(3.14159 * radius * radius, perPixel * perPixel);
  float near = smoothstep(radius * 8.0, radius * 20.0, distance);
  vStrength = mix(share * uGain / area, share * uGain, uDust) * near * uFade;
  // Round dust clouds only work from above. Along the plane they would stack into speckles, so there
  // the glow shader draws the dark lane instead.
  float steep = abs(normalize(position - uEye).z);
  vStrength *= mix(1.0, smoothstep(0.12, 0.4, steep), uDust);
  // Seen along the plane, dust hides most of the thin arm layer, which forms the dark lane of an edge-on
  // galaxy. The thick disc above and below stays visible.
  float inLane = exp(-abs(position.z) / 250.0) * (1.0 - uDust);
  vStrength *= 1.0 - 0.96 * inLane * (1.0 - smoothstep(0.03, 0.3, steep));
  vColor = color;
  if (vStrength < 1e-5 || gl_PointSize * near < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const CLOUDS_FRAGMENT = /* glsl */ `${HEADER}
in vec3 vColor;
in float vStrength;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  // The Gaussian falls off before the edge of the point sprite, and the factor keeps its total light about
  // equal to that of a flat disc with the cloud's radius.
  float soft = exp(-r2 * 2.2) * 1.6;
  outColor = vec4(vColor * vStrength * soft, 1.0);
}
`;

/** Draws dust clouds, which absorb part of the light behind them. */
export const DUST_FRAGMENT = /* glsl */ `${HEADER}
in vec3 vColor;
in float vStrength;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  outColor = vec4(0.0, 0.0, 0.0, clamp(vStrength * exp(-r2 * 3.0), 0.0, 0.85));
}
`;

/** Draws a full-screen quad independent of the camera. */
export const SCREEN_VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Copies a previously rendered texture onto the screen. */
export const COPY_FRAGMENT = /* glsl */ `${HEADER}
uniform sampler2D uMap;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uMap, vUv).rgb, 1.0);
}
`;

/** Draws the planet-hosting stars as small glowing discs coloured by their temperature. */
export const HOSTS_VERTEX = /* glsl */ `
in vec3 position;
in vec3 color;
in float weight;   // This is 0 for one planet and up to 1 for many.
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPixelsPerUnit;
uniform float uPixelRatio;
out vec4 vColor;
void main() {
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * eye;
  float distance = length(eye.xyz);
  float pixels = 0.5 * uPixelsPerUnit / max(distance, 1e-4);
  // From across the galaxy thousands of stars pile up on a few pixels, so they shrink and dim with distance.
  float far = smoothstep(1500.0, 25000.0, distance);
  float smallest = (2.6 + weight * 2.4) * uPixelRatio * mix(1.0, 0.65, far);
  gl_PointSize = clamp(pixels, smallest, 46.0 * uPixelRatio);
  float crowd = mix(1.0, 0.07, far);
  vColor = vec4(color, crowd);
}
`;

export const HOSTS_FRAGMENT = /* glsl */ `${HEADER}
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 5.0) - 0.0067;
  float core = exp(-r2 * 28.0);
  outColor = vec4((vColor.rgb * glow + vec3(core) * 0.75) * vColor.a, 1.0);
}
`;

/**
 * Draws the procedural field stars with brightness falling off with the square of the distance. Each
 * class fades out before the end of its reach so that stars never pop in.
 */
export const FIELD_VERTEX = /* glsl */ `
in vec3 position;
in vec3 color;
in float light;    // The luminosity in solar luminosities.
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPixelRatio;
uniform float uReach;
uniform float uFade;
out vec4 vColor;
void main() {
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * eye;
  float distance = max(length(eye.xyz), 1e-3);
  // Dust in the galactic plane halves the light about every two kiloparsecs along the plane. Only the part
  // of the path inside the dust layer counts, which is small when looking from above or below.
  vec3 camera = -transpose(mat3(modelViewMatrix)) * modelViewMatrix[3].xyz;
  float inLayer = min(1.0, 320.0 / max(abs(camera.z - position.z), 1.0));
  float dust = exp(-distance * inLayer / 2800.0 * exp(-abs(position.z) / 160.0));
  // This is the received light relative to a faint star at the end of its reach. Only the nearest and
  // brightest stars stand out. The CPU culls stars below FAINTEST in starfieldView.ts, so keep both in sync.
  float seen = light / (distance * distance) / 1e-4 * 0.07 * dust;
  float edge = 1.0 - smoothstep(0.7 * uReach, uReach, distance);
  float alpha = min(pow(seen, 0.85), 1.0) * edge * uFade;
  // Once alpha saturates, brighter stars get a larger glow instead of getting whiter.
  gl_PointSize = clamp(1.3 + 1.6 * log2(1.0 + seen), 1.3, 16.0) * uPixelRatio;
  vColor = vec4(color, alpha);
  if (alpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const FIELD_FRAGMENT = /* glsl */ `${HEADER}
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 6.0);
  float core = exp(-r2 * 40.0);
  outColor = vec4((vColor.rgb * glow + vec3(core) * 0.6) * vColor.a, 1.0);
}
`;

/** Draws a landmark (nebula, cluster and so on) on a camera-facing quad. */
export const LANDMARK_VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Draws a procedural landmark. Emission nebulae are pink from hydrogen with blue reflection near their young
 * central stars and dark dust lanes. A cluster is the soft glow of stars too faint to resolve.
 */
export const LANDMARK_FRAGMENT = /* glsl */ `${HEADER}
uniform vec3 uColor;
uniform float uKind;      // 0 nebula, 1 open cluster, 2 globular cluster, 3 planetary nebula, 4 supernova remnant, 5 dwarf galaxy.
uniform float uSeed;
uniform float uFade;
in vec2 vUv;
out vec4 outColor;

// The hash avoids sin(), because on many GPUs sin() of large arguments loses precision and the noise
// breaks up into square blocks.
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p = p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  vec3 color;
  if (uKind < 0.5) {
    vec2 p = vUv * 2.6 + uSeed;
    vec2 warp = vec2(fbm(p + 3.1), fbm(p + 8.7));
    float gas = fbm(p + warp * 1.6);
    float lanes = smoothstep(0.45, 0.7, fbm(p * 1.7 + warp + 31.0));
    // The nebula has a bright core, ragged lobes and faint outskirts far around it.
    float shape = exp(-r2 * 7.0) * smoothstep(0.2, 0.7, gas + 0.3 * (1.0 - r2));
    float outskirts = exp(-r2 * 2.2) * smoothstep(0.35, 0.8, gas) * 0.35;
    float middle = exp(-r2 * 40.0);
    vec3 ionised = mix(uColor, vec3(1.0, 0.55, 0.45), smoothstep(0.5, 0.8, gas) * 0.4);
    color = (ionised * (shape + outskirts) * (1.0 - 0.75 * lanes) + vec3(0.5, 0.65, 1.0) * middle * 0.5) * 0.9;
  } else if (uKind < 1.5) {
    color = uColor * exp(-r2 * 5.0) * 0.22;
  } else if (uKind < 2.5) {
    color = uColor * exp(-r2 * 14.0) * 0.22 + uColor * exp(-r2 * 4.0) * 0.05;
  } else if (uKind < 3.5) {
    // A planetary nebula is a thin ring of gas, blue-green inside and red at the rim, around a hot central star.
    float r = sqrt(r2);
    float lumps = fbm(vUv * 7.0 + uSeed);
    float ring = exp(-pow((r - 0.55 - 0.08 * lumps) / 0.16, 2.0));
    vec3 tint = mix(uColor, vec3(1.0, 0.35, 0.35), smoothstep(0.45, 0.75, r));
    color = tint * ring * (0.6 + 0.6 * lumps) * 0.9 + uColor * exp(-r2 * 6.0) * 0.12 + vec3(0.9, 0.95, 1.0) * exp(-r2 * 900.0);
  } else if (uKind < 4.5) {
    // A supernova remnant is a shell of thin tangled filaments, bunched into arcs where the blast hit denser gas.
    float r = sqrt(r2);
    float wobble = fbm(vUv * 3.0 + uSeed) - 0.5;
    float shell = exp(-pow((r - 0.74 - 0.32 * wobble) / 0.035, 2.0))
      + 0.6 * exp(-pow((r - 0.62 - 0.4 * wobble) / 0.025, 2.0));
    float strands = smoothstep(0.45, 0.8, fbm(vUv * 11.0 + uSeed * 2.0));
    float arcs = smoothstep(0.38, 0.62, fbm(vUv * 1.8 + uSeed + 4.0));
    vec3 tint = mix(uColor, vec3(1.0, 0.45, 0.5), smoothstep(0.4, 0.7, fbm(vUv * 3.0 + 5.0)));
    color = tint * shell * strands * arcs * 1.5;
  } else {
    // A dwarf galaxy is a lopsided cloud of stars with a bar and pink star-forming knots.
    vec2 p = vUv * 2.2 + uSeed;
    float body = exp(-r2 * 2.6) * (0.55 + 0.9 * fbm(p));
    vec2 b = vec2(vUv.x * 0.9 + vUv.y * 0.44, -vUv.x * 0.44 + vUv.y * 0.9);
    float bar = exp(-pow(b.x / 0.55, 2.0) - pow(b.y / 0.14, 2.0)) * 0.7;
    float knots = smoothstep(0.62, 0.78, fbm(vUv * 6.0 + uSeed * 3.0)) * exp(-r2 * 2.0);
    color = (uColor * (body + bar) + vec3(1.0, 0.4, 0.55) * knots * 0.8) * 0.35;
  }
  // The landmark fades out before the edge of its quad so that the edge does not show.
  outColor = vec4(color * uFade * (1.0 - smoothstep(0.6, 1.0, r2)), 1.0);
}
`;

/** The shared vertex shader for planets, the star, the moon and the haze. It passes the object-space position on. */
export const BALL_VERTEX = /* glsl */ `
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vPosition;
void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Draws a planet with the same surface shader as its detail page. */
export const PLANET_FRAGMENT = /* glsl */ `${HEADER}
${SURFACE_GLSL}
uniform vec3 uLightObject;   // The star position in the planet's object space.
uniform vec3 uCameraObject;  // The camera position in the planet's object space.
in vec3 vPosition;
out vec4 outColor;
void main() {
  vec3 p = normalize(vPosition);
  vec3 V = normalize(uCameraObject - p);
  outColor = vec4(toDisplay(shadePlanet(p, normalize(uLightObject), V)), 1.0);
}
`;

/** Draws a moon as a small sphere of grey rock lit by the star. */
export const MOON_FRAGMENT = /* glsl */ `${HEADER}
${SURFACE_GLSL}
uniform vec3 uLightObject;   // The star position in the moon's object space.
in vec3 vPosition;
out vec4 outColor;
void main() {
  vec3 n = normalize(vPosition);
  gPixel = min(max(length(dFdx(n)), length(dFdy(n))), 0.5);
  float rock = 0.36 + 0.3 * fbm(n * 2.6 + uSeed.zyx + 40.0, 3, 2.6);
  float sun = max(dot(n, normalize(uLightObject)), 0.0);
  outColor = vec4(toDisplay(vec3(rock, rock * 0.97, rock * 0.93) * uLight * sun), 1.0);
}
`;

/** Draws the thin glowing atmosphere shell around the edge of a planet. */
export const HAZE_FRAGMENT = /* glsl */ `${HEADER}
${AIR_GLSL}
uniform vec3 uColor;
uniform float uDensity;      // The density of the air, as in GlobeSpec.atmosphere.
uniform float uStrength;     // Less than 1 for a planet of gas, whose glow is faint.
uniform float uShell;        // The shell radius in planet radii.
uniform vec3 uLightObject;
uniform vec3 uCameraObject;
in vec3 vPosition;
out vec4 outColor;
void main() {
  vec3 p = normalize(vPosition);
  vec3 V = normalize(uCameraObject - p);
  // This is how far the view ray passes from the centre in planet radii. The glow is the same thin
  // line as around the planet on its own page (limbGlow), and has faded out at the shell's edge.
  float facing = abs(dot(p, V));
  float passing = sqrt(max(1.0 - facing * facing, 0.0)) * uShell;
  float lit = smoothstep(-0.14, 0.1, dot(p, normalize(uLightObject)));
  vec3 glow = limbGlow(uColor, uDensity, passing - 1.0).rgb * uStrength * lit;
  outColor = vec4(pow(glow, vec3(1.0 / 2.2)), 1.0);
}
`;

/** Draws planetary rings as a flat disc in the equatorial plane. */
export const RING_VERTEX = /* glsl */ `
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vPlane;
void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RING_FRAGMENT = /* glsl */ `${HEADER}
${SURFACE_GLSL}
uniform vec3 uLightObject;   // The star position in the ring disc's object space.
in vec2 vPlane;
out vec4 outColor;
void main() {
  float rho = length(vPlane);
  vec4 ring = ringSample(rho, fwidth(rho));
  if (ring.a <= 0.003) discard;
  vec3 L = normalize(uLightObject);
  // The planet casts a shadow on the part of the rings behind it.
  vec3 q = vec3(vPlane, 0.0);
  float along = dot(q, L);
  float miss = sqrt(max(dot(q, q) - along * along, 0.0));
  float shadow = along < 0.0 ? 1.0 - smoothstep(0.97, 1.03, miss) : 0.0;
  float lit = mix(0.55, 1.0, abs(L.z)) * (1.0 - 0.88 * shadow);
  outColor = vec4(toDisplay(ring.rgb * uLight * lit), ring.a);
}
`;

/** Draws the central star as a glowing sphere with limb darkening. */
export const STAR_FRAGMENT = /* glsl */ `${HEADER}
${SURFACE_GLSL}
uniform vec3 uColor;
uniform vec3 uCameraObject;
uniform float uHasMap;
in vec3 vPosition;
out vec4 outColor;
void main() {
  vec3 p = normalize(vPosition);
  float facing = max(dot(p, normalize(uCameraObject - p)), 0.0);
  vec3 surface;
  if (uHasMap > 0.5) {
    surface = toLinear(sampleMap(uMapDay, p, 0.0).rgb) * 1.3;
  } else {
    // Without a texture the surface is procedural granulation with a few darker spots.
    gPixel = min(max(length(dFdx(p)), length(dFdy(p))), 0.5);
    float cells = fbm(p * 11.0 + vec3(0.0, uTime * 0.05, 0.0) + uSeed, 4, 11.0);
    float spots = fbm(p * 2.6 + uSeed.zxy, 3, 2.6);
    surface = uColor * (0.9 + cells * 0.7) * (1.0 - 0.4 * smoothstep(0.22, 0.34, spots));
  }
  float limb = 0.5 + 0.5 * pow(facing, 0.55);
  outColor = vec4(toDisplay(surface * limb * 1.2), 1.0);
}
`;

/** Draws the star's glow on a quad that always faces the camera. */
export const GLOW_VERTEX = /* glsl */ `
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GLOW_FRAGMENT = /* glsl */ `${HEADER}
uniform vec3 uColor;
uniform float uCore;   // The star radius as a fraction of the quad's half-size.
in vec2 vUv;
out vec4 outColor;
void main() {
  float r = length(vUv * 2.0 - 1.0);
  if (r >= 1.0) discard;
  float outside = max(r - uCore, 0.0) / (1.0 - uCore);
  float glow = pow(1.0 - outside, 5.0) * 0.55;
  outColor = vec4(uColor * glow, 1.0);
}
`;

/** The most knots `BELT_VERTEX` can follow: one per planet and dwarf planet, with room to spare. */
export const BELT_KNOTS = 16;

/**
 * Moves the small bodies of the belts along their Kepler orbits and places them at the compressed
 * distances of the planets (see `viewRadius` in orbits.ts, which this repeats for the GPU). Each body is
 * a small quad drawn once per instance: as points, ANGLE's Direct3D backend would emulate them with a
 * geometry shader, which cost several times as much.
 */
export const BELT_VERTEX = /* glsl */ `
#define KNOTS ${BELT_KNOTS}
in vec2 corner;    // the corner of the quad, from -1 to 1
in vec4 orbit;     // semi-major axis in AU, eccentricity, mean anomaly at time 0, view seconds per orbit (0: still)
in vec3 toPeriapsis; // unit vector from the Sun to the periapsis, in view axes
in vec3 ahead;       // unit vector in the orbit's plane, 90 degrees ahead of the periapsis
in vec3 color;     // linear colour times brightness
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uClock;
uniform vec2 uResolution;   // the drawing buffer in device pixels
uniform float uPixelRatio;
uniform float uKnotAu[KNOTS];
uniform float uKnotView[KNOTS];
uniform int uKnots;
uniform float uTrue;        // 0 for the compressed scale, 1 for the true one, in between while it changes
uniform float uFade;        // 1 when shown, 0 when faded out
out vec3 vColor;
out vec2 vCorner;

const float TAU = 6.28318530718;

float viewRadius(float au) {
  if (au <= uKnotAu[0]) return uKnotView[0] * au / uKnotAu[0];
  for (int i = 1; i < KNOTS; i++) {
    if (i >= uKnots) break;
    if (au <= uKnotAu[i]) {
      float share = log(au / uKnotAu[i - 1]) / log(uKnotAu[i] / uKnotAu[i - 1]);
      return mix(uKnotView[i - 1], uKnotView[i], share);
    }
  }
  return uKnotView[uKnots - 1] + ${DOUBLING_STEP.toFixed(1)} * log2(au / uKnotAu[uKnots - 1]);
}

void main() {
  float e = orbit.y;
  float M = orbit.w > 0.0 ? mod(orbit.z + uClock * TAU / orbit.w, TAU) : orbit.z;
  // Newton's method for Kepler's equation. From this start three steps leave an error far below a pixel
  // for the eccentricities of the belts.
  float E = M + e * sin(M);
  for (int k = 0; k < 3; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  vec2 inPlane = vec2(cos(E) - e, sqrt(1.0 - e * e) * sin(E)) * orbit.x;
  float r = length(inPlane);
  vec3 world = (inPlane.x * toPeriapsis + inPlane.y * ahead) * (mix(viewRadius(r), r * ${TRUE_AU.toFixed(1)}, uTrue) / r);
  vec4 eye = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * eye;
  // Close up a body grows to a few pixels, far away it stays a single pixel.
  float pixels = clamp(10.0 / max(-eye.z, 1e-3), 1.0, 2.5) * uPixelRatio;
  gl_Position.xy += corner * pixels / uResolution * gl_Position.w;
  // A body behind the camera is moved out of the picture.
  if (eye.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vColor = pow(color, vec3(1.0 / 2.2)) * uFade;
  vCorner = corner;
}
`;

export const BELT_FRAGMENT = /* glsl */ `${HEADER}
in vec3 vColor;
in vec2 vCorner;
out vec4 outColor;
void main() {
  float r2 = dot(vCorner, vCorner);
  if (r2 > 1.0) discard;
  outColor = vec4(vColor * (1.0 - r2), 1.0);
}
`;

/** The most large moons a planet's small moons are squeezed between (see `compressedMoonDistance`). */
export const MOON_KNOTS = 16;

/**
 * The distance of a small moon from its planet, in radii of the planet, at the current mix of scales. It
 * repeats \`compressedMoonDistance\` in orbits.ts and mixes the result with the true distance by the
 * logarithm, as the large moons are mixed.
 */
const MOON_DISTANCE_GLSL = /* glsl */ `
#define MOON_KNOTS ${MOON_KNOTS}
uniform float uKnotTrue[MOON_KNOTS];
uniform float uKnotView[MOON_KNOTS];
uniform int uKnots;
uniform float uTrue;

float compressedDistance(float r) {
  if (uKnots == 0) return r;
  if (r <= uKnotTrue[0]) return uKnotView[0] * r / uKnotTrue[0];
  for (int i = 1; i < MOON_KNOTS; i++) {
    if (i >= uKnots) break;
    if (r <= uKnotTrue[i]) {
      float share = log(r / uKnotTrue[i - 1]) / log(uKnotTrue[i] / uKnotTrue[i - 1]);
      return mix(uKnotView[i - 1], uKnotView[i], share);
    }
  }
  return uKnotView[uKnots - 1] + log2(r / uKnotTrue[uKnots - 1]);
}

float moonDistance(float r) {
  return exp(mix(log(compressedDistance(r)), log(r), uTrue));
}
`;

/**
 * Moves the small moons of a planet along their Kepler orbits, like BELT_VERTEX but in radii of the
 * planet: the object is scaled to the planet's radius in view units.
 */
export const SMALL_MOONS_VERTEX = /* glsl */ `
${MOON_DISTANCE_GLSL}
in vec2 corner;      // the corner of the quad, from -1 to 1
in vec4 orbit;       // semi-major axis in planet radii, eccentricity, mean anomaly at time 0, view seconds per orbit
in vec3 toPeriapsis; // unit vector from the planet to the periapsis
in vec3 ahead;       // unit vector in the orbit's plane, 90 degrees ahead of the periapsis
in float light;      // 0 for the smallest moons, 1 for those of about 100 km
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uClock;
uniform vec2 uResolution;
uniform float uPixelRatio;
uniform float uFade;
out vec3 vColor;
out vec2 vCorner;

const float TAU = 6.28318530718;

void main() {
  float e = orbit.y;
  float M = mod(orbit.z + uClock * TAU / orbit.w, TAU);
  // Some captured moons have eccentricities near 0.9, which take five Newton steps; there are only a few
  // hundred moons, so the extra steps cost nothing.
  float E = M + e * sin(M);
  for (int k = 0; k < 5; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  vec2 inPlane = vec2(cos(E) - e, sqrt(1.0 - e * e) * sin(E)) * orbit.x;
  float r = length(inPlane);
  vec3 place = (inPlane.x * toPeriapsis + inPlane.y * ahead) * (moonDistance(r) / r);
  vec4 eye = modelViewMatrix * vec4(place, 1.0);
  gl_Position = projectionMatrix * eye;
  float pixels = mix(1.4, 2.6, light) * uPixelRatio;
  gl_Position.xy += corner * pixels / uResolution * gl_Position.w;
  if (eye.z > 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  // Small moons are dark, captured bodies; the brightness only hints at their size.
  vColor = vec3(0.86, 0.84, 0.8) * (0.55 + 0.45 * light) * uFade;
  vCorner = corner;
}
`;

/** Draws the orbits of the small moons, squeezed like the moons themselves. Positions are in true radii of the planet. */
export const SMALL_MOON_ORBITS_VERTEX = /* glsl */ `
${MOON_DISTANCE_GLSL}
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
void main() {
  float r = length(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * (moonDistance(r) / r), 1.0);
}
`;

export const SMALL_MOON_ORBITS_FRAGMENT = /* glsl */ `${HEADER}
uniform vec3 uColor;
uniform float uOpacity;
out vec4 outColor;
void main() {
  outColor = vec4(uColor, uOpacity);
}
`;
