/**
 * Winds on a sphere as the preset generator and the script for Earth's clouds use them: stream
 * functions on a grid, the winds that follow from them, and the flow maps the planet shader reads
 * (flowAt in src/app/globe/surface.glsl.ts).
 */
import sharp from "sharp";

/** The grid of the stream functions, which is coarser than the maps and the same for a run of any size. */
export const GW = 1024;
export const GH = 512;

/**
 * The fastest wind a flow map can hold, as a multiple of its unit speed. Vortices turn several times
 * faster than the jets blow. It must match FLOW_LIMIT in surface.glsl.ts.
 */
export const FLOW_LIMIT = 4;

/**
 * Adds a vortex to a stream function. It is an ellipse `sx` by `sy` grid cells around (`gx`, `gy`);
 * a positive strength turns anticlockwise. With `marks`, the vortex is also drawn into that grid.
 */
export function addWhirl(psi: Float32Array, marks: Float32Array | null, gx: number, gy: number, sx: number, sy: number, strength: number): void {
  const reachX = Math.ceil(sx * 3.2);
  const reachY = Math.ceil(sy * 3.2);
  for (let dy = -reachY; dy <= reachY; dy++) {
    const yy = Math.round(gy) + dy;
    if (yy < 0 || yy >= GH) continue;
    for (let dx = -reachX; dx <= reachX; dx++) {
      const xx = (((Math.round(gx) + dx) % GW) + GW) % GW;
      const r2 = (dx / sx) ** 2 + (dy / sy) ** 2;
      // The falloff reaches exactly zero at the edge, because a step there would show as a scratch.
      if (r2 >= 9) continue;
      psi[yy * GW + xx] += strength * (Math.exp(-r2 * 0.5) - Math.exp(-4.5)) * (1 - r2 / 9);
      if (marks) marks[yy * GW + xx] = Math.max(marks[yy * GW + xx], Math.exp(-r2 * 0.9));
    }
  }
}

/**
 * The winds of stream functions at a few moments, blended in between. Winds from a stream function
 * are divergence-free, so what they carry neither piles up nor thins out.
 */
export class Flow {
  private readonly east: Float32Array[] = [];
  private readonly south: Float32Array[] = [];
  /** The wind `at` last returned, in grid cells per run: `u` blows east and `v` south. */
  u = 0;
  v = 0;

  /** Adds the winds of a stream function as the next moment. */
  add(psi: Float32Array): void {
    const u = new Float32Array(GW * GH);
    const v = new Float32Array(GW * GH);
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        u[i] = -(psi[i + GW] - psi[i - GW]) / 2;
        v[i] = (psi[y * GW + ((x + 1) % GW)] - psi[y * GW + ((x + GW - 1) % GW)]) / 2;
      }
    }
    this.east.push(u);
    this.south.push(v);
  }

  /** Writes the wind at a grid position and a moment (0 is the first one added) into `u` and `v`, without allocating. */
  at(x: number, y: number, moment: number): void {
    const m0 = Math.min(this.east.length - 2, Math.floor(moment));
    const fm = moment - m0;
    const yc = Math.min(GH - 1.001, Math.max(0, y));
    const yi = Math.floor(yc);
    const fy = yc - yi;
    const xi = Math.floor(x);
    const fx = x - xi;
    const x0 = ((xi % GW) + GW) % GW;
    const i00 = yi * GW + x0;
    const i10 = yi * GW + ((x0 + 1) % GW);
    const i01 = i00 + GW;
    const i11 = i10 + GW;
    const w00 = (1 - fx) * (1 - fy);
    const w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy;
    const w11 = fx * fy;
    const u0 = this.east[m0];
    const u1 = this.east[m0 + 1];
    const v0 = this.south[m0];
    const v1 = this.south[m0 + 1];
    this.u =
      (u0[i00] * w00 + u0[i10] * w10 + u0[i01] * w01 + u0[i11] * w11) * (1 - fm) +
      (u1[i00] * w00 + u1[i10] * w10 + u1[i01] * w01 + u1[i11] * w11) * fm;
    this.v =
      (v0[i00] * w00 + v0[i10] * w10 + v0[i01] * w01 + v0[i11] * w11) * (1 - fm) +
      (v1[i00] * w00 + v1[i10] * w10 + v1[i01] * w01 + v1[i11] * w11) * fm;
  }

  /**
   * The winds at the last moment as a picture for the shader, at half the grid's size: east in red
   * and north in green, with `extraEast` added per grid row. A speed of `unit` is stored as
   * 1 / FLOW_LIMIT of the range.
   */
  picture(unit: number, extraEast: (row: number) => number = () => 0): Uint8Array {
    const u = this.east[this.east.length - 1];
    const v = this.south[this.south.length - 1];
    const out = new Uint8Array((GW / 2) * (GH / 2) * 3).fill(128);
    const store = (speed: number) => Math.round(127.5 + 127.5 * Math.min(1, Math.max(-1, speed / (unit * FLOW_LIMIT))));
    for (let y = 0; y < GH / 2; y++) {
      for (let x = 0; x < GW / 2; x++) {
        let east = 0;
        let south = 0;
        for (const dy of [0, 1]) {
          for (const dx of [0, 1]) {
            const i = (y * 2 + dy) * GW + x * 2 + dx;
            east += (u[i] + extraEast(y * 2 + dy)) / 4;
            south += v[i] / 4;
          }
        }
        const at = (y * (GW / 2) + x) * 3;
        out[at] = store(east);
        out[at + 1] = store(-south);
      }
    }
    return out;
  }
}

/** Writes a flow map (see Flow.picture) to `file`. It is stored without loss, because it is small and holds numbers. */
export async function saveFlow(file: string, picture: Uint8Array): Promise<void> {
  await sharp(picture, { raw: { width: GW / 2, height: GH / 2, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toFile(file);
}
