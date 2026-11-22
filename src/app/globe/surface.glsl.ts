import { NOISE_GLSL } from "./noise";

/**
 * GLSL ES 3.00 that reads a body's equirectangular map in the direction p (a unit vector with y as the
 * axis and longitude 0 on +z) and turns linear light into display colours. The surface below and the
 * shader of irregular bodies (shape.ts) both use it, so a map lies the same way on either.
 */
export const MAP_GLSL = /* glsl */ `
const float PI = 3.141592653589793;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

// Converts linear light for display. Values above the knee are compressed so glints and lava fade
// into white instead of clipping, and a dither smaller than one brightness step prevents banding on
// the dark night side.
vec3 toDisplay(vec3 c) {
  const float knee = 0.6;
  vec3 over = max(c - knee, 0.0) / (1.0 - knee);
  vec3 pressed = min(c, knee) + (1.0 - knee) * (1.0 - exp(-over));
  float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
  return pow(max(pressed, 0.0), vec3(1.0 / 2.2)) + grain / 255.0;
}

// A place on an equirectangular map with the gradients that filter it, so several maps can be read
// there without working it out again.
struct MapPoint {
  vec2 uv;
  vec2 dx;
  vec2 dy;
};

// The longitude jumps from 1 to 0 on the far side, so the gradients come from a second longitude
// with its seam on the near side; otherwise the seam would show.
MapPoint mapPoint(vec3 p) {
  float u = atan(p.x, p.z) / (2.0 * PI) + 0.5;
  float v = asin(clamp(p.y, -1.0, 1.0)) / PI + 0.5;
  float uAlt = atan(-p.x, -p.z) / (2.0 * PI);
  vec2 dx = vec2(dFdx(u), dFdx(v));
  vec2 dy = vec2(dFdy(u), dFdy(v));
  float dxAlt = dFdx(uAlt);
  float dyAlt = dFdy(uAlt);
  if (abs(dxAlt) + abs(dyAlt) < abs(dx.x) + abs(dy.x)) {
    dx.x = dxAlt;
    dy.x = dyAlt;
  }
  return MapPoint(vec2(u, v), dx, dy);
}

// Samples a map at a place, shifted east by a share of the circumference.
vec4 sampleAt(sampler2D map, MapPoint at, float shift) {
  return textureGrad(map, vec2(at.uv.x + shift, at.uv.y), at.dx, at.dy);
}

// Samples an equirectangular map in the direction p, shifted east by a share of the circumference.
vec4 sampleMap(sampler2D map, vec3 p, float shift) {
  return sampleAt(map, mapPoint(p), shift);
}
`;

/**
 * GLSL ES 3.00 for the air of a planet as it scatters light. The surface below uses it for the veil
 * over the ground, and globe.glsl.ts and the map use it for the glow beyond the planet's edge, so
 * the two meet at the limb.
 */
export const AIR_GLSL = /* glsl */ `
// How much of each colour the air of a planet scatters out of a ray that goes straight up through
// it. Air scatters most of the colour its sky has, so blue air takes blue out of the starlight and
// leaves it red where the star stands low. density is 1 for air as thick as Earth's.
vec3 airDepthOf(vec3 sky, float density) {
  return sky / max(max(sky.r, sky.g), max(sky.b, 1e-3)) * (0.13 * density);
}

// The light the air scatters towards the viewer along a line of sight that misses the planet and
// passes above its ground at the given height, in planet radii: the colour times its opacity, and
// the opacity. Air is a thin skin on a planet, so this is a narrow bright line that is whitest at
// the ground, where the line of sight crosses the most air.
vec4 limbGlow(vec3 sky, float density, float height) {
  // The air thins to 1/e over this height. A line of sight along the ground crosses 28 times the
  // air above one place (twice the largest value of airMass in the surface shader).
  const float scaleHeight = 0.0045;
  vec3 glow = 1.0 - exp(-airDepthOf(sky, density) * 28.0 * exp(-max(height, 0.0) / scaleHeight));
  return vec4(glow, max(max(glow.r, glow.g), glow.b));
}
`;

/**
 * GLSL ES 3.00 that computes and lights a planet's surface. Both globe.glsl.ts and the system view
 * of the map include it, so a planet looks the same in both. It works in planet space (a unit
 * sphere with y as the axis) and in linear light. The uniforms come from surfaceUniforms() and the
 * KIND and RELIEF defines from surfaceDefines() in uniforms.ts; the uNoise texture comes from noise.ts.
 */
export const SURFACE_GLSL = /* glsl */ `
// KIND is 0 for a map, 1 for a terrain preset and 2 for a band preset. The defaults let programs
// that only use the helpers below compile without setting these.
#ifndef KIND
#define KIND 0
#endif
#ifndef RELIEF
#define RELIEF 0
#endif
// AIR is 1 for solid ground under air, which veils the ground and reddens the low starlight. A
// planet of gas or under a closed cloud deck has no ground that air could veil, and an airless one
// no air, so their programs leave all of that out.
#ifndef AIR
#define AIR 0
#endif

uniform vec3 uSeed;
uniform vec3 uColLow;
uniform vec3 uColMid;
uniform vec3 uColHigh;
uniform vec4 uOcean;        // colour, sea level as a preset height (below -5: no ocean)
uniform float uIce;
uniform vec4 uCloud;        // colour, cover
uniform vec4 uGlow;         // colour, strength
uniform vec4 uAurora;       // polar lights: colour, strength
uniform float uLightning;   // band presets: lightning frequency at night
uniform float uCraters;     // crater depth of a terrain preset
uniform float uRelief;
uniform vec4 uBands;        // band presets: contrast, fine streak strength, storm strength, wisps of high cloud
uniform vec4 uAtmo;         // colour, density
uniform vec3 uLight;        // colour of the starlight
uniform float uTime;        // seconds
uniform float uFlow;        // 0 static clouds, 1 gas-giant bands, 2 Venus cloud deck
uniform float uPace;        // how fast the clouds move along their winds, 1 for the usual pace
uniform mat3 uMapTurn;      // presets: orientation of the preset on the sphere
uniform mat3 uMapTurn2;     // terrain presets: orientation of the second preset
uniform vec4 uTerrain;      // terrain presets: lava/basin level, rivers, relief height, 1 for an ice crust
uniform vec2 uBelts;        // band presets: share of latitudes shown, jet phase
uniform float uZones;       // sharpness of latitude climate zones: 1 for an upright axis, less with tilt
uniform float uLocked;      // 1 if tidally locked
uniform vec4 uJets;         // alternating jets: strength, count; equatorial jet: strength, narrowness
uniform float uDetail;      // extra octaves of noise when zoomed in, 0 to 3
uniform float uStormSpin;   // band presets: how fast the storms and the turbulence of the flow map move, 0 to 1.4
// The storms alive right now are the same for every pixel, so storms.ts computes them once per
// frame.
uniform vec4 uCyclones[12]; // per cyclone: centre, size; strength, hemisphere (+-1, +-2 if tropical), maturity, spin; elongation, lump seed
uniform float uCycloneCount;
uniform vec4 uDusts[3];     // dust storms: centre and radius
uniform vec3 uDustLives;    // strength of each, 0 for none
uniform vec4 uOutbreak;     // band presets: outbreak head longitude and latitude, age 0 to 1, strength
uniform float uOutbreakTail; // 1 or -1: the side the tail trails on
uniform vec3 uRing;         // inner radius, outer radius, 1 if there are rings
uniform vec4 uMapFlags;     // night map (terrain: second preset), cloud map (terrain: weather preset), ring map, water is glossy
uniform sampler2D uMapDay;
uniform sampler2D uMapNight;
uniform sampler2D uMapClouds;
uniform sampler2D uRingMap;
uniform sampler2D uMapRelief;   // terrain presets: the slopes of the preset (see presetSlope); maps: tilt east and north, seas
uniform sampler2D uMapRelief2;  // terrain presets: the slopes of the second preset
uniform sampler2D uMapFlow;     // the winds of a band preset, a weather preset or a cloud map (see flowAt)
uniform mat3 uWeatherTurn;      // terrain presets: orientation of the weather preset on the sphere
uniform highp sampler3D uNoise;

${MAP_GLSL}

${AIR_GLSL}

${NOISE_GLSL}

// PCG integer hash. Unlike sin()-based hashes, it gives the same result on every GPU.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 hash3(vec3 cell) {
  return vec3(pcg3d(uvec3(ivec3(cell) + 65536))) * (1.0 / 4294967295.0);
}

// A lightning flash in a cell of thundercloud, from 0 to 1. A flash lights the cloud around it from
// within, so it is a soft glow and not a dot, and it sits anywhere in its cell, so the flashes do
// not line up. cells counts the cells per planet radius, and chance is the share of cells that flash
// at any moment.
float lightning(vec3 at, float cells, float chance) {
  vec3 cell = at * cells;
  vec3 rnd = hash3(floor(cell) + floor(uTime * 5.0) * vec3(7.0, 3.0, 5.0));
  vec3 away = fract(cell) - 0.5 - (rnd.yzx - 0.5) * 0.5;
  return step(1.0 - chance, rnd.x) * exp(-dot(away, away) * 22.0) * (0.5 + rnd.y);
}

// The size of one pixel on the surface, in planet radii. shadePlanet sets it, and so do the moon
// and the star for themselves.
float gPixel = 0.0;

// How much of a noise layer that repeats frequency times per planet radius can be shown. Layers
// whose features shrink below two pixels fade out, because they would alias and shimmer as the
// planet turns.
float shows(float frequency) {
  return 1.0 - smoothstep(0.5, 1.0, frequency * gPixel);
}

// Fractal noise whose first layer repeats scale times per planet radius; layers finer than a pixel
// fade out (see shows). Every layer is sampled without a branch, because branching would stop the
// GPU from batching the texture fetches.
float fbm(vec3 p, int octaves, float scale) {
  float sum = 0.0;
  float amp = 0.5;
  float total = 0.0;
  for (int i = 0; i < 9; i++) {
    if (i >= octaves) break;
    sum += amp * shows(scale) * gnoise(p);
    total += amp;
    p = p * 2.02 + vec3(19.1, 7.7, 13.3);
    amp *= 0.52;
    scale *= 2.02;
  }
  // Dividing by the weight of all layers keeps the coarse layers from getting stronger when the
  // fine ones fade out.
  return sum / total;
}

// Unrolled versions with two, three and four layers. Most callers need only a few layers, and these
// run and compile faster than the loop.
float fbm2(vec3 p, float scale) {
  return (0.5 * shows(scale) * gnoise(p)
    + 0.26 * shows(scale * 2.02) * gnoise(p * 2.02 + vec3(19.1, 7.7, 13.3))) / 0.76;
}

float fbm3(vec3 p, float scale) {
  vec3 p2 = p * 2.02 + vec3(19.1, 7.7, 13.3);
  return (0.5 * shows(scale) * gnoise(p) + 0.26 * shows(scale * 2.02) * gnoise(p2)
    + 0.1352 * shows(scale * 4.0804) * gnoise(p2 * 2.02 + vec3(19.1, 7.7, 13.3))) / 0.8952;
}

float fbm4(vec3 p, float scale) {
  vec3 p2 = p * 2.02 + vec3(19.1, 7.7, 13.3);
  vec3 p3 = p2 * 2.02 + vec3(19.1, 7.7, 13.3);
  return (0.5 * shows(scale) * gnoise(p) + 0.26 * shows(scale * 2.02) * gnoise(p2)
    + 0.1352 * shows(scale * 4.0804) * gnoise(p3)
    + 0.070304 * shows(scale * 8.2424) * gnoise(p3 * 2.02 + vec3(19.1, 7.7, 13.3))) / 0.965504;
}

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// Neighbouring bands of a gas giant move at different speeds. Sliding them forever would shear the
// pattern into ever finer stripes, so two phases each slide for FLOW_PERIOD seconds and cross-fade.
const float FLOW_PERIOD = 8.0;
// The angle in radians per second at the fastest latitude.
const float FLOW_RATE = 0.07;

// East-west wind speed at y = sin(latitude), roughly -1 to 1. The jets can model many alternating
// bands (Jupiter), one broad equatorial jet (Saturn) or a retrograde equator (Uranus, Neptune).
float jetSpeed(float y, float phase) {
  return uJets.x * sin(y * uJets.y + phase) + uJets.z * exp(-y * y * uJets.w);
}

// On Venus the whole cloud deck circles the planet at nearly one speed and falls behind towards the
// poles.
float veilSpeed(float y) {
  return -1.2 * smoothstep(0.3, 0.9, abs(y)) + 0.15 * sin(y * 5.0 + uSeed.y);
}

// Returns the angle per unit of speed for both phases (x, y) and the weight of the first (z). A
// larger scale makes fine details show twice during the fade. Each place starts its cycle at its
// own time, so the planet does not turn soft and sharp in sync. A faster planet (uPace) runs
// through its cycles sooner instead of sliding further, which would show its details twice.
vec3 flowPhases(float scale, vec3 p) {
  float a = fract(uTime * uPace / FLOW_PERIOD + gnoise(p * 1.7 + uSeed) * 0.9);
  float b = fract(a + 0.5);
  float reach = FLOW_PERIOD * FLOW_RATE * scale;
  return vec3((a - 0.5) * reach, (b - 0.5) * reach, 1.0 - abs(1.0 - 2.0 * a));
}


// The fastest wind a flow map can hold, as a multiple of the preset's fastest wind along the
// latitudes. It must match FLOW_LIMIT in scripts/generate-presets.ts.
const float FLOW_LIMIT = 4.0;

// The wind at a place of a preset's map, towards east and north, where 1 is the preset's fastest
// wind along the latitudes.
vec2 flowAt(vec2 uv) {
  return (textureLod(uMapFlow, uv, 0.0).rg * 2.0 - 1.0) * FLOW_LIMIT;
}

// Where on the map the air at uv came from, when a wind of speed 1 covers the given angle in
// radians (negative looks ahead). wind is the wind at uv: the steady part, which the caller knows as
// a formula, plus the flow map times eddies. The flow map is read again half-way, which follows a
// vortex round its centre; a single straight step would fling its clouds outwards.
vec2 upstream(vec2 uv, vec2 wind, float angle, vec2 steady, float eddies) {
  const vec2 perRadian = vec2(0.15915494, 0.31830989);
  vec2 halfway = uv - wind * (0.5 * angle) * perRadian;
  return uv - (steady + flowAt(halfway) * eddies) * angle * perRadian;
}

// Map brightness stands in for height, which is good enough for craters and mountains to catch the
// light.
float mapHeight(vec3 p) {
  return dot(sampleMap(uMapDay, p, 0.0).rgb, vec3(0.3, 0.6, 0.1));
}

// Cloud cover from 0 to 1 for planets with a cloud map (Earth). The map is a photograph, and the
// winds that go with it (uMapFlow) keep it moving: its lows turn and its cloud bands travel.
// Sliding the whole map would look like a rigid glass shell.
float mapClouds(vec3 p) {
  MapPoint at = mapPoint(p);
  // The whole weather, winds and all, also drifts slowly east; reading further west moves it east.
  vec2 uv = vec2(at.uv.x - uTime * 0.0012, at.uv.y);
  // A short reach keeps the fine detail of the photograph from showing twice.
  vec3 phases = flowPhases(0.1, p + 3.7);
  vec2 wind = flowAt(uv);
  return mix(
    textureGrad(uMapClouds, upstream(uv, wind, phases.y, vec2(0.0), 1.0), at.dx, at.dy).r,
    textureGrad(uMapClouds, upstream(uv, wind, phases.x, vec2(0.0), 1.0), at.dx, at.dy).r,
    phases.z);
}

// Ring colour and opacity at distance rho from the axis. The footprint is the width of one pixel
// there; both are in planet radii, and a wider footprint blurs the fine gaps.
vec4 ringSample(float rho, float footprint) {
  float t = (rho - uRing.x) / (uRing.y - uRing.x);
  if (uRing.z < 0.5 || t <= 0.0 || t >= 1.0) return vec4(0.0);
  if (uMapFlags.z > 0.5) {
    float texels = float(textureSize(uRingMap, 0).x) * footprint / (uRing.y - uRing.x);
    vec4 c = textureLod(uRingMap, vec2(t, 0.5), log2(max(texels, 1.0)));
    return vec4(toLinear(c.rgb), c.a);
  }
  // Without a ring map, the rings get broad bands, one dark gap and fine lanes. Lanes finer than a
  // pixel fade to an even grey instead of flickering, as in a telescope.
  float width = uRing.y - uRing.x;
  float broad = gnoise(vec3(t * 6.0, uSeed.x, 3.0));
  float lanes = broad * 1.1
    + gnoise(vec3(t * 28.0, uSeed.x, 3.0)) * (1.0 - smoothstep(0.25, 0.9, footprint * 28.0 / width))
    + 0.5 * gnoise(vec3(t * 90.0, 7.0, uSeed.y)) * (1.0 - smoothstep(0.25, 0.9, footprint * 90.0 / width));
  float alpha = clamp(0.55 + lanes * 1.1, 0.06, 0.92);
  float gap = 0.45 + 0.3 * fract(uSeed.y * 0.37);
  alpha *= 1.0 - 0.85 * exp(-pow((t - gap) / 0.035, 2.0));
  alpha *= smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.96, 1.0, t));
  return vec4(uColHigh * (0.8 + 0.4 * broad), alpha);
}

// What the storms add at the last sampled point: extra cover (negative in the eye) and thunderstorm
// strength for lightning.
float gStormCover = 0.0;
float gStormCore = 0.0;

// What cloudCover found at the last sampled point: the thickness of the cloud from 0 to 1 without
// the thin veils, the same one step towards the star, and how much high cloud lies above.
float gCloudBody = 0.0;
float gCloudSun = 0.0;
float gCloudHigh = 0.0;
// How high the heaps of the cloud stand at the last sampled point, about 0 in the creases between
// them to 1 on their tops.
float gCloudHeap = 0.5;

// Returns a point on the unit sphere from sin(latitude) and longitude.
vec3 onBall(float sinLat, float lon) {
  float cosLat = sqrt(max(1.0 - sinLat * sinLat, 0.0));
  return vec3(cosLat * sin(lon), sinLat, cosLat * cos(lon));
}

#if KIND == 1
// Share of land, from 0 to 1, below a point in the drifting cloud frame, read from a coarse mip
// level of the preset. It rises over a stretch of coast so a storm weakens gradually as it drifts
// ashore.
float landBelow(vec3 pr, float rate) {
  vec3 ground = uMapTurn * rotateY(pr, -uTime * rate);
  vec2 uv = vec2(atan(ground.x, ground.z) / (2.0 * PI) + 0.5, asin(clamp(ground.y, -1.0, 1.0)) / PI + 0.5);
  return smoothstep(uOcean.a - 0.05, uOcean.a + 0.05, textureLod(uMapDay, uv, 4.0).r);
}
#endif

// Sea cyclones in the frame of the drifting clouds; storms.ts decides where they are and how old.
// Tropical ones form an eye and spiral arms and weaken over land, while mid-latitude ones are wider
// and have no eye. Returns the point twisted by their winds.
vec3 cyclones(vec3 p, float rate) {
  vec3 q = p;
  gStormCover = 0.0;
  gStormCore = 0.0;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uCycloneCount) break;
    vec4 place = uCyclones[3 * i];
    vec4 state = uCyclones[3 * i + 1];
    vec4 own = uCyclones[3 * i + 2];
    vec3 centre = place.xyz;
    float size = place.w;
    float life01 = state.x;
    float hemi = sign(state.y);
    bool tropical = abs(state.y) > 1.5;
    float mature = state.z;
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), centre));
    vec3 north = cross(centre, east);
    vec3 d = p - centre;
    float ex = dot(d, east) / size;
    // No storm is perfectly round.
    float ey = dot(d, north) / size * own.x;
    if (ex * ex + ey * ey > 12.0) continue;
#if KIND == 1
    // Tropical storms weaken over land. The preset is only read here, for the few points a storm
    // reaches.
    if (tropical) life01 *= mix(1.0, 0.25, landBelow(centre, rate));
#endif
    // The inflowing air is lumpy, so the storm's shape wavers and its bands break up.
    vec3 lumps = vec3(ex, ey, own.y);
    ex += gnoise(lumps * 0.9 + uSeed) * 0.4;
    ey += gnoise(lumps.yxz * 0.9 + uSeed.yzx) * 0.4;
    float r = sqrt(ex * ex + ey * ey);
    float fade = (1.0 - smoothstep(1.8, 3.0, r)) * smoothstep(0.2, 0.5, dot(p, centre));
    // The twist is strongest near the eye and tightens as the storm matures and ages. It fades to
    // zero at the edge so the clouds do not tear there.
    float turn = state.w / (r + 0.45) * exp(-r * r * 0.22);
    float angle = turn * hemi * life01 * fade;
    float c = cos(angle);
    float s = sin(angle);
    q += east * ((c * ex - s * ey - ex) * size) + north * ((s * ex + c * ey - ey) * size);
    float bend = gnoise(lumps * 1.9 + uSeed.zxy) * 2.2;
    // The bands turn with the storm.
    float arms = 0.5 + 0.5 * cos(2.0 * atan(ey, ex) - hemi * 5.0 * log(r + 0.08) + bend - hemi * uTime * 0.3);
    arms *= 0.45 + 0.75 * smoothstep(-0.25, 0.3, gnoise(lumps * 3.3 + uSeed));
    float core = exp(-r * r * (tropical ? 1.4 : 0.6));
    float eye = exp(-pow(r / 0.16, 2.0)) * mature;
    // A tropical storm is a dense round mass; a mid-latitude storm is a loose comma around a
    // clearer centre.
    // Clear air winds in between the bands, so they count from below zero.
    float shown = fade * (core * (tropical ? 1.0 : 0.3) + (arms - 0.3) * exp(-r * r * 0.3) * (tropical ? 1.1 : 0.8));
    // A young or dying storm shrinks to the cloud at its core. Fading all of it evenly would turn
    // it into a patch of fog.
    gStormCover += max(shown * sqrt(life01) - (1.0 - life01) * 0.5 * fade, min(shown, 0.0)) - eye * life01 * 2.4;
    gStormCore = max(gStormCore, life01 * core * (1.0 - eye) * (tropical ? 1.0 : 0.6));
  }
  return q;
}

// Dust storms on a dry planet with air; now and then one covers the whole planet, as on Mars.
// storms.ts decides where they are. Returns how much dust hides the ground, from 0 to 1.
float dustStorms(vec3 p) {
  // Most of the surface lies outside every storm most of the time, so the costly billows are
  // skipped there. The billows move the edge by at most 0.3 * min(radius, 0.6).
  vec3 away = vec3(9.0);
  bool any = false;
  for (int i = 0; i < 3; i++) {
    if (uDustLives[i] <= 0.0) continue;
    float radius = uDusts[i].w;
    away[i] = acos(clamp(dot(p, uDusts[i].xyz), -1.0, 1.0));
    if (away[i] - 0.3 * min(radius, 0.6) < radius) any = true;
  }
  if (!any) return 0.0;
  float billow = fbm3(p * 7.0 + uSeed.zxy + vec3(uTime * 0.02, 0.0, 0.0), 7.0);
  float dust = 0.0;
  for (int i = 0; i < 3; i++) {
    if (uDustLives[i] <= 0.0) continue;
    float radius = uDusts[i].w;
    float far = away[i] + billow * 0.3 * min(radius, 0.6);
    dust = max(dust, uDustLives[i] * (1.0 - smoothstep(radius * 0.5, radius, far)));
  }
  return clamp(dust * (0.8 + 0.5 * billow), 0.0, 1.0);
}

// Dust takes the colour of the ground it came from, tinted by the haze.
vec3 dustColor() {
  return mix(uColMid, uAtmo.rgb, 0.35) * 1.1;
}

// Where a place lies between the warmest (0) and the coldest (1) part of the planet. That is the
// latitude on a rotating planet and the distance from the point under the star (L) on a tidally
// locked one.
float climateZone(vec3 p, vec3 L) {
  return mix(abs(p.y), 0.5 - 0.5 * dot(p, L), uLocked);
}

#if KIND == 1
// Cloud from the weather preset of a world with seas (scripts/generate-presets.ts) at the point q of
// the drifting cloud frame: n is how much low cloud there is, on the scale of the noise in
// cloudCover, and nSun the same one step towards the star (toStar). The clouds keep moving with the
// winds they were simulated with, so the lows go on turning and the fronts go on sweeping round
// them. Also sets the high cloud and the thunderstorms there.
void weatherCloud(vec3 q, vec3 toStar, int octaves, out float n, out float nSun) {
  vec3 w = uWeatherTurn * q;
  MapPoint at = mapPoint(w);
  // The step towards the star as a step on the map. Near the poles a step east crosses many
  // longitudes, which the limit keeps finite.
  vec3 stepW = uWeatherTurn * toStar;
  vec3 east = normalize(vec3(w.z, 0.0, -w.x) + vec3(1e-6, 0.0, 0.0));
  float around = max(sqrt(max(1.0 - w.y * w.y, 0.0)), 0.2);
  vec2 stepUv = vec2(dot(stepW, east) / (2.0 * PI * around), dot(stepW, cross(w, east)) / PI);

  vec3 phases = flowPhases(0.12, q + 3.7);
  vec2 wind = flowAt(at.uv);
  vec2 uvA = upstream(at.uv, wind, phases.x, vec2(0.0), 1.0);
  vec2 uvB = upstream(at.uv, wind, phases.y, vec2(0.0), 1.0);
  // The simulation keeps every filament sharp, which no cloud is: drawn as they are, the fronts
  // look like ink in water. Reading the map out of focus, a degree wide at any zoom and for a map
  // of any size, leaves the weather systems, and the noise below gives them the ragged edges of
  // clouds. So far out of focus, the map needs none of the costly filtering that keeps a sharp one
  // sharp towards the limb; it only has to blur further where a pixel of the screen spans more of
  // it.
  vec2 size = vec2(textureSize(uMapClouds, 0));
  float blur = log2(max(size.x * 0.00293, 1.5 * min(length(at.dx * size), length(at.dy * size))));
  vec3 air = mix(
    textureLod(uMapClouds, uvB, blur).rgb,
    textureLod(uMapClouds, uvA, blur).rgb,
    phases.z);
  float lowSun = mix(
    textureLod(uMapClouds, uvB + stepUv, blur).r,
    textureLod(uMapClouds, uvA + stepUv, blur).r,
    phases.z);

  // The preset holds the weather systems; noise breaks them into smaller masses with ragged edges,
  // down to what a pixel can show.
  float broken = fbm(q * 6.0 + uSeed.yzx, octaves - 2, 6.0) * 0.9;
  // Clear air counts as only so clear, so a cyclone (see cyclones) can fill it with cloud.
  n = max((air.r - 0.47) * 1.2, -0.3) + broken;
  nSun = n + (lowSun - air.r) * 1.2;
  gCloudHigh = air.g;
  gStormCore = max(gStormCore, air.b * 0.45);
}
#endif

// Cloud cover over a solid planet, from 0 for clear sky to 1 for overcast. zone comes from
// climateZone, and toStar is the step along the surface towards the star over which a cloud shades
// its neighbour (see shadePlanet).
float cloudCover(vec3 p, float zone, int octaves, vec3 toStar) {
  bool weather = uOcean.a > -5.0;
  // A tidally locked planet does not turn, but its air still circulates, so its clouds move faster.
  float rate = mix(0.012, 0.03, uLocked);
  vec3 pr = rotateY(p, uTime * rate);
  vec3 prStar = rotateY(toStar, uTime * rate);
  gStormCover = 0.0;
  gStormCore = 0.0;
  gCloudHigh = 0.0;
  vec3 q = weather ? cyclones(pr, rate) : pr;
  float cover = uCloud.a;
  float n;
  float nSun;
#if KIND == 1
  if (uMapFlags.y > 0.5) {
    weatherCloud(q, prStar, octaves, n, nSun);
  } else
#endif
  {
    // On ocean worlds the winds stretch the clouds along the latitudes.
    vec3 stretch = weather ? vec3(2.8, 3.9, 2.8) : vec3(2.1, 3.0, 2.1);
    vec3 c = q * stretch + uSeed.yzx;
    // Moving the warp noise over time lets the clouds change shape as they drift, at no extra cost.
    vec3 morph = vec3(0.0, uTime * 0.015, 0.0);
    vec3 warp = vec3(
      fbm2(c * 1.2 + 13.0 + morph, 4.7),
      fbm2(c * 1.2 + 47.0 + morph, 4.7),
      fbm2(c * 1.2 + 83.0 + morph, 4.7));
    // Strong warping smears clouds into streaks, so ocean worlds use less of it.
    c += warp * (weather ? 0.8 : 1.3);
    // The layers of fbm, written out, because the two coarsest are needed by themselves.
    const vec3 next = vec3(19.1, 7.7, 13.3);
    vec3 c2 = c * 2.02 + next;
    vec3 c3 = c2 * 2.02 + next;
    float two = 0.5 * shows(3.9) * gnoise(c) + 0.26 * shows(7.878) * gnoise(c2);
    float coarse = two + 0.1352 * shows(15.914) * gnoise(c3);
    // The thick clouds of a world with seas shade each other: where the cloud is thicker one step
    // towards the star, the cloud here lies in shade. The two coarsest layers are read there for
    // that; finer ones would only add grain to the shade. Over the thin hazes of a dry world the
    // second read would show nothing.
    float twoSun = two;
    if (weather) {
      vec3 cSun = c + prStar * stretch;
      twoSun = 0.5 * shows(3.9) * gnoise(cSun) + 0.26 * shows(7.878) * gnoise(cSun * 2.02 + next);
    }
    vec3 fine = c3 * 2.02 + next;
    float amp = 0.070304;
    float scale = 3.9 * 8.242408;
    float rest = 0.0;
    float total = 0.8952;
    for (int i = 3; i < 9; i++) {
      if (i >= octaves) break;
      rest += amp * shows(scale) * gnoise(fine);
      total += amp;
      fine = fine * 2.02 + next;
      amp *= 0.52;
      scale *= 2.02;
    }
    n = (coarse + rest) / total;
    nSun = n + (twoSun - two) / total;
    if (weather) {
      // Thunderstorms gather where it is warmest, the subtropics are clear, and storm tracks lie
      // further out (like the deserts in terrainSurface).
      float lat = zone;
      // A tilted axis smears these belts over the year (uZones).
      cover += mix(0.4, 1.0, uZones) * (
          0.3 * exp(-pow(lat / 0.09, 2.0))
        - 0.3 * exp(-pow((lat - 0.42) / 0.12, 2.0))
        + 0.2 * exp(-pow((lat - 0.68) / 0.14, 2.0)));
    }
  }
  float threshold = mix(0.3, -0.12, clamp(cover, 0.0, 1.0));
  // Without weather the clouds are thin hazes of ice or dust, which thicken slowly from their
  // edges; a sharp edge would make them look like scraps of paper.
  if (!weather) {
    gCloudBody = smoothstep(threshold - 0.08, threshold + 0.34, n);
    gCloudSun = smoothstep(threshold - 0.08, threshold + 0.34, nSun);
    return gCloudBody;
  }
  n += gStormCover;
  nSun += gStormCover;
  // With weather, a cloud is a thin veil at its edge and grows thicker over a long way inwards, so
  // it is translucent and grey where it is thin and white only in its core. A cloud that is equally
  // white from edge to edge looks cut out of paper.
  float clear = threshold - 0.08;
  float thin = threshold - 0.04;
  float dense = threshold + 0.62;
  gCloudSun = smoothstep(thin, dense, nSun);
  // The lumps and wisps move the result by at most 0.4, so they are skipped where the sky is clear.
  if (n < clear - 0.4) {
    gCloudBody = 0.0;
    return 0.0;
  }
  // Lumps make the clouds look like heaps of cumulus all the way in: round tops with creases in
  // between, which is what the folded noise gives.
  gCloudHeap = abs(fbm3(pr * 15.0 + uSeed.zxy + 11.0, 15.0)) * 2.2;
  float lumps = (gCloudHeap - 0.42) * 0.26;
  n += lumps;
  gCloudBody = smoothstep(thin, dense, n);
  gCloudSun = smoothstep(thin, dense, nSun + lumps);
  // The wisps move the edge by at most 0.1, so they are skipped where the cloud is opaque anyway.
  // The edge is narrow and frayed by them: a wide soft one would lie on the planet like milk.
  if (n > threshold + 0.4) return 1.0;
  return smoothstep(clear, threshold + 0.26, n + fbm2(pr * 38.0 + uSeed.yzx + 5.0, 38.0) * 0.16);
}

// The exoplanet presets (scripts/generate-presets.ts) hold no colours, only what shaped the
// surface. The code below turns them into each planet's own picture.
#if KIND == 1 || KIND == 2
vec3 presetPoint(vec3 p) {
  return uMapTurn * p;
}
#endif

#if KIND == 1
// The steepest slopes a relief map can hold, of the height and of the craters, per radian. They must
// match HEIGHT_SLOPE_LIMIT and CRATER_SLOPE_LIMIT in scripts/generate-presets.ts.
const vec2 RELIEF_LIMITS = vec2(24.0, 48.0);

// The slope of a preset's ground at the preset point q, as a vector along the sphere that points
// uphill. It comes from a map of its own, because slopes taken from the 256 steps of the height
// channel would show as terraces. The upper half of that map holds the slopes of the height and the
// lower half those of the craters, each towards east and north, as signed square roots.
vec3 presetSlope(sampler2D relief, vec3 q, MapPoint at) {
  // Staying a texel and a half away from the edges keeps the two halves from bleeding into each
  // other at the poles.
  vec2 size = vec2(textureSize(relief, 0));
  float edge = 3.0 / size.y;
  float v = clamp(at.uv.y, edge, 1.0 - edge) * 0.5;
  // Slopes only shade the ground, so they are read without the costly filtering that keeps the
  // colours of a map sharp towards the limb: there they are blurred along the line of sight
  // instead, which the foreshortening hides.
  vec2 dx = vec2(at.dx.x, at.dx.y * 0.5) * size;
  vec2 dy = vec2(at.dy.x, at.dy.y * 0.5) * size;
  float level = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1.0));
  vec2 ground = textureLod(relief, vec2(at.uv.x, v + 0.5), level).rg * 2.0 - 1.0;
  vec2 pits = textureLod(relief, vec2(at.uv.x, v), level).rg * 2.0 - 1.0;
  // The craters count as deep as they show on this planet (see terrainSurface).
  vec2 rise = ground * abs(ground) * RELIEF_LIMITS.x + pits * abs(pits) * (RELIEF_LIMITS.y * 0.24 * uCraters);
  vec3 east = normalize(vec3(q.z, 0.0, -q.x) + vec3(1e-6, 0.0, 0.0));
  return rise.x * east + rise.y * cross(q, east);
}

// Reads the presets at a point: in d, r is the eroded height, g is where water gathers (or the
// cracks of an ice crust), and b holds the craters. slope is the slope of the ground in planet
// space. share is how much of the second preset is mixed in.
void terrainRead(vec3 p, float share, out vec3 d, out vec3 slope) {
  vec3 q = presetPoint(p);
  MapPoint at = mapPoint(q);
  d = textureGrad(uMapDay, at.uv, at.dx, at.dy).rgb;
  // A vector times the turn is the vector turned back into planet space.
  slope = presetSlope(uMapRelief, q, at) * uMapTurn;
  if (uMapFlags.x > 0.5) {
    q = uMapTurn2 * p;
    at = mapPoint(q);
    d = mix(d, textureGrad(uMapNight, at.uv, at.dx, at.dy).rgb, share);
    slope = mix(slope, presetSlope(uMapRelief2, q, at) * uMapTurn2, share);
  }
}

// Rocky surface from the preset data d. zone comes from climateZone, and sunward is how directly
// the star stands above the point. still is 1 where lava has filled the ground to a level surface.
void terrainSurface(vec3 p, vec3 d, float zone, float sunward, out vec3 albedo, out float still, out float gloss, out vec3 emit) {
  int extra = int(uDetail);
  float dent = (d.b - 0.5) * 2.0 * uCraters;
  float fine = fbm(p * 9.0 + uSeed, 3 + extra, 9.0);
  float patches = fbm3(p * 3.1 + uSeed.zxy + 91.3, 3.1);
  // Noise of the dry ground that the lava reads again.
  float mottle = 0.0;
  float rust = 0.0;
  float grain = 0.0;

  gloss = 0.0;
  emit = vec3(0.0);
  still = 0.0;
  float height = d.r + dent * 0.12;
  // The preset is too coarse for small bays and headlands, so noise adds them, more when zoomed in,
  // which keeps coasts crisp.
  float h = height + fine * 0.025 + fbm(p * 37.0 + uSeed.yzx, 2 + extra, 37.0) * 0.012;
  float flow = d.g;
  float level = uOcean.a;

  if (uTerrain.w > 0.5) {
    // An ice crust has bright young ice, darker old ice and stained cracks.
    albedo = mix(uColMid, uColHigh, smoothstep(0.2, 0.8, h + patches * 0.35));
    albedo = mix(albedo, uColLow, smoothstep(0.05, 0.4, patches) * 0.45);
    float lines = smoothstep(0.1, 0.55, flow);
    albedo = mix(albedo, uColLow * vec3(0.8, 0.55, 0.42), lines * 0.8);
    albedo *= 1.0 + fine * 0.35 + dent * 0.25;
    gloss = 0.3 * (1.0 - lines);
  } else if (level > -5.0) {
    float inland = h - level;
    // Altitude is measured relative to what lies above this planet's sea.
    float alt = smoothstep(0.3, 0.9, inland / max(1.0 - level, 0.05));
    float valley = smoothstep(0.0, 0.64, flow);

    // Earth-like climate zones: it is wet near the equator, dry around 25 degrees, mild in the
    // mid-latitudes and cold near the poles and on mountains. Valleys are greener and the inland is
    // drier.
    float lat = zone;
    float moisture = patches;
    // On a tilted planet the seasons widen and weaken the desert belts and push the cold towards
    // the poles.
    float dryBelt = exp(-pow((lat - 0.42) / mix(0.24, 0.13, uZones), 2.0)) * mix(0.5, 1.0, uZones);
    float dryness = clamp(dryBelt * 0.95 - moisture * 1.3 + smoothstep(0.03, 0.3, inland) * 0.3 - valley * 0.35 - 0.1, 0.0, 1.0);
    float warmer = (1.0 - uZones) * 0.15;
    float cold = smoothstep(0.6 + warmer, 0.85 + warmer, lat + moisture * 0.15 + alt * 0.25);

    // Seen from space, vegetation is dark and muted rather than bright green.
    float grey = dot(uColLow, vec3(0.3, 0.6, 0.1));
    vec3 forest = mix(uColLow, vec3(grey), 0.3) * 0.55;
    vec3 grass = mix(uColLow, uColMid, 0.25) * 0.85;
    vec3 tundra = mix(uColHigh, uColLow, 0.35) * 0.8;
    vec3 land = mix(forest, grass, smoothstep(0.15, 0.45, dryness));
    land = mix(land, uColMid, smoothstep(0.45, 0.75, dryness));
    land = mix(land, tundra, cold);
    land = mix(land, uColHigh * 0.9, smoothstep(0.35, 0.8, alt));
    land = mix(land, vec3(0.8, 0.83, 0.87), smoothstep(0.75, 1.0, alt + cold * 0.4));
    land *= 0.85 + fine * 0.6 + patches * 0.15;

    float river = smoothstep(0.49, 0.82, flow) * uTerrain.y * (1.0 - cold) * (1.0 - dryness * 0.6);
    land = mix(land, uOcean.rgb * 0.9, river * 0.8);

    // Shallow shelves are light and the deep sea is dark.
    float depth = clamp(-inland / 0.25, 0.0, 1.0);
    vec3 water = mix(uOcean.rgb * vec3(0.95, 1.15, 1.12), uOcean.rgb * 0.35, smoothstep(0.0, 0.3, depth));
    float shore = smoothstep(level - 0.004, level + 0.004, h);
    albedo = mix(water, land, shore);
    gloss = (1.0 - shore) + shore * river * 0.5;
  } else {
    // On dry ground, old filled basins are darker plains, old riverbeds are darker lines, and
    // craters have bright rims and dark floors.
    float basin = uTerrain.x > 0.0 ? 1.0 - smoothstep(uTerrain.x - 0.1, uTerrain.x + 0.1, h + patches * 0.12) : 0.0;
    float t = clamp(h + patches * 0.25, 0.0, 1.0);
    // Highlands are paler than lowlands, but dust covers both, so the colours blend over a long
    // distance.
    albedo = mix(uColLow, uColMid, smoothstep(0.15, 0.6, t));
    albedo = mix(albedo, uColHigh, smoothstep(0.45, 1.0, t) * 0.7);
    albedo = mix(albedo, uColLow * 0.8, basin * 0.45);
    mottle = fbm3(p * 1.6 + uSeed + 17.0, 1.6);
    albedo *= 1.0 + mottle * 0.5;
    albedo *= 1.0 - smoothstep(0.27, 0.82, flow) * 0.3 * uTerrain.y;
    albedo *= 1.0 + fine * 0.5 + dent * 0.45;

    // Weathered ground turns rusty and bare rock stays grey, so a dry world is never one flat
    // colour.
    rust = fbm3(p * 2.2 + uSeed.yzx + 3.0, 2.2);
    float grey = dot(albedo, vec3(0.3, 0.6, 0.1));
    albedo = mix(albedo, albedo * vec3(1.1, 0.94, 0.85), smoothstep(0.0, 0.35, rust) * 0.5);
    albedo = mix(albedo, vec3(grey) * vec3(0.95, 0.97, 1.0), smoothstep(0.0, 0.35, -rust) * 0.35);
    // Rock strata show on the slopes of the highlands.
    float slopes = smoothstep(0.45, 0.8, t);
    if (slopes > 0.0) albedo *= 1.0 + sin(h * 140.0 + fbm2(p * 6.0 + uSeed, 6.0) * 6.0) * 0.06 * slopes;
    // With an atmosphere, wind piles the lowland sand into dune fields with bright crests and dark
    // lee sides.
    if (uAtmo.a > 0.05) {
      // The ridges repeat 150 times per radius and would only alias from afar, so they fade out
      // with shows().
      float lowland = (1.0 - smoothstep(0.35, 0.6, h)) * shows(150.0);
      if (lowland > 0.0) {
        vec3 sand = p * vec3(150.0, 55.0, 150.0) + uSeed + gnoise(p * 18.0 + uSeed.zxy) * 2.5;
        float dune = pow(clamp(1.0 - abs(gnoise(sand) * 1.7), 0.0, 1.0), 2.0);
        albedo *= mix(1.0, 0.76 + 0.48 * dune, lowland * 0.9);
      }
    }
    // Fine grain of dust and stones adds detail that gets finer when zoomed in.
    grain = fbm(p * 120.0 + uSeed.zxy, 2 + extra, 120.0);
    albedo *= 1.0 + grain * 0.18;
  }

  if (uGlow.a > 0.0) {
    // Lava fills the basins and runs down the channels of dark rock. On a tidally locked planet
    // the rock melts on the day side and hardens on the night side.
    float lava = uTerrain.x + uLocked * 0.3 * sunward * min(uGlow.a, 1.0);
    float sea = 1.0 - smoothstep(lava - 0.02, lava + 0.02, h);
    // How hot the lava is, from 0 to 1: hottest where the sea is deep, in the places where it
    // wells up, and under the star of a planet that its star holds. A hotter planet (uGlow.a)
    // keeps more of its lava open.
    float temper = clamp(0.3 * uGlow.a + 0.4 * clamp((lava - h) / 0.3, 0.0, 1.0) + patches * 0.6 + uLocked * 0.3 * sunward, 0.0, 1.0);
    float glowing = 0.0;
    if (sea > 0.0) {
      // A sea of lava lies under a dark crust, and the melt shows in the channels that thread it:
      // narrow where the sea is cool, wider where it is hotter, until they join to open melt. The
      // currents draw the channels out, which bending the noise imitates.
      vec3 drawn = p * 4.5 + uSeed.zxy + vec3(mottle, rust, patches) * 2.2;
      float veins = abs(fbm(drawn, 4 + extra, 4.5));
      float reach = max((temper - 0.4) * 0.7, 0.0) + 0.012;
      // A channel narrower than a pixel is drawn a pixel wide and that much fainter, so it neither
      // flickers nor gains light.
      float wide = max(reach, gPixel * 6.0);
      float inside = wide - veins;
      // A channel is hottest in its middle and cools towards its banks, where the crust begins.
      float melt = smoothstep(0.0, min(wide, 0.05), inside) * (0.32 + 0.68 * smoothstep(0.0, 0.55, inside)) * (reach / wide);
      melt *= 0.7 + 0.7 * fine + 0.2 * temper;
      // Beside a channel the crust is thin: it glows dully and shows glowing cracks from close by.
      float thin = smoothstep(-0.16, 0.0, inside);
      float cracks = (1.0 - smoothstep(0.0, 0.05, abs(grain))) * smoothstep(0.0, 0.2, fine) * (1.0 - smoothstep(0.1, 0.25, 120.0 * gPixel));
      glowing = melt + (1.0 - melt) * (thin * thin * temper * (0.04 + 0.25 * cracks) + 0.012 * temper);
      // By day the crust shows as smooth dark rock, darker than the old ground above it.
      vec3 crust = mix(uColLow, uColMid, clamp(0.35 + 0.5 * mottle, 0.0, 1.0)) * (1.0 + fine * 0.5 + grain * 0.2);
      albedo = mix(albedo, crust, sea);
    }
    // Lava lights the rock beside it, which shows as a soft glow along the shores of the hot parts
    // and along the valleys its rivers run in.
    float beside = (1.0 - smoothstep(lava, lava + 0.09, h)) * (1.0 - sea);
    // A river of lava is brightest in its middle. More of the channels carry lava on a planet with
    // many rivers (uTerrain.y).
    float bed = mix(0.62, 0.36, uTerrain.y);
    float streams = smoothstep(bed, bed + 0.3, flow) * (1.0 - sea);
    float valley = smoothstep(bed - 0.25, bed, flow) * (1.0 - sea);
    float heat = clamp(sea * glowing + beside * beside * temper * 0.1 + streams * (0.45 + 0.25 * uGlow.a) + valley * 0.04, 0.0, 1.0);
    // Smoke and ash hang over parts of the land and the lava and dim the glow, more in denser air.
    float ash = smoothstep(0.0, 0.45, rust + mottle * 0.5) * min(uAtmo.a * 3.0, 0.85);
    // Glowing rock runs from deep red through orange to yellow as it gets hotter, without a step in
    // between: its red grows steadily, and its green and blue rise late. A cooler planet (uGlow.rgb)
    // stays redder throughout.
    vec3 fire = uGlow.rgb * vec3(1.0, vec2(0.3 + 2.0 * heat * heat));
    emit = fire * heat * (2.2 - 0.6 * heat) * uGlow.a * (1.0 - ash * 0.8);
    albedo *= 1.0 - heat * 0.7;
    still = sea;
  }

  if (uIce > 0.0 && uTerrain.w < 0.5) {
    float latitude = zone + fine * 0.08 + patches * 0.1 + max(h - 0.6, 0.0) * 0.12;
    float ice = smoothstep(1.0 - uIce - 0.04, 1.0 - uIce + 0.04, latitude);
    albedo = mix(albedo, vec3(0.86, 0.91, 0.96) * (0.92 + fine * 0.5), ice);
    gloss = mix(gloss, 0.25, ice);
  }
}
#endif

#if KIND == 2
// The wind a band preset was simulated with (scripts/generate-presets.ts) at s = sin(latitude). It
// calms towards the poles, and positive values blow east.
float presetWind(float s) {
  return jetSpeed(s, uBelts.y) * (1.0 - pow(abs(s), 6.0));
}

// Thin cloud threads along the bands add detail finer than the preset can hold.
float cloudThreads(vec3 q) {
  return fbm(vec3(q.x * 6.0, q.y * 80.0, q.z * 6.0) + uSeed.zxy, 3 + int(uDetail), 80.0);
}

// A storm outbreak as on Saturn: a bright plume wells up at one point and is drawn out along its
// band. storms.ts decides where it is and how old. Returns its cover from 0 to 1 at the preset
// point q.
float outbreak(vec3 q) {
  float life01 = uOutbreak.w;
  if (life01 <= 0.0) return 0.0;
  float f = uOutbreak.z;
  float dLon = mod(atan(q.x, q.z) - uOutbreak.x + PI, 2.0 * PI) - PI;
  float dLat = asin(clamp(q.y, -1.0, 1.0)) - uOutbreak.y;
  // The tail trails behind the head and grows longer and wider with time.
  float tail = dLon * uOutbreakTail;
  float stretch = 0.15 + 2.4 * f;
  float width = 0.035 + 0.07 * f;
  // The head is bright and lumpy where the cloud wells up, and the tail thins out.
  float along = tail > 0.0 ? exp(-pow(tail / stretch, 2.0) * 1.5) * (0.45 + 0.55 * exp(-tail / (0.3 * stretch))) : exp(-pow(tail / 0.06, 2.0));
  float crown = exp(-(dLon * dLon + dLat * dLat) / pow(width * 1.3, 2.0));
  float body = along * exp(-pow(dLat / width, 2.0));
  // The puffs are at most 1.3, so they are skipped where the plume cannot show, which is most of
  // the planet.
  if ((body + crown * 0.8) * 1.3 * life01 < 0.004) return 0.0;
  // The whole plume is heaped cloud, the head too: an even crown would be a white disc.
  float puffs = smoothstep(-0.2, 0.3, fbm4(q * 34.0 + uSeed + vec3(uTime * 0.05), 34.0)
    + 0.5 * fbm2(q * 9.0 + uSeed.zxy + vec3(uTime * 0.03), 9.0)) * 1.3;
  return clamp((body + crown * 0.8) * puffs * life01, 0.0, 1.0);
}

// A gas giant from a band preset: r holds the belts and zones, g a second tracer for fine streaks,
// and b the storms. flash returns the lightning there.
void bandsSurface(vec3 p, out vec3 albedo, out vec3 emit, out float flash) {
  float contrast = uBands.x;
  vec3 q = presetPoint(p);
  // Only part of the preset's latitudes is shown, which widens the belts.
  float lat = asin(clamp(q.y, -1.0, 1.0)) * uBelts.x;
  vec2 around = normalize(q.xz + vec2(1e-6, 0.0)) * cos(lat);
  q = vec3(around.x, sin(lat), around.y);

  vec3 d;
  float threads;
  if (uFlow > 0.0) {
    vec3 phases = flowPhases(0.6, p);
    // The clouds keep moving with the winds they were simulated with: the jets, which are known as
    // a formula, and the storms and the turbulence between the jets, which the flow map holds. So
    // every whirl of the preset turns and the festoons between the belts roll on.
    MapPoint at = mapPoint(q);
    vec2 jet = vec2(presetWind(q.y), 0.0);
    vec2 wind = jet + flowAt(at.uv) * uStormSpin;
    d = mix(
      textureGrad(uMapDay, upstream(at.uv, wind, phases.y, jet, uStormSpin), at.dx, at.dy).rgb,
      textureGrad(uMapDay, upstream(at.uv, wind, phases.x, jet, uStormSpin), at.dx, at.dy).rgb,
      phases.z);
    // Sampling further west moves the clouds east.
    float speed = -jet.x / (2.0 * PI);
    // The fine threads drift too, because standing still they would look like scratches on a
    // window.
    threads = mix(
      cloudThreads(rotateY(q, phases.y * speed * 2.0 * PI)),
      cloudThreads(rotateY(q, phases.x * speed * 2.0 * PI)),
      phases.z);
  } else {
    d = sampleMap(uMapDay, q, 0.0).rgb;
    threads = cloudThreads(q);
  }
  // Threads are left out inside the storms, where the clouds run in circles.
  threads *= 1.0 - d.b;

  // Every grey of the preset is kept, because two flat colours with an edge between them would look
  // drawn.
  float streak = (d.g - 0.5) * 2.0;
  float tone = clamp(
    0.5 + ((d.r - 0.5) * 1.7 + (streak * 0.1 + threads * 0.12) * uBands.y) * contrast, 0.0, 1.0);
  albedo = tone < 0.5
    ? mix(uColLow, uColMid, tone * 2.0)
    : mix(uColMid, uColHigh, tone * 2.0 - 1.0);

  // Each belt gets its own tint, redder or greyer, because the clouds of each latitude differ in
  // make-up. The second tracer marks upwelling gas and tints it slightly.
  float belt = gnoise(vec3(uSeed.x, q.y * 4.3 + uSeed.y, 7.3)) * 1.5;
  // Wisps of bright high cloud drift above the deck, as the white streaks of Neptune do, more of
  // them along some latitudes. They follow the preset's second tracer, so they move with its winds
  // and are wound up by its whirls.
  float wisps = smoothstep(0.12, 0.75, streak + threads * 0.25) * (0.45 + 0.55 * smoothstep(-0.4, 0.5, belt)) * uBands.w;
  vec3 grey = vec3(dot(albedo, vec3(0.3, 0.6, 0.1)));
  albedo = mix(albedo, albedo * vec3(1.14, 0.95, 0.8), clamp(belt, 0.0, 1.0) * 0.7);
  albedo = mix(albedo, grey * vec3(0.94, 0.99, 1.07), clamp(-belt, 0.0, 1.0) * 0.5);
  albedo *= 1.0 + streak * vec3(0.1, 0.05, -0.03);
  albedo = mix(albedo, mix(uColHigh, vec3(1.0), 0.5), wisps * 0.6);

  // Storms are darker and warmer than the clouds around them.
  vec3 storm = mix(uColLow, uColHigh, 0.3) * vec3(1.12, 0.9, 0.8);
  albedo = mix(albedo, storm, d.b * uBands.z * 0.45 * contrast);

  // A fresh plume is brighter and whiter than the clouds around it, but it is cloud of the same
  // planet: pure white would look pasted on.
  float plume = outbreak(q);
  // A slight shadow at its edge sets it apart even from bright zones.
  float rim = smoothstep(0.02, 0.25, plume) * (1.0 - smoothstep(0.25, 0.7, plume));
  albedo *= 1.0 - 0.18 * rim;
  albedo = mix(albedo, mix(uColHigh, vec3(1.0), 0.65) * 1.12, smoothstep(0.1, 0.9, plume) * 0.9);

  // The poles are hazier and darker.
  albedo = mix(albedo, uColMid * 0.72, smoothstep(0.7, 1.0, abs(p.y)) * 0.55);

  // Very hot giants glow from below, most through the dark belts, which are gaps in the clouds.
  // Faint heat is deep red and strong heat turns orange, like glowing iron.
  float heat = 0.08 + 0.92 * pow(1.0 - tone, 2.2);
  emit = mix(uGlow.rgb * vec3(0.75, 0.3, 0.2), uGlow.rgb, heat) * heat * uGlow.a;

  // Lightning briefly lights a thundercloud cell from within, most often in the storms.
  flash = 0.0;
  if (uLightning > 0.0) {
    flash = lightning(q, 26.0, 0.0007 * uLightning * (1.0 + 4.0 * d.b + 6.0 * plume));
  }
}
#endif

// How much air a ray crosses that leaves the ground at the cosine x to the vertical, as a multiple
// of the way straight up. On a round planet the air ends at the horizon, so the value stays finite
// there; below the horizon it stays at its largest.
float airMass(float x) {
  x = max(x, 0.0);
  return 1.0 / (x + 0.07 * exp(-9.0 * x));
}

// The colour of the planet at the point p, lit from L and seen from V. All three are unit vectors
// in planet space.
vec3 shadePlanet(vec3 p, vec3 L, vec3 V) {
  // The surface distance between neighbouring pixels. At the limb a neighbour may lie far away, so
  // the cap keeps it harmless.
  gPixel = min(max(length(dFdx(p)), length(dFdy(p))), 0.5);
  vec3 albedo;
  vec3 emit = vec3(0.0);
  float height = 0.0;
  float gloss = 0.0;
  // How much of the ground the low cloud hides, how thick it is here and one step towards the
  // star, and how much thin high cloud lies above it.
  float cloud = 0.0;
  float body = 0.0;
  float bodySun = 0.0;
  float high = 0.0;
  vec3 cloudColor = uCloud.rgb;
  float geo = dot(p, L);
  // A cloud shades the ground and the cloud behind it, as seen from the star: one step along the
  // surface away from the star, and further when the star is low.
  vec3 towardsStar = (L - p * geo) * (0.035 / max(geo, 0.3));

#if KIND == 1
  // Warping the lookup gives each planet its own coastlines. A fine second warp frays the steps of
  // the preset's pixels so rivers and shores stay ragged up close.
  vec3 bend = vec3(
    gnoise(p * 1.4 + uSeed),
    gnoise(p * 1.4 + uSeed + 31.7),
    gnoise(p * 1.4 + uSeed + 67.1)) * 0.11;
  bend += vec3(
    gnoise(p * 57.0 + uSeed.zxy),
    gnoise(p * 57.0 + uSeed.zxy + 13.3),
    gnoise(p * 57.0 + uSeed.zxy + 41.9)) * 0.004;
  // The two presets are mixed in large, softly blended patches, because a sharp transition would
  // look like a cliff.
  float share = smoothstep(-0.32, 0.32, gnoise(p * 0.8 + uSeed.yzx + 23.0));
  float zone = climateZone(p, L);
  vec3 data;
  vec3 ground;
  float still;
  terrainRead(normalize(p + bend), share, data, ground);
  terrainSurface(p, data, zone, geo, albedo, still, gloss, emit);
  float flash = 0.0;
  if (uCloud.a > 0.0) {
    // Thin cloud lets the ground show through, while thick cloud hides it.
    cloud = cloudCover(p, zone, 5 + int(uDetail), towardsStar);
    body = gCloudBody;
    bodySun = gCloudSun;
    // Below this the streaks could not bring the high cloud to show.
    if (gCloudHigh * (0.55 + 0.9 * uCloud.a) > 0.2) {
      // High cloud is ice drawn out by the wind: thin streaks that the ground and the low cloud
      // show through. It drifts faster than the weather below.
      vec3 up = rotateY(p, uTime * 0.02);
      float streaks = fbm2(vec3(up.x * 5.0, up.y * 34.0, up.z * 5.0) + uSeed.zxy, 34.0);
      high = smoothstep(0.3, 1.0, gCloudHigh * (0.55 + 0.9 * uCloud.a) + streaks * 0.3) * 0.38;
    }
    // Lightning flashes in thunderstorms, where the cloud is thick.
    if (gStormCore * body > 0.05) flash = lightning(p, 70.0, 0.02 * gStormCore) * body;
  }
  // Dust storms on a dry world hide the ground like a cloud of their own colour.
  if (uOcean.a <= -5.0) {
    float dust = dustStorms(p);
    if (dust > 0.0) {
      cloudColor = mix(cloudColor, dustColor(), dust / max(max(cloud, dust), 1e-3));
      cloud = max(cloud, dust * 0.85);
      body = max(body, dust * 0.5);
      bodySun = max(bodySun, dust * 0.5);
    }
  }
#elif KIND == 2
  float flash;
  bandsSurface(p, albedo, emit, flash);
#else
  // The place on the map is worked out once for every map that is read here.
  MapPoint at = mapPoint(p);
  vec3 texel;
  if (uFlow > 0.0) {
    // Each latitude of the map slides at its own speed (see flowPhases). The soft clouds of Venus
    // can take the full reach, sharp storms only half.
    bool veil = uFlow > 1.5;
    vec3 phases = flowPhases(veil ? 1.0 : 0.5, p);
    float speed = (veil ? veilSpeed(p.y) : jetSpeed(p.y, uSeed.x)) / (2.0 * PI);
    texel = mix(
      sampleAt(uMapDay, at, phases.y * speed).rgb,
      sampleAt(uMapDay, at, phases.x * speed).rgb,
      phases.z);
    if (veil) {
      // On Venus, brighter and darker swaths drift along the flow and slowly change shape.
      vec3 c = rotateY(p, uTime * 0.02) * vec3(2.0, 4.5, 2.0) + uSeed.zxy;
      vec3 morph = vec3(0.0, uTime * 0.02, 0.0);
      vec3 warp = vec3(fbm2(c * 1.3 + 5.0 + morph, 5.9), fbm2(c * 1.3 + 29.0 + morph, 5.9), 0.0);
      texel *= 1.0 + fbm4(c + warp * 1.2, 4.5) * 0.35;
    }
  } else {
    texel = sampleAt(uMapDay, at, 0.0).rgb;
  }
  albedo = toLinear(texel);
#if RELIEF == 2
  // The body has a map of its real slopes and seas.
  vec3 lie = sampleAt(uMapRelief, at, 0.0).rgb;
  gloss = uMapFlags.w * lie.b;
#else
  height = dot(texel, vec3(0.3, 0.6, 0.1));
  // Water is the part of the map that is clearly blue.
  gloss = uMapFlags.w * smoothstep(0.0, 0.02, albedo.b - max(albedo.r, albedo.g) * 1.15);
#endif
  // A real map is only so sharp. Where the view stretches its pixels over several of the screen,
  // fine grain takes over from it, as it does on the computed planets: streaks that drift with the
  // clouds on a banded planet, the grain of rock and dust on a solid one. Without it, zooming in
  // would only show blur.
  float stretched = smoothstep(2.0, 4.0, 2.0 * PI / (float(textureSize(uMapDay, 0).x) * gPixel));
  if (stretched > 0.0) {
    // The coarsest grain is two pixels of the map wide.
    float fineness = float(textureSize(uMapDay, 0).x) * 0.0796;
    if (uFlow > 0.0) {
      vec3 phases = flowPhases(uFlow > 1.5 ? 1.0 : 0.5, p);
      float speed = uFlow > 1.5 ? veilSpeed(p.y) : jetSpeed(p.y, uSeed.x);
      vec3 qa = rotateY(p, phases.x * speed);
      vec3 qb = rotateY(p, phases.y * speed);
      vec3 squeeze = vec3(0.08, 1.0, 0.08) * fineness;
      albedo *= 1.0 + stretched * 0.3 * mix(
        fbm3(qb * squeeze + uSeed.zxy, fineness),
        fbm3(qa * squeeze + uSeed.zxy, fineness),
        phases.z);
    } else {
      albedo *= 1.0 + stretched * 0.4 * (1.0 - 0.85 * gloss) * fbm4(p * fineness + uSeed.zxy, fineness);
    }
  }
  if (uMapFlags.y > 0.5) {
    // The cloud map is a photograph, so the cloud one step towards the star is read from it too.
    float here = mapClouds(p);
    // Stretched, a photograph of clouds turns to fog. Fine heaps along the edges of the clouds
    // keep them clouds; they drift east with the map (see mapClouds).
    float fog = smoothstep(2.0, 4.0, 2.0 * PI / (float(textureSize(uMapClouds, 0).x) * gPixel));
    if (fog > 0.0) {
      vec3 drifting = rotateY(p, -uTime * 0.0012 * 2.0 * PI);
      float fineness = float(textureSize(uMapClouds, 0).x) * 0.0796;
      float heaps = abs(fbm4(drifting * fineness + uSeed, fineness)) - 0.15;
      here += fog * heaps * 1.6 * here * (1.0 - here);
    }
    body = smoothstep(0.05, 0.95, here);
    bodySun = smoothstep(0.05, 0.95, mapClouds(normalize(p + towardsStar)));
    cloud = body;
    cloudColor = vec3(1.0);
  } else if (uCloud.a > 0.0) {
    // Without a cloud map (Mars), computed veils of ice haze lie over the real ground, so thin that
    // it shows through everywhere.
    cloud = cloudCover(p, abs(p.y), 6 + int(uDetail), towardsStar) * 0.3;
    body = cloud;
    bodySun = gCloudSun * 0.3;
    float dust = dustStorms(p);
    if (dust > 0.0) {
      cloudColor = mix(cloudColor, dustColor(), dust / max(max(cloud, dust), 1e-3));
      cloud = max(cloud, dust * 0.85);
      bodySun = max(bodySun, dust * 0.5);
    }
  }
#endif

  // Relief tilts the normal by the height gradient, so slopes facing the star are brighter.
  vec3 n = p;
#if RELIEF
#if KIND == 1
  vec3 slope = ground * (0.07 * uTerrain.z * (1.0 - still));
#elif RELIEF == 2
  // The relief map holds how far the ground leans east and north, which is downhill.
  vec3 east = normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-6, 0.0, 0.0));
  vec2 lean = lie.rg * 2.0 - 1.0;
  vec3 slope = -(lean.x * east + lean.y * cross(p, east)) * 2.2;
#else
  vec3 east = normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(p, east);
  const float reach = 0.004;
  float hEast = mapHeight(normalize(p + east * reach));
  float hNorth = mapHeight(normalize(p + north * reach));
  vec3 slope = ((hEast - height) * east + (hNorth - height) * north) * (0.02 / reach);
#endif
  slope *= uRelief * (1.0 - gloss) * (1.0 - cloud);
  float steepness = length(slope);
  if (steepness > 0.8) slope *= 0.8 / steepness;
  n = normalize(p - slope);
#endif

  // An atmosphere carries light a little past the edge of the day side: far into a deep one of
  // gas, and only a little over solid ground, where the scattered light of the air (below) stands
  // for the twilight.
#if AIR
  float wrap = 0.02 + 0.09 * uAtmo.a;
#else
  float wrap = 0.02 + 0.22 * uAtmo.a;
#endif
  float sunFlat = clamp((geo + wrap) / (1.0 + wrap), 0.0, 1.0);
#if RELIEF
  // A slope can only catch the star while the star is above the horizon. Without this, slopes far
  // into the night would still be lit.
  float sun = mix(sunFlat, clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0), smoothstep(-wrap, 0.08, geo));
#else
  float sun = sunFlat;
#endif

  // The cloud towards the star shades the ground here, and the cloud here too, which gives a cloud
  // a bright sunward side and a grey far side.
#if KIND == 1
  float shadow = smoothstep(0.0, 0.4, bodySun) * step(0.0, geo) * 0.7;
#else
  float shadow = bodySun * step(0.0, geo) * 0.7;
#endif
#if KIND == 1
  // A thin cloud is grey and a thick one white, and the tops of its heaps are brighter than the
  // creases between them.
  float cloudLight = clamp((0.7 + 0.3 * body + 1.1 * (body - bodySun)) * (0.84 + 0.22 * gCloudHeap), 0.45, 1.12);
#else
  float cloudLight = clamp(0.84 + 0.16 * body + 0.75 * (body - bodySun), 0.5, 1.12);
#endif

  // Where the star is low, its light has crossed more air and lost the colour of the sky. From
  // space this is a narrow reddish band along the terminator. Clouds lie above half of the air, so
  // half of that loss reaches them.
  vec3 starlight = uLight;
  vec3 cloudLit = uLight;
#if AIR
  vec3 depth = airDepthOf(uAtmo.rgb, uAtmo.a);
  float airStar = airMass(geo);
  cloudLit *= exp(-depth * (airStar - 1.0) * 0.5);
  starlight = cloudLit * cloudLit / max(uLight, 1e-3);
#elif KIND == 0
  starlight *= mix(vec3(1.0), mix(vec3(1.0, 0.8, 0.62), vec3(1.0), smoothstep(-0.12, 0.07, geo)), uAtmo.a);
#endif

  vec3 color = albedo * starlight * sun * (1.0 - cloud * 0.3) * (1.0 - shadow);
#if KIND == 2
  // A gas planet has no hard surface, so haze dims the clouds towards the limb.
  color *= 0.4 + 0.6 * pow(max(dot(p, V), 0.0), 0.5);
  // An image exposed for the sunlit clouds hardly shows a hot giant's glow by day, so the glow
  // mainly shows on the night side.
  emit *= 1.0 - 0.8 * smoothstep(-0.15, 0.5, geo);
  // Lightning only shows in the dark.
  emit += vec3(0.75, 0.82, 1.0) * flash * (1.0 - smoothstep(-0.25, 0.0, geo));
#endif

  float facing = max(dot(p, V), 0.0);
  if (gloss > 0.0 && geo > 0.0) {
    // The star glints on water and ice. Waves tilt the surface every way, so the glint is a soft
    // patch around the place that mirrors the star, bright in its middle, and it grows much
    // brighter towards the limb, where water reflects most of the light.
    vec3 H = normalize(L + V);
    float lean = max(dot(n, H), 1e-3);
    float level = 1.0 / (lean * lean);
    float waves = exp((1.0 - level) * 71.4) * level * level * 22.7;
    float away = 1.0 - max(dot(V, H), 0.0);
    float mirror = 0.02 + 0.98 * away * away * away * away * away;
    float glint = waves * mirror * 0.5 / max(facing, 0.12) * gloss * (1.0 - cloud) * (1.0 - shadow) * smoothstep(0.0, 0.1, geo);
    // Wind roughens the sea in patches, which makes the glint a little uneven. Broken up strongly,
    // it would look like a patch of fog. The noise is only read where there is a glint.
    if (glint > 2e-4) {
      glint *= 0.85 + 0.25 * smoothstep(-0.3, 0.3, fbm2(p * 18.0 + uSeed, 18.0));
      color += starlight * min(glint, 2.5);
    }
  }

  cloudColor *= cloudLight;
  // Clouds float above the ground, so the star still reaches them a little past the terminator.
  float sunCloud = clamp((geo + wrap + 0.03) / (1.0 + wrap), 0.0, 1.0);
  color = mix(color, cloudColor * cloudLit * sunCloud, cloud * 0.94);
#if KIND == 1
  color = mix(color, uCloud.rgb * cloudLit * sunCloud, high);
  // Lightning only shows in the dark.
  color += vec3(0.7, 0.78, 1.0) * flash * (1.0 - smoothstep(-0.3, -0.06, geo));
#endif

  // City lights show on the night side.
#if KIND == 0
  if (uMapFlags.x > 0.5) {
    vec3 night = toLinear(sampleAt(uMapNight, at, 0.0).rgb);
    color += night * 1.8 * (1.0 - smoothstep(-0.2, 0.1, geo)) * (1.0 - cloud * 0.6);
  }
#endif

  color += emit * (1.0 - cloud * 0.8);

  // The rings cast a shadow on the planet.
  if (uRing.z > 0.5 && abs(L.y) > 1e-4) {
    float t = -p.y / L.y;
    if (t > 0.0) {
      vec3 hit = p + t * L;
      color *= 1.0 - ringSample(length(hit.xz), 0.02).a * 0.8;
    }
  }

  // A trace of ambient light keeps the night side from vanishing.
  color += albedo * 0.004;

  if (uAurora.a > 0.0) {
    // Polar lights form a thin, wavering oval around each magnetic pole, which is slightly offset
    // from the axis, with rays that come and go. They only show against the dark.
    float waver = gnoise(vec3(p.x * 5.0, uTime * 0.04, p.z * 5.0) + uSeed.zxy);
    float pole = abs(dot(p, vec3(0.19, 0.98, 0.07))) + waver * 0.008;
    float oval = exp(-pow((pole - 0.94) / 0.009, 2.0));
    float rays = fbm2(vec3(p.x * 46.0, uTime * 0.2, p.z * 46.0) + uSeed, 46.0);
    float dark = 1.0 - smoothstep(-0.45, -0.1, geo);
    color += uAurora.rgb * uAurora.a * oval * (0.2 + 0.9 * max(rays + 0.25, 0.0)) * (0.6 + waver) * dark * 0.55;
  }

#if AIR
  // The air between the ground and the viewer takes light out of the picture and scatters starlight
  // into it: a thin veil of the sky's colour over the day side that thickens to a bright band at
  // the limb, where the line of sight runs through the most air. The light it scatters has itself
  // crossed the air, so the veil turns to the colours of a sunset at the terminator and fades out
  // a little beyond it. Cloud tops lie above half of the air.
  float clouded = max(cloud, high);
  float airView = airMass(facing) * (1.0 - 0.5 * clouded);
  vec3 through = exp(-depth * airView);
  // What is left after the way in and the way out is the product of what each leaves. The way in is
  // known from the starlight on the clouds (cloudLit), up to the air straight overhead, which is
  // thin enough for the first terms of its series.
  vec3 inward = cloudLit * cloudLit / max(uLight * uLight, 1e-3) * (1.0 - depth + 0.5 * depth * depth);
  // Where the star stands low, nearly nothing is left of any colour, and the veil would turn from
  // the colour of the sky to grey. The light that still reaches the air there comes in high above
  // the ground, through less of it, so the way in counts as four times straight up at most.
  inward = max(inward, 1.0 - 4.0 * depth + 8.0 * depth * depth);
  vec3 scattered = (1.0 - through * inward) * (airView / (airView + airStar));
  // The air that scatters lies at every height, so on average the starlight reaching it has lost
  // less than that on the clouds.
  // The tint of the starlight (uLight) is kept pale, so the colours of the ground stay readable.
  // The star itself is redder than that, and a red star has little of the light that air
  // scatters, so the veil counts the tint three times over. Under a Sun it changes nothing.
  color = color * through + scattered * (uLight + cloudLit) * uLight * uLight * (0.5 * smoothstep(-0.14, 0.1, geo));
#else
  // The haze of a gas planet shows as a thin veil of its own colour at the limb.
  float rim = pow(1.0 - facing, 3.0);
#if KIND == 2
  vec3 sky = uAtmo.rgb;
#else
  rim += 0.035;
  vec3 sky = mix(uAtmo.rgb * vec3(1.45, 0.82, 0.55), uAtmo.rgb, smoothstep(-0.1, 0.12, geo));
#endif
  color = mix(color, sky * uLight * smoothstep(-0.3, 0.45, geo) * 1.1, clamp(rim * uAtmo.a * 0.9, 0.0, 1.0));
#endif

  return color;
}
`;
