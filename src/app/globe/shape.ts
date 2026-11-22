import { seededRandom } from "@/shared/math";
import { MAP_GLSL } from "./surface.glsl";

/** Raster size of a radius grid, as scripts/shapes.ts writes it. */
export const SHAPE_WIDTH = 256;
export const SHAPE_HEIGHT = 128;

/** The surface of an irregular body as triangles, with the direction of each vertex for its map. */
export interface ShapeMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** The unit direction of each vertex from the centre, which is where the map is read. */
  directions: Float32Array;
  indices: Uint32Array;
}

/**
 * Builds the surface from a radius grid (rows from the north pole, GRID_HEIGHT + 1 of them, of 16-bit
 * steps of `maxRadius`), in radii of the sphere of the same volume. Directions follow the maps: y is the
 * axis and longitude 0 lies on +z, with east towards +x. The grid's rows close at the poles and its
 * columns wrap round, and the normals are averaged across the wrap so that no seam shows in the light.
 * With a `step` (1, 2, 4 or 8) only every step-th point in both directions is used: a body a few pixels
 * wide on the map looks the same with a sixteenth of the triangles.
 */
export function shapeMesh(grid: Uint16Array, maxRadius: number, step = 1): ShapeMesh {
  if (grid.length !== SHAPE_WIDTH * (SHAPE_HEIGHT + 1)) throw new Error(`A shape grid has ${grid.length} radii instead of ${SHAPE_WIDTH * (SHAPE_HEIGHT + 1)}.`);
  if (![1, 2, 4, 8].includes(step)) throw new Error(`A shape mesh cannot use every ${step}th point of the grid.`);
  const width = SHAPE_WIDTH / step;
  const height = SHAPE_HEIGHT / step;
  const columns = width + 1;
  const count = columns * (height + 1);
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  for (let row = 0; row <= height; row++) {
    const latitude = Math.PI / 2 - (Math.PI * row) / height;
    for (let column = 0; column < columns; column++) {
      const longitude = -Math.PI + (2 * Math.PI * column) / width;
      const direction = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
      const radius = (grid[row * step * SHAPE_WIDTH + ((column * step) % SHAPE_WIDTH)] / 65535) * maxRadius;
      const at = (row * columns + column) * 3;
      directions.set(direction, at);
      positions.set(direction.map((value) => value * radius), at);
    }
  }
  const indices = new Uint32Array(width * height * 6);
  let next = 0;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const a = row * columns + column;
      const b = a + columns;
      // Counter-clockwise seen from outside, so the faces point outwards.
      indices.set([a, b, a + 1, a + 1, b, b + 1], next);
      next += 6;
    }
  }
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3];
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const vertex of [a, b, c]) for (let k = 0; k < 3; k++) normals[vertex + k] += n[k];
  }
  // The first and last column are the same points, and every point of a pole row is the same point.
  for (let row = 0; row <= height; row++) {
    const first = row * columns * 3;
    const last = (row * columns + width) * 3;
    for (let k = 0; k < 3; k++) normals[first + k] = normals[last + k] = normals[first + k] + normals[last + k];
  }
  for (const row of [0, height]) {
    const sum = [0, 0, 0];
    for (let column = 0; column < width; column++) for (let k = 0; k < 3; k++) sum[k] += normals[(row * columns + column) * 3 + k];
    for (let column = 0; column < columns; column++) normals.set(sum, (row * columns + column) * 3);
  }
  for (let i = 0; i < count; i++) {
    const length = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) normals[i * 3 + k] /= length;
  }
  return { positions, normals, directions, indices };
}

/** Loads a radius grid from public/shapes. */
export async function loadShapeGrid(url: string): Promise<Uint16Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered with status ${response.status}`);
  const buffer = await response.arrayBuffer();
  // The file is little-endian, as is every device that runs WebGL in practice.
  return new Uint16Array(buffer);
}

/** Passes the object-space normal and the direction of the map to the fragment shader. */
export const SHAPE_VERTEX = /* glsl */ `
in vec3 position;
in vec3 normal;
in vec3 direction;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vNormal;
out vec3 vDirection;
out vec3 vPosition;
void main() {
  vNormal = normal;
  vDirection = direction;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Lights an airless, dusty surface. The Lommel–Seeliger law, which describes how such regolith scatters,
 * is mixed with Lambert's: the limb stays bright where a smooth ball would fade, and the terminator falls
 * off fast, as in spacecraft images of asteroids and small moons. Without a map the body has its colour.
 */
export const SHAPE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
${MAP_GLSL}
uniform sampler2D uMapDay;
uniform float uHasMap;
uniform vec3 uTint;          // linear colour where there is no map
uniform vec3 uLight;         // colour of the starlight
uniform vec3 uLightObject;   // the star's position in object space
uniform vec3 uCameraObject;  // the camera's position in object space
in vec3 vNormal;
in vec3 vDirection;
in vec3 vPosition;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(uLightObject - vPosition);
  vec3 V = normalize(uCameraObject - vPosition);
  float incidence = max(dot(n, L), 0.0);
  float emission = max(dot(n, V), 0.0);
  float regolith = 2.0 * incidence / (incidence + emission + 1e-4);
  float light = mix(incidence, regolith, 0.6);
  vec3 albedo = uHasMap > 0.5 ? toLinear(sampleMap(uMapDay, normalize(vDirection), 0.0).rgb) : uTint;
  outColor = vec4(toDisplay(albedo * uLight * light), 1.0);
}
`;

/** Smooth value noise in 3D from 0 to 1, with its lattice scrambled by `seed`. */
function valueNoise(x: number, y: number, z: number, seed: number): number {
  const hash = (i: number, j: number, k: number) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const plane = (k: number) =>
    lerp(lerp(hash(xi, yi, k), hash(xi + 1, yi, k), u), lerp(hash(xi, yi + 1, k), hash(xi + 1, yi + 1, k), u), v);
  return lerp(plane(zi), plane(zi + 1), w);
}

function fractalNoise(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let weight = 0;
  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * valueNoise(x, y, z, seed + octave * 101);
    weight += amplitude;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
    amplitude *= 0.5;
  }
  return sum / weight;
}

/**
 * A made-up shape and surface for a small body that no spacecraft has seen up close, from `seed`: an
 * ellipsoid with the axis ratios measured for small moons (the longest axis on +z, which a locked moon
 * turns to its planet, the shortest along its spin axis), lumpy and cratered, and a dark grey map with
 * mottling, dark crater floors and bright rims. It is drawn like a real shape model, and the page says it
 * is an illustration.
 */
export function inventedBody(seed: number): { grid: Uint16Array; maxRadius: number; map: Uint8Array; mapWidth: number; mapHeight: number } {
  const random = seededRandom(seed);
  const middle = 0.62 + 0.25 * random();
  const shortest = Math.min(middle, 0.45 + 0.25 * random());
  const craters = Array.from({ length: 6 + Math.floor(random() * 6) }, () => {
    const z = 2 * random() - 1;
    const angle = 2 * Math.PI * random();
    const ring = Math.sqrt(1 - z * z);
    return { centre: [ring * Math.cos(angle), z, ring * Math.sin(angle)], size: 0.15 + 0.35 * random() ** 2, depth: 0.04 + 0.08 * random() };
  });
  /** How far into a crater a direction lies: 1 at its centre, 0 at and beyond its rim. */
  const inCrater = (direction: number[], crater: (typeof craters)[number]) => {
    const along = direction[0] * crater.centre[0] + direction[1] * crater.centre[1] + direction[2] * crater.centre[2];
    const angle = Math.acos(Math.min(1, Math.max(-1, along)));
    return Math.max(0, 1 - angle / crater.size);
  };

  const radii = new Float32Array(SHAPE_WIDTH * (SHAPE_HEIGHT + 1));
  for (let row = 0; row <= SHAPE_HEIGHT; row++) {
    const latitude = Math.PI / 2 - (Math.PI * row) / SHAPE_HEIGHT;
    for (let column = 0; column < SHAPE_WIDTH; column++) {
      const longitude = -Math.PI + (2 * Math.PI * column) / SHAPE_WIDTH;
      const d = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
      let radius = 1 / Math.sqrt((d[0] / middle) ** 2 + (d[1] / shortest) ** 2 + d[2] ** 2);
      radius *= 1 + 0.22 * (fractalNoise(d[0] * 1.4 + 9, d[1] * 1.4 + 9, d[2] * 1.4 + 9, seed, 2) - 0.5);
      radius *= 1 + 0.06 * (fractalNoise(d[0] * 4 + 3, d[1] * 4 + 3, d[2] * 4 + 3, seed + 7, 3) - 0.5);
      for (const crater of craters) {
        const share = inCrater(d, crater);
        // A bowl inside, and a low rim just around it.
        radius *= 1 - crater.depth * share * share + 0.02 * Math.exp(-(((share - 0.08) / 0.06) ** 2));
      }
      radii[row * SHAPE_WIDTH + column] = radius;
    }
  }
  // Measured in the radius of the sphere of the same volume, as the real shapes are.
  let volume = 0;
  let solidAngle = 0;
  for (let row = 0; row <= SHAPE_HEIGHT; row++) {
    const weight = Math.max(Math.cos(Math.PI / 2 - (Math.PI * row) / SHAPE_HEIGHT), 1e-3);
    for (let column = 0; column < SHAPE_WIDTH; column++) {
      volume += radii[row * SHAPE_WIDTH + column] ** 3 * weight;
      solidAngle += weight;
    }
  }
  const mean = Math.cbrt(volume / solidAngle);
  const largest = radii.reduce((most, value) => Math.max(most, value), 0);
  const grid = Uint16Array.from(radii, (value) => Math.round((value / largest) * 65535));

  const mapWidth = 256;
  const mapHeight = 128;
  // Rows run from the south pole, as WebGL reads the rows of a data texture.
  const map = new Uint8Array(mapWidth * mapHeight * 4);
  for (let row = 0; row < mapHeight; row++) {
    const latitude = -Math.PI / 2 + (Math.PI * (row + 0.5)) / mapHeight;
    for (let column = 0; column < mapWidth; column++) {
      const longitude = -Math.PI + (2 * Math.PI * (column + 0.5)) / mapWidth;
      const d = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
      let light = 0.85 + 0.3 * (fractalNoise(d[0] * 3 + 5, d[1] * 3 + 5, d[2] * 3 + 5, seed + 13, 4) - 0.5);
      for (const crater of craters) {
        const share = inCrater(d, crater);
        light *= 1 - 0.18 * share + 0.25 * Math.exp(-(((share - 0.08) / 0.06) ** 2));
      }
      // A dark, slightly warm grey, as small captured moons are; the shader reads the map as display colour.
      const at = (row * mapWidth + column) * 4;
      map[at] = Math.min(255, Math.round(112 * light));
      map[at + 1] = Math.min(255, Math.round(106 * light));
      map[at + 2] = Math.min(255, Math.round(98 * light));
      map[at + 3] = 255;
    }
  }
  return { grid, maxRadius: largest / mean, map, mapWidth, mapHeight };
}
