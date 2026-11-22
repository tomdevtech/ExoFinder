import { seededRandom, smoothstep } from "@/shared/math";
import { BULGE_WIDTH, GALACTIC_CENTRE, GALAXY_EDGE, GALAXY_PICTURE_WIDTH } from "./galaxy";

/**
 * Gives the galaxy depth for the distant view. The flat artist's impression is
 * turned into light clouds, dust clouds and star clusters at plausible heights.
 * Lengths are parsecs in map coordinates (galaxy.ts).
 */

/**
 * The vertical exaggeration of the thin layer of arms, gas, young stars and dust. At its
 * true ratio of about 100:1 the galaxy would look as thin as paper from the side.
 */
export const THIN = 1.6;

/** Each cloud is eight floats: x, y, z, linear red, green, blue, radius in parsecs and strength. */
export const CLOUD_STRIDE = 8;

export interface GalaxyClouds {
  light: Float32Array;
  /** The colour of dust clouds is unused, and their strength is their opacity. */
  dust: Float32Array;
  /** Clusters are drawn as point stars, seven floats each as in starfield.ts. */
  clusters: Float32Array;
}

export const LIGHT_CLOUDS = 45_000;
export const DUST_CLOUDS = 16_000;
export const CLUSTERS = 16_000;
/** Caps how much extra weight a pixel brighter than its surroundings gets, which favours the arms. */
const ARM_CONTRAST = 3;
export const HALO_CLOUDS = 450;
export const BULGE_CLOUDS = 3_000;
/** The extra light of the bulge as a fraction of the picture's total light. */
const BULGE_LIGHT = 0.3;
/** The bulge's radial and vertical semi-axes in parsecs. */
const BULGE_SIZE: [number, number] = [4500, 3700];

/** Draws a standard normal sample with the Box-Muller method. */
function bell(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand());
}

/** Returns the map position of a pixel centre, with rows counted from the top. */
function place(column: number, row: number, size: number): [number, number] {
  // In the picture the galactic centre is up and galactic longitude 90 degrees is to the left.
  const x = GALACTIC_CENTRE[0] + (0.5 - (row + 0.5) / size) * GALAXY_PICTURE_WIDTH;
  const y = GALACTIC_CENTRE[1] + (0.5 - (column + 0.5) / size) * GALAXY_PICTURE_WIDTH;
  return [x, y];
}

/**
 * Builds the clouds from a `size` × `size` picture in linear RGB, stored row by row
 * from the top. The same picture always gives the same clouds.
 */
export function galaxyClouds(rgb: Float32Array, size: number): GalaxyClouds {
  const rand = seededRandom(271828);
  const pixel = GALAXY_PICTURE_WIDTH / size;
  const brightness = new Float32Array(size * size);
  for (let i = 0; i < brightness.length; i++) {
    brightness[i] = 0.3 * rgb[i * 3] + 0.6 * rgb[i * 3 + 1] + 0.1 * rgb[i * 3 + 2];
  }

  // Pixels are picked in proportion to their brightness, with extra weight where
  // they are brighter than their surroundings. This puts the clouds into the arms,
  // while the glow shader already draws the smooth light between them.
  const wider = blur(brightness, size, Math.max(2, Math.round(size / 28)));
  const cumulative = new Float64Array(brightness.length);
  let total = 0;
  for (let i = 0; i < brightness.length; i++) {
    const arm = Math.min(ARM_CONTRAST, brightness[i] / Math.max(wider[i], 1e-6));
    total += brightness[i] * arm * arm;
    cumulative[i] = total;
  }
  const pick = () => {
    const target = rand() * total;
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    return low;
  };

  const light = new Float32Array((LIGHT_CLOUDS + HALO_CLOUDS + BULGE_CLOUDS) * CLOUD_STRIDE);
  // Brightness is already expressed by how often a pixel is picked, so every cloud
  // carries an equal share of the light and only the pixel's colour.
  const share = 1 / LIGHT_CLOUDS;
  for (let n = 0; n < LIGHT_CLOUDS; n++) {
    const index = pick();
    const row = Math.floor(index / size);
    const column = index - row * size;
    const [px, py] = place(column, row, size);
    const [red, green, blue] = [rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2]];
    const sum = Math.max(red + green + blue, 1e-6);
    // Blue and pink light comes from young stars and gas, which stay close to the
    // plane. Yellow light comes from old stars, which spread further out.
    const young = Math.min(1, Math.max(0, (blue - red) / sum * 4 + 0.5 + (red - green) / sum * 1.5));
    const x = px + (rand() - 0.5) * pixel;
    const y = py + (rand() - 0.5) * pixel;
    const fromCentre = Math.hypot(x - GALACTIC_CENTRE[0], y - GALACTIC_CENTRE[1]);
    const bulge = Math.exp(-((fromCentre / (BULGE_WIDTH * 1.2)) ** 2));
    // The arms stay in the thin layer, because thicker arms smear into vertical
    // streaks when seen at an angle. The galaxy's thickness comes from the glow
    // shader, the bulge and the halo instead.
    const disc = (60 + 220 * (1 - young)) * THIN;
    // The disc flares out slightly towards its edge.
    const height = disc * (1 + 0.8 * smoothstep(9000, GALAXY_EDGE, fromCentre)) + 400 * bulge * THIN;
    const z = bell(rand) * height;
    // The radii are large because small clouds make the galaxy look grainy from afar.
    const radius = (young > 0.5 ? 90 : 200) + 200 * rand() + 500 * bulge;
    light.set([x, y, z, red / sum, green / sum, blue / sum, radius, share], n * CLOUD_STRIDE);
  }

  // The stellar halo uses few but wide clouds. They are drawn into the
  // low-resolution glow target, so their size costs little.
  for (let n = 0; n < HALO_CLOUDS; n++) {
    const r = 1200 + 16000 * rand() ** 1.8;
    const cos = 2 * rand() - 1;
    const sin = Math.sqrt(1 - cos * cos);
    const angle = 2 * Math.PI * rand();
    light.set(
      [
        GALACTIC_CENTRE[0] + r * sin * Math.cos(angle),
        GALACTIC_CENTRE[1] + r * sin * Math.sin(angle),
        // The halo is slightly oblate.
        r * cos * 0.65,
        0.38,
        0.34,
        0.28,
        2500 + 2500 * rand(),
        share * 4,
      ],
      (LIGHT_CLOUDS + n) * CLOUD_STRIDE,
    );
  }

  // The bulge is a flattened ellipsoid of old stars that is densest at its centre.
  for (let n = 0; n < BULGE_CLOUDS; n++) {
    // The radius follows a Plummer profile in units of BULGE_SIZE and is capped
    // at 1.6, because the profile's long tail would scatter clouds far outside.
    const r = Math.min(1.6, 0.5 / Math.sqrt(Math.max(rand(), 1e-6) ** (-2 / 3) - 1));
    const cos = 2 * rand() - 1;
    const sin = Math.sqrt(1 - cos * cos);
    const angle = 2 * Math.PI * rand();
    light.set(
      [
        GALACTIC_CENTRE[0] + r * BULGE_SIZE[0] * sin * Math.cos(angle),
        GALACTIC_CENTRE[1] + r * BULGE_SIZE[0] * sin * Math.sin(angle),
        r * BULGE_SIZE[1] * cos,
        0.42,
        0.34,
        0.24,
        // The clouds are wide so that they merge into one body instead of separate puffs.
        700 + 900 * rand(),
        BULGE_LIGHT / BULGE_CLOUDS,
      ],
      (LIGHT_CLOUDS + HALO_CLOUDS + n) * CLOUD_STRIDE,
    );
  }

  // Dust clouds go where the picture is darker than its surroundings.
  const blurred = blur(brightness, size, Math.max(2, Math.round(size / 64)));
  const darkness = new Float32Array(brightness.length);
  let dark = 0;
  for (let i = 0; i < brightness.length; i++) {
    const row = Math.floor(i / size);
    const [px, py] = place(i - row * size, row, size);
    const fromCentre = Math.hypot(px - GALACTIC_CENTRE[0], py - GALACTIC_CENTRE[1]);
    // There is no dust near the bulge, where the bright bar makes everything beside
    // it look dark, and none beyond the edge of the disc.
    const inDisc = smoothstep(2600, 4500, fromCentre) * (1 - smoothstep(GALAXY_EDGE * 0.8, GALAXY_EDGE, fromCentre));
    // Real dust lanes still let some light through, so almost black pixels are
    // treated as empty space rather than dust.
    const lit = smoothstep(0.03, 0.12, brightness[i] / Math.max(blurred[i], 1e-6));
    // Squaring concentrates the dust in clear lanes instead of every faint shadow.
    darkness[i] = Math.max(0, blurred[i] - brightness[i]) ** 2 * inDisc * lit;
    dark += darkness[i];
  }
  const dust = new Float32Array(DUST_CLOUDS * CLOUD_STRIDE);
  let cumulativeDark = 0;
  const darkCumulative = new Float64Array(darkness.length);
  for (let i = 0; i < darkness.length; i++) {
    cumulativeDark += darkness[i];
    darkCumulative[i] = cumulativeDark;
  }
  for (let n = 0; n < DUST_CLOUDS && dark > 0; n++) {
    const target = rand() * dark;
    let low = 0;
    let high = darkCumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (darkCumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    const row = Math.floor(low / size);
    const [px, py] = place(low - row * size, row, size);
    dust.set(
      [
        px + (rand() - 0.5) * pixel,
        py + (rand() - 0.5) * pixel,
        bell(rand) * 55 * THIN,
        0,
        0,
        0,
        // The clouds are wide and faint so that many overlap into smooth lanes.
        100 + 140 * rand(),
        0.5 + 0.5 * rand(),
      ],
      n * CLOUD_STRIDE,
    );
  }

  // Star clusters are picked like the light clouds, so from afar the arms look like
  // fields of points rather than paint. Young, blue clusters are brighter and stay
  // closer to the plane.
  const clusters = new Float32Array(CLUSTERS * 7);
  for (let n = 0; n < CLUSTERS; n++) {
    const index = pick();
    const row = Math.floor(index / size);
    const column = index - row * size;
    const [px, py] = place(column, row, size);
    const [red, green, blue] = [rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2]];
    const sum = Math.max(red + green + blue, 1e-6);
    const young = Math.min(1, Math.max(0, (blue - red) / sum * 4 + 0.5));
    const top = Math.max(red, green, blue, 1e-6);
    clusters.set(
      [
        px + (rand() - 0.5) * pixel,
        py + (rand() - 0.5) * pixel,
        bell(rand) * (60 + 400 * (1 - young)) * THIN,
        // The colour is pushed towards white, because single stars look less saturated than a haze.
        0.55 + 0.45 * (red / top),
        0.55 + 0.45 * (green / top),
        0.55 + 0.45 * (blue / top),
        // Most clusters shine like tens of thousands of suns, and a few far brighter.
        (20_000 + 400_000 * rand() ** 4) * (0.4 + 0.6 * young),
      ],
      n * 7,
    );
  }
  return { light, dust, clusters };
}

/** Applies a separable box blur with a radius of `reach` pixels. */
function blur(values: Float32Array, size: number, reach: number): Float32Array {
  const across = new Float32Array(values.length);
  const out = new Float32Array(values.length);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let sum = 0;
      let count = 0;
      for (let d = -reach; d <= reach; d++) {
        const c = column + d;
        if (c < 0 || c >= size) continue;
        sum += values[row * size + c];
        count++;
      }
      across[row * size + column] = sum / count;
    }
  }
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      let sum = 0;
      let count = 0;
      for (let d = -reach; d <= reach; d++) {
        const r = row + d;
        if (r < 0 || r >= size) continue;
        sum += across[r * size + column];
        count++;
      }
      out[row * size + column] = sum / count;
    }
  }
  return out;
}
