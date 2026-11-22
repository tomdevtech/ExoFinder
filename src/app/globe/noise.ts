/**
 * Precomputes the gradient noise of the planet shaders into a 3D texture. Computing the noise in the
 * shader made Direct3D (WebGL on Windows) take about five seconds to compile it; reading it from a
 * texture compiles about ten times faster and also draws faster.
 */

/** Lattice cells along each axis before the pattern repeats. */
export const NOISE_PERIOD = 8;
/** Texels per lattice cell along each axis. */
const STEPS = 8;
/** Texels along each axis of the texture. */
export const NOISE_SIZE = NOISE_PERIOD * STEPS;

let volume: Float32Array | undefined;

/** Returns one value per texel with x running fastest. It is computed on first use and then shared. */
export function noiseVolume(): Float32Array {
  volume ??= computeVolume();
  return volume;
}

/** GLSL that reads the noise texture. It needs `uniform highp sampler3D uNoise`. */
export const NOISE_GLSL = /* glsl */ `
// Gradient noise, roughly -0.7 to 0.7, which repeats every ${NOISE_PERIOD} units.
float gnoise(vec3 x) {
  return textureLod(uNoise, fract(x * ${(1 / NOISE_PERIOD).toFixed(6)}) + ${(0.5 / NOISE_SIZE).toFixed(6)}, 0.0).r;
}
`;

/** The same PCG integer hash the shaders use, in 32-bit unsigned arithmetic, so CPU and GPU agree. */
export function pcg3d(x: number, y: number, z: number): [number, number, number] {
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  y = (Math.imul(y, 1664525) + 1013904223) >>> 0;
  z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  return [x, y, z];
}

/** Random gradients at the lattice points, with each component from -1 to 1. */
function latticeGradients(): Float64Array {
  const gradients = new Float64Array(NOISE_PERIOD ** 3 * 3);
  for (let k = 0; k < NOISE_PERIOD; k++) {
    for (let j = 0; j < NOISE_PERIOD; j++) {
      for (let i = 0; i < NOISE_PERIOD; i++) {
        const hash = pcg3d(i + 65536, j + 65536, k + 65536);
        const at = ((k * NOISE_PERIOD + j) * NOISE_PERIOD + i) * 3;
        for (let c = 0; c < 3; c++) gradients[at + c] = (hash[c] / 4294967295) * 2 - 1;
      }
    }
  }
  return gradients;
}

/**
 * Gradient noise at a point, with the lattice repeating every NOISE_PERIOD units.
 * See https://iquilezles.org/articles/gradientnoise/.
 */
export function noiseAt(
  x: number,
  y: number,
  z: number,
  gradients: Float64Array = sharedGradients(),
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const wrap = (n: number) => ((n % NOISE_PERIOD) + NOISE_PERIOD) % NOISE_PERIOD;
  const corner = (dx: number, dy: number, dz: number) => {
    const at =
      ((wrap(iz + dz) * NOISE_PERIOD + wrap(iy + dy)) * NOISE_PERIOD + wrap(ix + dx)) * 3;
    return gradients[at] * (fx - dx) + gradients[at + 1] * (fy - dy) + gradients[at + 2] * (fz - dz);
  };
  const a = corner(0, 0, 0);
  const b = corner(1, 0, 0);
  const c = corner(0, 1, 0);
  const d = corner(1, 1, 0);
  const e = corner(0, 0, 1);
  const f = corner(1, 0, 1);
  const g = corner(0, 1, 1);
  const h = corner(1, 1, 1);

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const ux = fade(fx);
  const uy = fade(fy);
  const uz = fade(fz);
  const mix = (from: number, to: number, share: number) => from + (to - from) * share;
  return mix(
    mix(mix(a, b, ux), mix(c, d, ux), uy),
    mix(mix(e, f, ux), mix(g, h, ux), uy),
    uz,
  );
}

let gradientsCache: Float64Array | undefined;

function sharedGradients(): Float64Array {
  gradientsCache ??= latticeGradients();
  return gradientsCache;
}

/**
 * Computes the same values as calling noiseAt for every texel, but written for speed, because it runs
 * in the browser before the first planet can be drawn.
 */
function computeVolume(): Float32Array {
  const gradients = sharedGradients();
  const data = new Float32Array(NOISE_SIZE ** 3);
  const fade = new Float64Array(STEPS);
  for (let s = 0; s < STEPS; s++) {
    const t = s / STEPS;
    fade[s] = t * t * t * (t * (t * 6 - 15) + 10);
  }
  const corners = new Float64Array(8 * 3);
  for (let cz = 0; cz < NOISE_PERIOD; cz++) {
    for (let cy = 0; cy < NOISE_PERIOD; cy++) {
      for (let cx = 0; cx < NOISE_PERIOD; cx++) {
        for (let n = 0; n < 8; n++) {
          const gx = (cx + (n & 1)) % NOISE_PERIOD;
          const gy = (cy + ((n >> 1) & 1)) % NOISE_PERIOD;
          const gz = (cz + ((n >> 2) & 1)) % NOISE_PERIOD;
          const from = ((gz * NOISE_PERIOD + gy) * NOISE_PERIOD + gx) * 3;
          corners[n * 3] = gradients[from];
          corners[n * 3 + 1] = gradients[from + 1];
          corners[n * 3 + 2] = gradients[from + 2];
        }
        for (let sz = 0; sz < STEPS; sz++) {
          const fz = sz / STEPS;
          for (let sy = 0; sy < STEPS; sy++) {
            const fy = sy / STEPS;
            let at = ((cz * STEPS + sz) * NOISE_SIZE + cy * STEPS + sy) * NOISE_SIZE + cx * STEPS;
            for (let sx = 0; sx < STEPS; sx++) {
              const fx = sx / STEPS;
              let value = 0;
              for (let n = 0; n < 8; n++) {
                const ox = n & 1;
                const oy = (n >> 1) & 1;
                const oz = (n >> 2) & 1;
                const dot =
                  corners[n * 3] * (fx - ox) + corners[n * 3 + 1] * (fy - oy) + corners[n * 3 + 2] * (fz - oz);
                const wx = ox ? fade[sx] : 1 - fade[sx];
                const wy = oy ? fade[sy] : 1 - fade[sy];
                const wz = oz ? fade[sz] : 1 - fade[sz];
                value += wx * wy * wz * dot;
              }
              data[at++] = value;
            }
          }
        }
      }
    }
  }
  return data;
}
