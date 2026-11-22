/**
 * Simulates the colourless base maps ("presets") that the planet shader colours per
 * planet, and writes them to public/textures/presets plus metadata to presets.json.
 *
 *   npm run presets   (runs `terrain 2048`, `bands 2048` and `weather 2048`)
 *
 * PRESET_ONLY=a,b limits a run to some presets, and PRESET_DIR=folder writes the
 * maps and presets.json there instead (the tests use this).
 *
 * Rocky channels (RGB): eroded height, drainage (rivers, or cracks on ice), craters (0.5 is level).
 * Every rocky preset also gets a relief map (`<name>-relief`, twice as high): the slopes of the
 * height towards east (red) and north (green) in its upper half, those of the craters in its lower
 * half. The shader lights the ground with these, because slopes taken from the 256 steps of the
 * height channel show as terraces.
 * Banded channels (RGB): belts and zones, a second tracer for streaks, storms.
 * Weather channels (RGB): low cloud, high cloud, thunderstorms; they lie over rocky planets with seas.
 * Banded and weather presets also get a flow map (`<name>-flow`): the winds at the end of the run,
 * east in red and north in green, which the shader lets blow on.
 * Output is seeded and checked in.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { seededRandom, smoothstep } from "@/shared/math";
import { addWhirl, Flow, GH, GW, saveFlow } from "./winds";

const KIND = process.argv[2] as "terrain" | "bands" | "weather" | undefined;
const W = Number(process.argv[3] ?? 2048);
const H = W / 2;
/**
 * How much finer than 1024 pixels the run is. Everything that was tuned in pixels at that width (the
 * brush of the raindrops, the blur, the width of rivers) is scaled by it, so a finer run adds detail
 * without changing the terrain. Without it, single raindrops would leave a grain that shows as
 * speckled coasts.
 */
const FINER = Math.max(1, Math.round(W / 1024));
const ONLY = process.env.PRESET_ONLY?.split(",");
const DIR = process.env.PRESET_DIR;
const OUT = path.resolve(DIR ?? "public/textures/presets");
const META = DIR ? path.join(OUT, "presets.json") : path.resolve("src/app/globe/presets.json");

/** 3D Perlin noise with values of about -0.7 to 0.7. */
class Noise {
  private readonly perm = new Uint8Array(512);

  constructor(seed: number) {
    const rand = seededRandom(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  at(x: number, y: number, z: number): number {
    const perm = this.perm;
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const zf = Math.floor(z);
    const X = xf & 255;
    const Y = yf & 255;
    const Z = zf & 255;
    x -= xf;
    y -= yf;
    z -= zf;
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    const g = (hash: number, gx: number, gy: number, gz: number) => {
      const h = hash & 15;
      const a = h < 8 ? gx : gy;
      const b = h < 4 ? gy : h === 12 || h === 14 ? gx : gz;
      return ((h & 1) === 0 ? a : -a) + ((h & 2) === 0 ? b : -b);
    };
    const x1 = x - 1;
    const y1 = y - 1;
    const z1 = z - 1;
    const l1 = g(perm[AA], x, y, z) + u * (g(perm[BA], x1, y, z) - g(perm[AA], x, y, z));
    const l2 = g(perm[AB], x, y1, z) + u * (g(perm[BB], x1, y1, z) - g(perm[AB], x, y1, z));
    const l3 =
      g(perm[AA + 1], x, y, z1) + u * (g(perm[BA + 1], x1, y, z1) - g(perm[AA + 1], x, y, z1));
    const l4 =
      g(perm[AB + 1], x, y1, z1) +
      u * (g(perm[BB + 1], x1, y1, z1) - g(perm[AB + 1], x, y1, z1));
    const m1 = l1 + v * (l2 - l1);
    const m2 = l3 + v * (l4 - l3);
    return (m1 + w * (m2 - m1)) * 0.7;
  }

  /** Fractal Brownian motion with values of about -0.6 to 0.6. */
  fbm(x: number, y: number, z: number, octaves: number): number {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.at(x, y, z);
      total += amp;
      x = x * 2.02 + 19.1;
      y = y * 2.02 + 7.7;
      z = z * 2.02 + 13.3;
      amp *= 0.5;
    }
    return sum / total;
  }

  /** Ridged multifractal noise with values of 0 to 1. */
  ridged(x: number, y: number, z: number, octaves: number): number {
    let sum = 0;
    let amp = 0.5;
    let total = 0;
    let weight = 1;
    for (let i = 0; i < octaves; i++) {
      let n = 1 - Math.abs(this.at(x, y, z) * 1.6);
      n *= n * weight;
      weight = Math.min(1, Math.max(0, n * 2));
      sum += amp * n;
      total += amp;
      x = x * 2.03 + 5.1;
      y = y * 2.03 + 9.7;
      z = z * 2.03 + 2.3;
      amp *= 0.5;
    }
    return sum / total;
  }
}

/** Unit vector of each pixel, in the equirectangular layout the shader samples. */
const PX = new Float32Array(W * H);
const PY = new Float32Array(W * H);
const PZ = new Float32Array(W * H);
/** Pixel width of each row relative to the equator, clamped so the poles stay finite. */
const COS = new Float32Array(H);
for (let y = 0; y < H; y++) {
  const lat = (0.5 - (y + 0.5) / H) * Math.PI;
  COS[y] = Math.max(Math.cos(lat), 0.12);
  for (let x = 0; x < W; x++) {
    const lon = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
    const i = y * W + x;
    PX[i] = Math.cos(lat) * Math.sin(lon);
    PY[i] = Math.sin(lat);
    PZ[i] = Math.cos(lat) * Math.cos(lon);
  }
}

function randomDirection(rand: () => number): [number, number, number] {
  const y = rand() * 2 - 1;
  const lon = rand() * 2 * Math.PI;
  const r = Math.sqrt(1 - y * y);
  return [r * Math.sin(lon), y, r * Math.cos(lon)];
}

/** Returns the fractional pixel column and row of a unit direction. */
function toPixel(x: number, y: number, z: number): [number, number] {
  const lon = Math.atan2(x, z);
  const lat = Math.asin(Math.max(-1, Math.min(1, y)));
  return [(lon / (2 * Math.PI) + 0.5) * W - 0.5, (0.5 - lat / Math.PI) * H - 0.5];
}

/** Angle from a dot product, clamped because rounding can push it just outside -1 to 1. */
const angle = (dot: number) => Math.acos(Math.min(1, Math.max(-1, dot)));

interface Terrain {
  name: string;
  seed: number;
  /** Number of tectonic plates and the share of them that carries continents. */
  plates: number;
  continental: number;
  /** Height of continents above sea floors: 1 gives sharp continents, less gives blotchy lowlands. */
  split: number;
  /** Strength of the general unevenness and of the mountain belts. */
  relief: number;
  mountains: number;
  /** Number of shield volcanoes. */
  volcanoes: number;
  /** How much lowlands are levelled to plains, from 0 to 1. */
  plains: number;
  /** Raindrops per pixel and how hard they carve. */
  rain: number;
  carve: number;
  /** Number of craters and the angular radius of the largest. */
  craters: number;
  craterMax: number;
  /** Number of cracks in an ice crust, which replace rivers. */
  cracks: number;
}

const TERRAINS: Terrain[] = [
  // Several continents with mountain belts where plates collide.
  { name: "continents", seed: 11, plates: 14, continental: 0.42, split: 1, relief: 1, mountains: 1, volcanoes: 0, plains: 0.3, rain: 0.5, carve: 1, craters: 40, craterMax: 0.03, cracks: 0 },
  // Many small plates: chains of islands and small continents.
  { name: "archipelago", seed: 23, plates: 26, continental: 0.35, split: 0.9, relief: 1.25, mountains: 0.8, volcanoes: 30, plains: 0.2, rain: 0.45, carve: 1, craters: 30, craterMax: 0.03, cracks: 0 },
  // Few plates: one large landmass and a wide ocean.
  { name: "supercontinent", seed: 37, plates: 7, continental: 0.45, split: 1, relief: 0.9, mountains: 1.2, volcanoes: 0, plains: 0.35, rain: 0.55, carve: 1.1, craters: 30, craterMax: 0.03, cracks: 0 },
  // An old dry world: wide plains, canyons cut long ago, dunes, some craters.
  { name: "desert", seed: 41, plates: 9, continental: 0.5, split: 0.45, relief: 1.1, mountains: 0.7, volcanoes: 6, plains: 0.6, rain: 0.35, carve: 1.4, craters: 500, craterMax: 0.07, cracks: 0 },
  // No weather, no plates: craters upon craters, like Mercury or the Moon.
  { name: "cratered", seed: 53, plates: 5, continental: 0.5, split: 0.25, relief: 0.4, mountains: 0.15, volcanoes: 0, plains: 0.7, rain: 0, carve: 0, craters: 9000, craterMax: 0.16, cracks: 0 },
  // Shield volcanoes and lava plains; lava runs down the channels.
  { name: "volcanic", seed: 67, plates: 10, continental: 0.5, split: 0.5, relief: 0.8, mountains: 0.5, volcanoes: 90, plains: 0.5, rain: 0.12, carve: 0.8, craters: 150, craterMax: 0.05, cracks: 0 },
  // A rugged young world: many plates, high ranges, deep valleys.
  { name: "highlands", seed: 83, plates: 19, continental: 0.6, split: 0.7, relief: 1.4, mountains: 1.4, volcanoes: 10, plains: 0.15, rain: 0.6, carve: 1.3, craters: 60, craterMax: 0.04, cracks: 0 },
  // An old surface: a few giant impact basins filled to plains, like the Moon or Mars.
  { name: "basins", seed: 97, plates: 6, continental: 0.5, split: 0.35, relief: 0.7, mountains: 0.3, volcanoes: 12, plains: 0.75, rain: 0.15, carve: 0.6, craters: 1400, craterMax: 0.24, cracks: 0 },
  // A smooth shell of ice, crossed by long cracks, like Europa.
  { name: "icecrust", seed: 79, plates: 8, continental: 0.5, split: 0.15, relief: 0.5, mountains: 0.1, volcanoes: 0, plains: 0.5, rain: 0, carve: 0, craters: 120, craterMax: 0.04, cracks: 650 },
];

/** Builds the height map before erosion from plates, mountain belts and volcanoes. */
function buildTerrain(t: Terrain): Float32Array {
  const rand = seededRandom(t.seed);
  const noise = new Noise(t.seed * 7 + 1);
  const K = t.plates;
  const cx = new Float32Array(K);
  const cy = new Float32Array(K);
  const cz = new Float32Array(K);
  // Each plate drifts as a rotation about its own axis.
  const ox = new Float32Array(K);
  const oy = new Float32Array(K);
  const oz = new Float32Array(K);
  const base = new Float32Array(K);
  const land = new Uint8Array(K);
  for (let k = 0; k < K; k++) {
    [cx[k], cy[k], cz[k]] = randomDirection(rand);
    const [ax, ay, az] = randomDirection(rand);
    const speed = 0.5 + rand();
    ox[k] = ax * speed;
    oy[k] = ay * speed;
    oz[k] = az * speed;
    land[k] = rand() < t.continental ? 1 : 0;
    base[k] = (land[k] ? 0.1 + 0.12 * rand() : -0.34 - 0.12 * rand()) * t.split;
  }

  const volcanoes: { x: number; y: number; z: number; radius: number; height: number }[] = [];
  for (let v = 0; v < t.volcanoes; v++) {
    const [x, y, z] = randomDirection(rand);
    const size = Math.pow(rand(), 2.5);
    volcanoes.push({ x, y, z, radius: 0.025 + 0.11 * size, height: 0.12 + 0.3 * size });
  }

  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const px = PX[i];
    const py = PY[i];
    const pz = PZ[i];

    // Warped coordinates give ragged plate edges instead of straight lines.
    let wx = px + 0.42 * noise.fbm(px * 1.7 + 31.7, py * 1.7, pz * 1.7, 6);
    let wy = py + 0.42 * noise.fbm(px * 1.7, py * 1.7 + 67.1, pz * 1.7, 6);
    let wz = pz + 0.42 * noise.fbm(px * 1.7, py * 1.7, pz * 1.7 + 11.9, 6);
    const wl = Math.hypot(wx, wy, wz);
    wx /= wl;
    wy /= wl;
    wz /= wl;

    let first = 0;
    let second = 0;
    let best = -2;
    let next = -2;
    for (let k = 0; k < K; k++) {
      const d = wx * cx[k] + wy * cy[k] + wz * cz[k];
      if (d > best) {
        next = best;
        second = first;
        best = d;
        first = k;
      } else if (d > next) {
        next = d;
        second = k;
      }
    }
    // Distance to the edge between the two nearest plates, in radians.
    const edge = (angle(next) - angle(best)) / 2;

    // A positive `closing` means the two plates converge here, a negative one that they separate.
    let tx = cx[second] - cx[first];
    let ty = cy[second] - cy[first];
    let tz = cz[second] - cz[first];
    const along = tx * wx + ty * wy + tz * wz;
    tx -= wx * along;
    ty -= wy * along;
    tz -= wz * along;
    const tl = Math.hypot(tx, ty, tz) || 1;
    const dx = oy[first] * wz - oz[first] * wy - (oy[second] * wz - oz[second] * wy);
    const dy = oz[first] * wx - ox[first] * wz - (oz[second] * wx - ox[second] * wz);
    const dz = ox[first] * wy - oy[first] * wx - (ox[second] * wy - oy[second] * wx);
    const closing = Math.max(-1, Math.min(1, (dx * tx + dy * ty + dz * tz) / tl));

    let height = base[first] + (base[second] - base[first]) * 0.5 * Math.exp(-edge / 0.07);
    const belt = Math.exp(-((edge / 0.075) ** 2));
    const narrow = Math.exp(-((edge / 0.03) ** 2));
    let uplift = 0;
    if (closing > 0) {
      if (land[first]) uplift = closing * belt;
      else if (land[second]) height -= closing * 0.22 * narrow;
      else uplift = closing * 0.55 * narrow;
    } else if (land[first] && land[second]) {
      height += closing * 0.25 * narrow;
    } else if (!land[first] && !land[second]) {
      height -= closing * 0.07 * Math.exp(-((edge / 0.045) ** 2));
    }

    const ridges = noise.ridged(px * 5.2 + 3.3, py * 5.2, pz * 5.2, 6);
    // Old ranges inside continents are kept lower than the young collision belts.
    const inner = Math.max(0, noise.fbm(px * 1.3 + 7.1, py * 1.3, pz * 1.3, 3)) * (land[first] ? 1 : 0.15);
    height += t.mountains * (uplift * (0.28 + 0.75 * ridges) + inner * 0.55 * ridges);
    height += t.relief * 0.55 * noise.fbm(px * 2.3, py * 2.3 + 5.5, pz * 2.3, 10);

    for (const v of volcanoes) {
      const d = angle(px * v.x + py * v.y + pz * v.z) / v.radius;
      if (d >= 1) continue;
      // Each volcano is a broad shield with a caldera at the summit.
      const shield = Math.pow(1 - d, 1.6);
      const pit = d < 0.12 ? (0.12 - d) * 2.2 : 0;
      height += v.height * (shield - pit) * (0.85 + 0.3 * ridges);
    }

    h[i] = height;
  }

  if (t.plains > 0) {
    // The lowest 35% are flattened, as if filled with sediment or lava.
    const sorted = Float32Array.from(h).sort();
    const low = sorted[Math.floor(sorted.length * 0.35)];
    for (let i = 0; i < h.length; i++) {
      if (h[i] < low) h[i] = low + (h[i] - low) * (1 - t.plains);
    }
  }
  return h;
}

/** Hydraulic erosion: simulated raindrops pick up sediment where they are fast and deposit it where they slow. */
function erode(h: Float32Array, t: Terrain): void {
  const drops = Math.floor(W * H * t.rain);
  if (drops === 0) return;
  const rand = seededRandom(t.seed * 13 + 5);
  // Heights are scaled up for the drops, so they see steeper slopes than are stored.
  const scale = (W / 340) * t.carve;
  const inertia = 0.06;
  const capacity = 4;
  const minSlope = 0.01;
  const erodeSpeed = 0.3;
  const depositSpeed = 0.3;
  // A finer run takes more steps over the same ground, so what happens per step is divided up.
  const evaporate = 1 - Math.pow(1 - 0.015, 1 / FINER);
  const gravity = 4 / FINER;
  const radius = 2 * FINER;
  const brush: { dx: number; dy: number; w: number }[] = [];
  let weight = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > radius) continue;
      brush.push({ dx, dy, w: 1 - d / (radius + 0.5) });
      weight += 1 - d / (radius + 0.5);
    }
  }
  for (const b of brush) b.w /= weight;

  for (let n = 0; n < drops; n++) {
    // Drops are spread evenly over the sphere, not over the map, so the poles are not overcrowded.
    let y = (0.5 - Math.asin(rand() * 2 - 1) / Math.PI) * H - 0.5;
    let x = rand() * W;
    let dirX = 0;
    let dirY = 0;
    let speed = 1;
    let water = 1;
    let load = 0;
    for (let life = 0; life < 64 * FINER; life++) {
      const yi = Math.floor(y);
      if (yi < 2 || yi >= H - 3) break;
      const xi = Math.floor(x);
      const fx = x - xi;
      const fy = y - yi;
      const x0 = ((xi % W) + W) % W;
      const x1 = (x0 + 1) % W;
      const i00 = yi * W + x0;
      const i10 = yi * W + x1;
      const i01 = i00 + W;
      const i11 = i10 + W;
      const h00 = h[i00] * scale;
      const h10 = h[i10] * scale;
      const h01 = h[i01] * scale;
      const h11 = h[i11] * scale;
      const shrink = COS[yi];
      const gx = ((h10 - h00) * (1 - fy) + (h11 - h01) * fy) / shrink;
      const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
      dirX = dirX * inertia - gx * (1 - inertia);
      dirY = dirY * inertia - gy * (1 - inertia);
      const len = Math.hypot(dirX, dirY);
      if (len < 1e-9) break;
      dirX /= len;
      dirY /= len;
      const before = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
      x += dirX / shrink;
      y += dirY;
      const ny = Math.floor(y);
      if (ny < 2 || ny >= H - 3) break;
      const nxi = Math.floor(x);
      const nfx = x - nxi;
      const nfy = y - ny;
      const nx0 = ((nxi % W) + W) % W;
      const nx1 = (nx0 + 1) % W;
      const after =
        (h[ny * W + nx0] * (1 - nfx) * (1 - nfy) +
          h[ny * W + nx1] * nfx * (1 - nfy) +
          h[(ny + 1) * W + nx0] * (1 - nfx) * nfy +
          h[(ny + 1) * W + nx1] * nfx * nfy) *
        scale;
      const drop = after - before;
      const room = Math.max(-drop, minSlope) * speed * water * capacity;
      if (load > room || drop > 0) {
        const amount = (drop > 0 ? Math.min(drop, load) : (load - room) * depositSpeed) / scale;
        load -= amount * scale;
        h[i00] += amount * (1 - fx) * (1 - fy);
        h[i10] += amount * fx * (1 - fy);
        h[i01] += amount * (1 - fx) * fy;
        h[i11] += amount * fx * fy;
      } else {
        const amount = Math.min((room - load) * erodeSpeed, -drop) / scale;
        for (const b of brush) {
          const bx = (((x0 + b.dx) % W) + W) % W;
          h[(yi + b.dy) * W + bx] -= amount * b.w;
        }
        load += amount * scale;
      }
      speed = Math.sqrt(Math.max(0, speed * speed - drop * gravity));
      water *= 1 - evaporate;
    }
  }
}

/** Blurs away the grain of single raindrops, which lighting would show as a rough skin on all land. */
function smooth(h: Float32Array): void {
  // The blur is as wide on the ground at any resolution.
  for (let pass = 0; pass < FINER * FINER; pass++) blur(h);
}

function blur(h: Float32Array): void {
  const copy = Float32Array.from(h);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      const l = (x + W - 1) % W;
      const r = (x + 1) % W;
      const up = (y - 1) * W;
      const mid = y * W;
      const down = (y + 1) * W;
      h[mid + x] =
        (copy[up + l] + copy[up + r] + copy[down + l] + copy[down + r] +
          2 * (copy[up + x] + copy[down + x] + copy[mid + l] + copy[mid + r]) +
          4 * copy[mid + x]) /
        16;
    }
  }
}

/** Min-heap of cell indices, ordered by height. */
class Heap {
  private readonly cells: number[] = [];
  constructor(private readonly key: Float32Array) {}
  get size(): number {
    return this.cells.length;
  }
  push(cell: number): void {
    const cells = this.cells;
    const key = this.key;
    let i = cells.length;
    cells.push(cell);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (key[cells[parent]] <= key[cell]) break;
      cells[i] = cells[parent];
      i = parent;
    }
    cells[i] = cell;
  }
  pop(): number {
    const cells = this.cells;
    const key = this.key;
    const top = cells[0];
    const last = cells.pop() as number;
    const n = cells.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && key[cells[child + 1]] < key[cells[child]]) child++;
        if (key[cells[child]] >= key[last]) break;
        cells[i] = cells[child];
        i = child;
      }
      cells[i] = last;
    }
    return top;
  }
}

/**
 * Computes flow accumulation after filling depressions, so that rivers run through to the sea.
 * Returns 0 on ridges up to 1 for the largest rivers.
 */
function rivers(h: Float32Array): Float32Array {
  const n = W * H;
  const filled = Float32Array.from(h);
  const towards = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const order = new Int32Array(n);
  const heap = new Heap(filled);

  // The deepest tenth is assumed to be sea or basin floor, where water drains.
  const sorted = Float32Array.from(h).sort();
  const floor = sorted[Math.floor(n * 0.1)];
  for (let i = 0; i < n; i++) {
    if (h[i] <= floor) {
      seen[i] = 1;
      heap.push(i);
    }
  }
  let count = 0;
  while (heap.size > 0) {
    const cell = heap.pop();
    order[count++] = cell;
    const cy = Math.floor(cell / W);
    const cxx = cell - cy * W;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const neighbour = ny * W + ((cxx + dx + W) % W);
        if (seen[neighbour]) continue;
        seen[neighbour] = 1;
        if (filled[neighbour] <= filled[cell]) filled[neighbour] = filled[cell] + 1e-6;
        towards[neighbour] = cell;
        heap.push(neighbour);
      }
    }
  }

  const water = new Float32Array(n);
  for (let y = 0; y < H; y++) water.fill(COS[y], y * W, (y + 1) * W);
  for (let k = count - 1; k >= 0; k--) {
    const cell = order[k];
    if (towards[cell] >= 0) water[towards[cell]] += water[cell];
  }

  const out = new Float32Array(n);
  const top = Math.log(1 + n * 0.004);
  for (let i = 0; i < n; i++) {
    // Filled depressions are lakes or plains; drawing flow paths there would hatch them with lines.
    const level = filled[i] !== h[i];
    // Small catchments are dropped, because the trickle on every slope would only add noise.
    const amount = Math.min(1, Math.log(1 + water[i]) / top);
    out[i] = h[i] <= floor || level ? 0 : Math.max(0, (amount - 0.45) / 0.55);
  }
  return widen(out);
}

/**
 * Widens and softens thin lines, so they survive mipmapping and do not show
 * pixel steps up close.
 */
function widen(lines: Float32Array): Float32Array {
  let out = lines;
  for (let pass = 0; pass < FINER; pass++) out = widenOnce(out);
  return out;
}

function widenOnce(lines: Float32Array): Float32Array {
  const wide = new Float32Array(lines.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let around = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          // Diagonal neighbours get less weight, so the widened line stays round.
          const reach = dx !== 0 && dy !== 0 ? 0.6 : 0.82;
          around = Math.max(around, lines[ny * W + ((x + dx + W) % W)] * reach);
        }
      }
      wide[y * W + x] = Math.max(lines[y * W + x], around);
    }
  }
  const out = new Float32Array(lines.length);
  for (let y = 0; y < H; y++) {
    const up = Math.max(0, y - 1) * W;
    const mid = y * W;
    const down = Math.min(H - 1, y + 1) * W;
    for (let x = 0; x < W; x++) {
      const l = (x + W - 1) % W;
      const r = (x + 1) % W;
      out[mid + x] =
        (wide[up + l] + wide[up + r] + wide[down + l] + wide[down + r] +
          2 * (wide[up + x] + wide[down + x] + wide[mid + l] + wide[mid + r]) +
          4 * wide[mid + x]) /
        16;
    }
  }
  return out;
}

/** Draws ice-crust cracks as slightly bent great-circle arcs and raises the ice along them. */
function cracks(t: Terrain, h: Float32Array): Float32Array {
  const rand = seededRandom(t.seed * 17 + 3);
  const out = new Float32Array(W * H);
  for (let c = 0; c < t.cracks; c++) {
    // The arc lies in the plane perpendicular to the random pole n, spanned by u and v.
    const [nx, ny, nz] = randomDirection(rand);
    let [ux, uy, uz] = randomDirection(rand);
    const d = ux * nx + uy * ny + uz * nz;
    ux -= nx * d;
    uy -= ny * d;
    uz -= nz * d;
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    const length = 0.3 + 2.4 * Math.pow(rand(), 1.8);
    const strength = 0.35 + 0.65 * Math.pow(rand(), 1.5);
    const width = (0.6 + 1.6 * rand() * strength) * (W / 2048);
    const bend = (rand() - 0.5) * 0.25;
    const steps = Math.ceil((length * W) / Math.PI);
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * length;
      // A slight bend keeps the cracks from looking drawn with a ruler.
      const off = bend * Math.sin((s / steps) * Math.PI);
      let x = Math.cos(a) * ux + Math.sin(a) * vx + off * nx;
      let y = Math.cos(a) * uy + Math.sin(a) * vy + off * ny;
      let z = Math.cos(a) * uz + Math.sin(a) * vz + off * nz;
      const l = Math.hypot(x, y, z);
      x /= l;
      y /= l;
      z /= l;
      const [fx, fy] = toPixel(x, y, z);
      const row = Math.round(fy);
      if (row < 1 || row >= H - 1) continue;
      const fade = Math.sin((s / steps) * Math.PI) ** 0.4 * strength * smoothstep(0.985, 0.93, Math.abs(y));
      const reach = Math.ceil(width * 2);
      const stretch = 1 / COS[row];
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = row + dy;
        if (yy < 0 || yy >= H) continue;
        const reachX = Math.ceil(reach * stretch);
        for (let dx = -reachX; dx <= reachX; dx++) {
          const dist = Math.hypot(dx / stretch, dy) / width;
          if (dist > 2) continue;
          const xx = (((Math.round(fx) + dx) % W) + W) % W;
          const value = fade * Math.exp(-dist * dist * 1.5);
          const i = yy * W + xx;
          if (value > out[i]) out[i] = value;
        }
      }
    }
  }
  for (let i = 0; i < out.length; i++) h[i] += out[i] * 0.03;
  return out;
}

/**
 * Returns the height change from impact craters (bowl, raised rim and ejecta blanket).
 * Later craters overwrite earlier ones beneath them.
 */
function craters(t: Terrain): Float32Array {
  const rand = seededRandom(t.seed * 19 + 7);
  const out = new Float32Array(W * H);
  const smallest = (1.6 * Math.PI) / H;
  // A finer run can hold smaller craters. Their number follows the same power law, so the count of
  // craters above any size stays what it was.
  for (let c = 0; c < t.craters * FINER * FINER; c++) {
    const [x, y, z] = randomDirection(rand);
    // Radii follow a power law, so there are many small craters and few large ones.
    const radius = smallest / Math.pow(1 - rand() * (1 - (smallest / t.craterMax) ** 2), 0.5);
    // Depth grows with size, but giant basins are shallow for their width again
    // because their floors rebound and their rims slump.
    const depth = (0.25 + 0.75 * Math.min(1, radius / 0.06)) * Math.min(1, 0.16 / radius);
    const age = rand();
    const [fx, fy] = toPixel(x, y, z);
    const reach = radius * 2.2;
    const rows = Math.ceil((reach / Math.PI) * H);
    for (let dy = -rows; dy <= rows; dy++) {
      const yy = Math.round(fy) + dy;
      if (yy < 0 || yy >= H) continue;
      const cols = Math.min(W / 2, Math.ceil(((reach / (2 * Math.PI)) * W) / COS[yy]));
      for (let dx = -cols; dx <= cols; dx++) {
        const xx = (((Math.round(fx) + dx) % W) + W) % W;
        const i = yy * W + xx;
        const d = angle(PX[i] * x + PY[i] * y + PZ[i] * z) / radius;
        if (d > 2.2) continue;
        // Older craters are weathered, with shallower bowls and softer rims.
        const worn = 0.45 + 0.55 * age;
        const bowl = d < 1 ? (d * d - 1) * depth * worn : 0;
        const rim = Math.exp(-(((d - 1) / 0.14) ** 2)) * 0.32 * depth * worn;
        const thrown = d > 1 ? Math.exp(-(d - 1) / 0.35) * 0.1 * depth * worn : 0;
        const wipe = smoothstep(1.15, 0.85, d) * 0.85;
        out[i] = out[i] * (1 - wipe) + bowl + rim + thrown;
      }
    }
  }
  return out;
}

/**
 * The slopes are stored as their signed square root, which keeps gentle slopes precise: those are
 * the ones whose steps would show. The limits are the steepest slopes that can be stored, per radian,
 * and must match RELIEF_LIMITS in surface.glsl.ts.
 */
const HEIGHT_SLOPE_LIMIT = 24;
const CRATER_SLOPE_LIMIT = 48;

/** Returns how fast a field rises towards east and towards north, per radian. */
function slopes(field: Float32Array): { east: Float32Array; north: Float32Array } {
  const east = new Float32Array(W * H);
  const north = new Float32Array(W * H);
  const step = Math.PI / H;
  for (let y = 0; y < H; y++) {
    const cos = Math.max(Math.cos((0.5 - (y + 0.5) / H) * Math.PI), 1e-3);
    // Towards the poles the pixels of a row lie ever closer together. A wider reach keeps the
    // distance on the ground about the same, or the slope would be noise there.
    const reach = Math.min(W / 4, Math.max(1, Math.round(1 / cos)));
    const up = Math.max(0, y - 1);
    const down = Math.min(H - 1, y + 1);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      east[i] = (field[y * W + ((x + reach) % W)] - field[y * W + ((x + W - reach) % W)]) / (2 * reach * step * cos);
      north[i] = (field[up * W + x] - field[down * W + x]) / ((down - up) * step);
    }
  }
  return { east, north };
}

/**
 * Writes the relief map of a rocky preset from its height (0 to 1) and its crater channel (0.5 is
 * level). The upper half of the picture holds the slopes of the height, the lower half those of the
 * craters, each as east in red and north in green. The shader weighs the craters by planet, so the two
 * cannot be added here. A fourth channel would have to be alpha, which browsers do not hand over
 * unchanged.
 */
async function saveRelief(name: string, height: Float32Array, dents: Float32Array): Promise<void> {
  const store = (slope: number, limit: number) => {
    const share = Math.sqrt(Math.min(Math.abs(slope) / limit, 1));
    return Math.round(127.5 + 127.5 * Math.sign(slope) * share);
  };
  const half = (field: Float32Array, limit: number) => {
    const { east, north } = slopes(field);
    const pixels = new Uint8Array(W * H * 3).fill(128);
    for (let i = 0; i < W * H; i++) {
      pixels[i * 3] = store(east[i], limit);
      pixels[i * 3 + 1] = store(north[i], limit);
    }
    return sharp(pixels, { raw: { width: W, height: H, channels: 3 } });
  };
  const halves = [half(height, HEIGHT_SLOPE_LIMIT), half(dents, CRATER_SLOPE_LIMIT)];
  for (const [size, width] of [["lg", 2048], ["sm", 512]] as const) {
    // Each half is scaled by itself, so the poles of the two do not bleed into each other.
    const [upper, lower] = await Promise.all(
      halves.map((image) => image.clone().resize(width, width / 2, { kernel: "cubic" }).raw().toBuffer()),
    );
    const stacked = sharp(Buffer.concat([upper, lower]), { raw: { width, height: width, channels: 3 } });
    // AVIF keeps all three channels at full size, which lossy WebP cannot, at a third of the size of a JPEG.
    await stacked.avif({ quality: 72, chromaSubsampling: "4:4:4", effort: 4 }).toFile(path.join(OUT, `${name}-relief-${size}.avif`));
  }
}

interface Bands {
  name: string;
  seed: number;
  /** Number of jets between the poles and how fast they blow. */
  jets: number;
  wind: number;
  /** Strength of the equatorial jet; Saturn, for example, has a broad fast one. */
  equator: number;
  /** Counts of large ovals and of smaller long-lived eddies, and how fast they spin. */
  ovals: number;
  eddies: number;
  spin: number;
  /** Strength of the turbulence between the jets, and its scale in swirls around the circumference. */
  turbulence: number;
  grain: number;
  /** How finely the belts are divided. */
  belts: number;
  /** Simulation duration; a longer run draws the clouds out further. */
  time: number;
}

/** Strength of the alternating jets, relative to an equatorial jet with `equator: 1`. */
const JET_STRENGTH = 0.75;
const EQUATOR_NARROWNESS = 7;

/** Winds of a band preset in the form the shader reads them (GlobeSpec in globe/spec.ts). */
interface Winds {
  strength: number;
  count: number;
  equator: number;
  narrowness: number;
  phase: number;
  /**
   * The largest storms, so the shader can rotate them: centre longitude and latitude
   * (radians), half-height in latitude (radians; the storm is 1.7 times as wide), and
   * 1 for anticlockwise or -1 for clockwise rotation, seen from above with north up.
   */
  storms: [number, number, number, number][];
}

/** A storm as simulated, before rounding (see `Winds.storms`). */
type Storm = [lon: number, lat: number, size: number, spin: number];

/** How fast the storms of a band preset turn in its flow map, as a share of their speed in the run. */
const STORM_PACE = 0.09;

/** Maximum number of storms listed per preset. */
const NAMED_STORMS = 6;

/**
 * Exports the simulated winds, so the shader can keep the clouds drifting the way they
 * were drawn out. Only the profile shape matters, so speeds are normalised to about 1.
 */
function winds(b: Bands, phase: number, storms: Storm[]): Winds {
  const fastest = JET_STRENGTH + Math.abs(b.equator);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    strength: round(JET_STRENGTH / fastest),
    count: b.jets,
    equator: round(b.equator / fastest),
    narrowness: EQUATOR_NARROWNESS,
    phase: round(phase),
    storms: [...storms]
      .sort((a, c) => c[2] - a[2])
      .slice(0, NAMED_STORMS)
      .map(([lon, lat, size, spin]) => [round(lon), round(lat), round(size), spin]),
  };
}

const BANDS: Bands[] = [
  // Like Jupiter: many belts, strong winds, lively turbulence and one great oval.
  { name: "bands-stormy", seed: 101, jets: 19, wind: 1, equator: 0.5, ovals: 3, eddies: 14, spin: 1, turbulence: 1, grain: 9, belts: 14, time: 1 },
  // Like Saturn: broad soft belts, a fast equator, few storms.
  { name: "bands-broad", seed: 113, jets: 11, wind: 0.9, equator: 1.3, ovals: 1, eddies: 6, spin: 0.7, turbulence: 0.55, grain: 7, belts: 9, time: 1.25 },
  // Like Uranus and Neptune: hardly any belts, a few dark spots and bright streaks.
  { name: "bands-calm", seed: 127, jets: 5, wind: 0.7, equator: -0.9, ovals: 2, eddies: 4, spin: 0.8, turbulence: 0.3, grain: 6, belts: 4.5, time: 1.4 },
  // Many thin belts, finely ruffled, with a string of small ovals.
  { name: "bands-fine", seed: 139, jets: 29, wind: 0.85, equator: 0.7, ovals: 2, eddies: 22, spin: 0.9, turbulence: 0.7, grain: 13, belts: 22, time: 1.1 },
  // A restless giant: the belts are torn into festoons and plumes.
  { name: "bands-wild", seed: 151, jets: 13, wind: 1, equator: 0.3, ovals: 4, eddies: 20, spin: 1.1, turbulence: 1.7, grain: 7, belts: 10, time: 0.9 },
  // Under a deck of haze: faint broad belts, nothing sharp.
  { name: "bands-hazy", seed: 163, jets: 7, wind: 0.6, equator: 0.8, ovals: 0, eddies: 0, spin: 0.6, turbulence: 0.4, grain: 5, belts: 3.5, time: 1.5 },
];

/**
 * Advects tracers through zonal jets, long-lived vortices and time-varying turbulence.
 * Each pixel is traced backwards in time, which keeps fine filaments sharp where a
 * dye grid would blur them. The turbulence must vary in time: a steady flow winds the
 * gas into neat spirals that look drawn. Returns the pixels, the jet phase and the storms.
 */
function buildBands(b: Bands): { pixels: Uint8Array; phase: number; storms: Storm[]; flow: Uint8Array } {
  const rand = seededRandom(b.seed);
  const noise = new Noise(b.seed * 3 + 1);

  // Zonal wind per row; positive values blow east.
  const phase = rand() * 6.28;
  const windAt = (s: number) =>
    (Math.sin(s * b.jets + phase) * JET_STRENGTH + b.equator * Math.exp(-s * s * EQUATOR_NARROWNESS)) *
    (1 - Math.pow(Math.abs(s), 6)) *
    b.wind;
  const jet = new Float32Array(H);
  for (let y = 0; y < H; y++) jet[y] = windAt(Math.sin((0.5 - (y + 0.5) / H) * Math.PI));
  // Shear is always measured on full-size rows, so vortices land in the same
  // places in a smaller trial run.
  const SHEAR_ROWS = 1024;
  const shearAt = (where: number) => {
    const row = Math.floor(SHEAR_ROWS * where);
    const at = (y: number) => windAt(Math.sin((0.5 - (Math.min(SHEAR_ROWS - 1, Math.max(0, y)) + 0.5) / SHEAR_ROWS) * Math.PI));
    return at(row + 3) - at(row - 3);
  };

  // Everything except the jets is a stream function on a coarser grid.
  const steady = new Float32Array(GW * GH);
  const storms = new Float32Array(GW * GH);
  const named: Storm[] = [];
  const whirl = (size: number, turns: number, marks: boolean) => {
    // Vortices are placed where the shear is strongest and spin with it.
    let row = 0;
    let shear = 0;
    let at = 0;
    for (let tries = 0; tries < 3; tries++) {
      const where = 0.12 + 0.76 * rand();
      const s = shearAt(where);
      if (Math.abs(s) > Math.abs(shear)) {
        shear = s;
        row = Math.floor(H * where);
        at = where;
      }
    }
    const gx = rand() * GW;
    const gy = (row / H) * GH;
    const sx = size * 1.7;
    const sy = size;
    // This strength rotates the centre `turns` times during the simulation.
    const strength = turns * 2 * Math.PI * sx * sy * Math.sign(shear || 1);
    // Positive strength means anticlockwise rotation. The position comes from the
    // unrounded row, so it does not depend on the size of the run.
    if (marks) {
      named.push([(gx / GW - 0.5) * 2 * Math.PI, (0.5 - at) * Math.PI, (sy / GH) * Math.PI, Math.sign(strength)]);
    }
    addWhirl(steady, marks ? storms : null, gx, gy, sx, sy, strength);
  };
  for (let i = 0; i < b.ovals; i++) whirl(9 + 9 * rand(), 0.8 * b.spin, true);
  for (let i = 0; i < b.eddies; i++) whirl(3 + 4 * rand(), 0.5 * b.spin, rand() < 0.5);

  // Turbulence is sampled at a few moments and blended in between. It is
  // strongest where neighbouring jets shear against each other.
  const MOMENTS = 7;
  const rub = new Float32Array(GH);
  let strongest = 1e-6;
  for (let y = 0; y < GH; y++) {
    const row = Math.floor(((y + 0.5) / GH) * H);
    rub[y] = Math.abs(jet[Math.min(H - 1, row + 4)] - jet[Math.max(0, row - 4)]);
    strongest = Math.max(strongest, rub[y]);
  }
  // `swirl` is the eddy width in grid cells. Turbulence moves the gas only a fraction
  // of it: enough to fold belt edges into festoons, but not enough to erase the belts.
  const swirl = GW / (2 * Math.PI) / b.grain;
  const push = (b.turbulence * 0.35 * swirl * swirl) / 0.25;
  const flow = new Flow();
  const psi = new Float32Array(GW * GH);
  for (let m = 0; m < MOMENTS; m++) {
    // Offsetting the noise over time lets the eddies drift, grow and fade.
    const age = (m / (MOMENTS - 1)) * 0.45;
    for (let y = 0; y < GH; y++) {
      const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
      const s = Math.sin(lat);
      const c = Math.cos(lat);
      const here = push * (0.3 + 0.7 * (rub[y] / strongest)) * (1 - Math.pow(Math.abs(s), 6));
      for (let x = 0; x < GW; x++) {
        const lon = ((x + 0.5) / GW - 0.5) * 2 * Math.PI;
        // The noise is stretched along latitudes, as the jets would stretch it.
        const turbulent = noise.fbm(
          c * Math.sin(lon) * b.grain * 0.6 + age * 1.3,
          s * b.grain + 31.4 - age * 0.7,
          c * Math.cos(lon) * b.grain * 0.6 + age,
          3,
        );
        psi[y * GW + x] = steady[y * GW + x] + here * turbulent;
      }
    }
    flow.add(psi);
  }

  const STEPS = 72;
  const dt = 1 / STEPS;
  // Total jet displacement in coarse grid cells.
  const SHEAR = 26 * b.time;
  const sx = GW / W;
  const sy = GH / H;
  const out = new Uint8Array(W * H * 3);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let x = px * sx;
      let y = py * sy;
      // Trace backwards in time with a midpoint step for accuracy.
      for (let step = 0; step < STEPS; step++) {
        const moment = (1 - (step + 0.5) / STEPS) * (MOMENTS - 1);
        flow.at(x, y, moment);
        flow.at(x - flow.u * dt * 0.5, y - flow.v * dt * 0.5, moment);
        const row = Math.min(H - 1, Math.max(0, Math.round(y / sy)));
        x -= (flow.u + jet[row] * SHEAR) * dt;
        y = Math.min(GH - 1, Math.max(0, y - flow.v * dt));
      }

      // Sample the initial tracers (belts by latitude and fine streaks) at the origin.
      const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
      const lon = (x / GW - 0.5) * 2 * Math.PI;
      const s = Math.sin(lat);
      const c = Math.cos(lat);
      const ox = c * Math.sin(lon);
      const oz = c * Math.cos(lon);
      const ruffle = noise.fbm(ox * 3.1, s * 3.1, oz * 3.1, 4);
      const fine = noise.fbm(ox * 2.6 + 9.1, s * 44, oz * 2.6, 5);
      const belt = noise.fbm(7.7, (s + ruffle * 0.035) * b.belts, 3.3, 4) * 2.4 + fine * 0.55;
      const streak = noise.fbm(ox * 4.2 + 40, s * 23, oz * 4.2, 5);

      const here = py * W + px;
      const gi = Math.min(GH - 1, Math.floor(py * sy)) * GW + Math.min(GW - 1, Math.floor(px * sx));
      out[here * 3] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + belt * 0.62)));
      out[here * 3 + 1] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + streak * 1.1)));
      out[here * 3 + 2] = Math.round(255 * Math.min(1, storms[gi]));
    }
  }
  // The shader knows the jets as a formula (see `winds`), so the flow map holds only the rest, in
  // units of the fastest jet. The run turns a storm several times while the jets carry the clouds a
  // short way, which draws the storms well; shown at that pace they would spin like tops, so the
  // flow map slows them down. The turbulence keeps its pace.
  const fastest = (JET_STRENGTH + Math.abs(b.equator)) * b.wind * SHEAR;
  for (let i = 0; i < psi.length; i++) psi[i] -= steady[i] * (1 - STORM_PACE);
  const shown = new Flow();
  shown.add(psi);
  return { pixels: out, phase, storms: named, flow: shown.picture(fastest) };
}

interface Weather {
  name: string;
  seed: number;
  /** Number of lows on each storm track, and the latitude of the tracks in degrees. */
  lows: number;
  track: number;
  /** How often a low turns the air at its centre during the run. */
  turns: number;
  /** Strength of the turbulence between the weather systems. */
  turbulence: number;
  /** How far the fastest winds carry the clouds during the run, in grid cells. */
  drift: number;
}

const WEATHERS: Weather[] = [
  // Like Earth: a chain of lows on each storm track, a broken band of thunderstorms near the equator.
  { name: "weather-mild", seed: 211, lows: 6, track: 50, turns: 0.9, turbulence: 1, drift: 60 },
  // A restless sky: more and stronger lows, torn cloud bands.
  { name: "weather-stormy", seed: 223, lows: 8, track: 46, turns: 1.2, turbulence: 1.5, drift: 75 },
  // Few broad systems that turn slowly, with long quiet cloud bands.
  { name: "weather-calm", seed: 227, lows: 4, track: 56, turns: 0.65, turbulence: 0.7, drift: 45 },
];

/**
 * Simulates the cloud cover of a world with seas the way buildBands simulates a gas planet: moist
 * and dry air start out in belts by latitude, and trade winds, westerlies, a chain of lows on each
 * storm track, the highs of the subtropics and turbulence stir them. Around a low the moist air is
 * wound into a comma with a dry slot, and between the systems it is drawn out into fronts. Returns
 * the pixels and the winds at the end of the run.
 */
function buildWeather(w: Weather): { pixels: Uint8Array; flow: Uint8Array } {
  const rand = seededRandom(w.seed);
  const noise = new Noise(w.seed * 5 + 3);
  const DEG = Math.PI / 180;
  const cell = Math.PI / GH;

  // Wind along the latitudes, from about -0.45 to 1: positive blows east. Trade winds blow west near
  // the equator, westerlies east on the storm tracks, and weak easterlies circle the poles.
  const zonal = (lat: number) => {
    const a = Math.abs(lat) / DEG;
    return Math.exp(-(((a - w.track) / 17) ** 2)) - 0.45 * Math.exp(-((a / 16) ** 2)) - 0.15 * Math.exp(-(((a - 85) / 12) ** 2));
  };
  const jet = new Float32Array(GH);
  for (let y = 0; y < GH; y++) jet[y] = zonal((0.5 - (y + 0.5) / GH) * Math.PI);

  const steady = new Float32Array(GW * GH);
  const cores = new Float32Array(GW * GH);
  for (const side of [1, -1]) {
    // Lows follow each other along the track at uneven distances, as in a wave train. They turn
    // anticlockwise in the north and clockwise in the south.
    const start = rand();
    for (let k = 0; k < w.lows; k++) {
      const gx = ((k + start + (rand() - 0.5) * 0.5) / w.lows) * GW;
      const lat = side * (w.track + (rand() - 0.5) * 16) * DEG;
      const size = (0.085 + 0.07 * rand()) / cell;
      const turns = w.turns * (0.6 + 0.6 * rand());
      addWhirl(steady, cores, gx, (0.5 - lat / Math.PI) * GH, size * 1.3, size, side * turns * 2 * Math.PI * 1.3 * size * size);
    }
    // The highs of the subtropics are broad and slow and turn the other way.
    const highs = Math.max(2, Math.round(w.lows * 0.6));
    const shift = rand();
    for (let k = 0; k < highs; k++) {
      const gx = ((k + shift + (rand() - 0.5) * 0.4) / highs) * GW;
      const lat = side * (28 + (rand() - 0.5) * 8) * DEG;
      const size = (0.16 + 0.08 * rand()) / cell;
      const turns = 0.22 * (0.7 + 0.6 * rand());
      addWhirl(steady, null, gx, (0.5 - lat / Math.PI) * GH, size * 1.6, size, -side * turns * 2 * Math.PI * 1.6 * size * size);
    }
  }

  // Turbulence at a few moments, strongest on the storm tracks.
  const MOMENTS = 7;
  const GRAIN = 6;
  const swirl = GW / (2 * Math.PI) / GRAIN;
  const push = (w.turbulence * 0.24 * swirl * swirl) / 0.25;
  const flow = new Flow();
  const psi = new Float32Array(GW * GH);
  for (let m = 0; m < MOMENTS; m++) {
    const age = (m / (MOMENTS - 1)) * 0.45;
    for (let y = 0; y < GH; y++) {
      const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
      const s = Math.sin(lat);
      const c = Math.cos(lat);
      const here = push * (0.35 + 0.65 * Math.exp(-(((Math.abs(lat) / DEG - w.track) / 24) ** 2))) * (1 - Math.pow(Math.abs(s), 6));
      for (let x = 0; x < GW; x++) {
        const lon = ((x + 0.5) / GW - 0.5) * 2 * Math.PI;
        // Two layers only: finer turbulence would ruffle every front like ink in water.
        const turbulent = noise.fbm(c * Math.sin(lon) * GRAIN + age * 1.3, s * GRAIN + 31.4 - age * 0.7, c * Math.cos(lon) * GRAIN + age, 2);
        psi[y * GW + x] = steady[y * GW + x] + here * turbulent;
      }
    }
    flow.add(psi);
  }

  const smooth01 = (low: number, high: number, x: number) => smoothstep(low, high, x);
  // The air a place started with, by the unit direction (ox, s, oz) of that place: how much low
  // cloud, how much high cloud and how many thunderstorms it would bring.
  const air = (ox: number, s: number, oz: number, out: Float32Array) => {
    const at = (scale: number, shift: number, octaves: number) => noise.fbm(ox * scale + shift, s * scale, oz * scale, octaves);
    const lat = Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
    const away = Math.abs(lat);
    // The band of thunderstorms near the equator meanders and breaks up into clusters.
    const band = Math.exp(-(((lat - at(1.6, 11, 3) * 14) / 5.5) ** 2));
    const clusters = smooth01(-0.12, 0.3, at(6, 23, 4));
    // Moist and dry air masses lie side by side on the storm tracks; the winds wind them into fronts.
    const belt = Math.exp(-(((away - w.track - 2) / 19) ** 2));
    const moist = smooth01(-0.12, 0.2, at(3.2, 37, 4));
    // Low cloud decks lie over the cool seas of the subtropics.
    const decks = Math.exp(-(((away - 24) / 8) ** 2)) * smooth01(0.1, 0.38, at(2.4, 51, 3)) * 0.75;
    const polar = smooth01(62, 82, away) * (0.25 + 0.5 * smooth01(-0.2, 0.3, at(4, 71, 3)));
    // Fair-weather cloud is scattered over the trade-wind seas.
    const scattered = Math.exp(-(((away - 18) / 22) ** 2)) * smooth01(0.12, 0.45, at(5, 81, 3)) * 0.5;
    const fine = at(14, 3, 4) * 0.2;
    out[0] = Math.max(band * (0.2 + 0.75 * clusters), belt * (0.12 + 0.88 * moist), decks, scattered, polar) + fine;
    // High cloud streams out of the thunderstorms and rides the jets above the fronts.
    out[1] = band * smooth01(0.05, 0.45, at(6, 23, 4)) + belt * smooth01(0.0, 0.35, at(2.6, 91, 4)) * 0.8 + at(9, 61, 3) * 0.15;
    out[2] = band * clusters * clusters;
  };

  const STEPS = 72;
  const dt = 1 / STEPS;
  const sx = GW / W;
  const sy = GH / H;
  const out = new Uint8Array(W * H * 3);
  const start = new Float32Array(3);
  // Traces a pixel back to where its air came from. High up the jets blow harder and the weather
  // systems reach less far, so high cloud is drawn out into longer streaks.
  const origin = (px: number, py: number, jets: number, eddies: number) => {
    let x = px * sx;
    let y = py * sy;
    for (let step = 0; step < STEPS; step++) {
      const moment = (1 - (step + 0.5) / STEPS) * (MOMENTS - 1);
      flow.at(x, y, moment);
      flow.at(x - flow.u * eddies * dt * 0.5, y - flow.v * eddies * dt * 0.5, moment);
      const row = Math.min(GH - 1, Math.max(0, Math.round(y)));
      x -= (flow.u * eddies + jet[row] * w.drift * jets) * dt;
      y = Math.min(GH - 1, Math.max(0, y - flow.v * eddies * dt));
    }
    const lat = (0.5 - (y + 0.5) / GH) * Math.PI;
    const lon = (x / GW - 0.5) * 2 * Math.PI;
    const c = Math.cos(lat);
    air(c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon), start);
  };
  // Most air is fairly dry, so the amounts crowd near zero. Their roots spread over the whole range,
  // which leaves the shader room to show more or less of the cloud, by how cloudy a planet is.
  const byte = (value: number, root = 1) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, value)), root));
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const here = (py * W + px) * 3;
      origin(px, py, 1, 1);
      const low = start[0];
      const storms = start[2];
      origin(px, py, 1.8, 0.7);
      const gi = Math.min(GH - 1, Math.floor(py * sy)) * GW + Math.min(GW - 1, Math.floor(px * sx));
      out[here] = byte(low, 0.45);
      out[here + 1] = byte(start[1], 0.55);
      // Thunderstorms also sit in the cores of the lows.
      out[here + 2] = byte(Math.max(storms, cores[gi] * 0.6 * smooth01(0.1, 0.4, low)));
    }
  }
  // The flow map of a weather preset holds all its winds, in units of the fastest wind along the latitudes.
  return { pixels: out, flow: flow.picture(w.drift, (row) => jet[row] * w.drift) };
}

async function save(name: string, pixels: Uint8Array, separate: boolean): Promise<void> {
  const image = () => sharp(pixels, { raw: { width: W, height: H, channels: 3 } });
  // Lossy WebP mixes channels through its YUV conversion, so rivers would leak into
  // the heights as dotted ground. Terrain is therefore stored near-lossless; bands tolerate it.
  const format = separate
    ? ({ nearLossless: true, quality: 20, effort: 6 } as const)
    : ({ quality: 84, smartSubsample: true, effort: 6 } as const);
  // Large for the 3D model, small for list thumbnails.
  await image()
    .resize(2048, 1024, { kernel: "cubic" })
    .webp(format)
    .toFile(path.join(OUT, `${name}-lg.webp`));
  await image()
    .resize(512, 256)
    .webp(format)
    .toFile(path.join(OUT, `${name}-sm.webp`));
}

/** Area-weighted height quantiles in 5% steps, used by the app to choose a sea level. */
function levels(height: Uint8Array): number[] {
  const histogram = new Float64Array(256);
  let total = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      histogram[height[y * W + x]] += COS[y];
      total += COS[y];
    }
  }
  const out: number[] = [];
  let sum = 0;
  let value = 0;
  for (let step = 0; step <= 20; step++) {
    const target = (total * step) / 20;
    while (value < 255 && sum + histogram[value] < target) sum += histogram[value++];
    out.push(Math.round((value / 255) * 1000) / 1000);
  }
  return out;
}

/** Shape of presets.json. */
interface Meta {
  terrain: Record<string, { levels: number[] }>;
  bands: Record<string, Winds>;
  /** The names of the weather presets. */
  weather: string[];
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // A run of one kind keeps the existing metadata of the other kind.
  const known = await readFile(META, "utf8").then(
    (text) => JSON.parse(text) as Partial<Meta>,
    () => ({}) as Partial<Meta>,
  );
  const kept = <T,>(kind: typeof KIND, before: T | undefined, fresh: T): T => (KIND && KIND !== kind && before) || fresh;
  const meta: Meta = {
    terrain: kept("terrain", known.terrain, {}),
    bands: kept("bands", known.bands, {}),
    weather: kept("weather", known.weather, []),
  };
  const skips = (kind: typeof KIND, name: string) => (KIND && KIND !== kind) || (ONLY && !ONLY.includes(name));

  for (const t of TERRAINS) {
    if (skips("terrain", t.name)) continue;
    const started = Date.now();
    const h = buildTerrain(t);
    erode(h, t);
    if (t.rain > 0) smooth(h);
    const lines =
      t.cracks > 0 ? cracks(t, h) : t.rain > 0 ? rivers(h) : new Float32Array(W * H);
    const dents = craters(t);

    // Heights are stretched to the full byte range, ignoring the outer 0.2% so rare extremes do not compress it.
    const sorted = Float32Array.from(h).sort();
    const low = sorted[Math.floor(sorted.length * 0.002)];
    const high = sorted[Math.floor(sorted.length * 0.998)];
    const pixels = new Uint8Array(W * H * 3);
    const heights = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const value = Math.round(255 * Math.min(1, Math.max(0, (h[i] - low) / (high - low))));
      heights[i] = value;
      pixels[i * 3] = value;
      pixels[i * 3 + 1] = Math.round(255 * Math.min(1, Math.max(0, lines[i])));
      pixels[i * 3 + 2] = Math.round(255 * Math.min(1, Math.max(0, 0.5 + dents[i] * 0.5)));
    }
    await save(t.name, pixels, true);
    // The slopes come from the heights before they are rounded to bytes.
    const unit = Float32Array.from(h, (value) => (value - low) / (high - low));
    const level = Float32Array.from(dents, (value) => 0.5 + value * 0.5);
    await saveRelief(t.name, unit, level);
    meta.terrain[t.name] = { levels: levels(heights) };
    console.log(`${t.name}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

  for (const b of BANDS) {
    if (skips("bands", b.name)) continue;
    const started = Date.now();
    const { pixels, phase, storms, flow } = buildBands(b);
    await save(b.name, pixels, false);
    await saveFlow(path.join(OUT, `${b.name}-flow.webp`), flow);
    meta.bands[b.name] = winds(b, phase, storms);
    console.log(`${b.name}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

  for (const w of WEATHERS) {
    if (skips("weather", w.name)) continue;
    const started = Date.now();
    const { pixels, flow } = buildWeather(w);
    await save(w.name, pixels, false);
    await saveFlow(path.join(OUT, `${w.name}-flow.webp`), flow);
    meta.weather.push(w.name);
    console.log(`${w.name}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }

  // A partial run with PRESET_ONLY must not overwrite the metadata of the other presets.
  if (!ONLY) await writeFile(META, `${JSON.stringify(meta, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
