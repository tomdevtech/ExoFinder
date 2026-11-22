/**
 * Turns the published global mosaics of moons and dwarf planets into the textures of the 3D model.
 *
 * The mosaics differ in where they put longitude 0, in colour and in exposure, and some leave the parts
 * no spacecraft saw black. Every texture leaves here with longitude 0 in the middle, colours a camera
 * could plausibly see, a brightness that follows the body's albedo, and unseen parts filled with a
 * smooth continuation of the neighbouring tones. Only a recipe with `inventUnseen` adds made-up
 * terrain to them, borrowed from the imaged parts, and the body's page then says so.
 */

import { hashText, seededRandom, smoothstep } from "@/shared/math";

/** An image as 8-bit RGB, row by row from the north. */
export interface Picture {
  width: number;
  height: number;
  rgb: Uint8Array;
}

export type Colouring =
  /** A colour mosaic, whose saturation is scaled (below 1 for exaggerated or false colours). */
  | { kind: "colour"; saturation: number }
  /** A greyscale mosaic, tinted from the colour of its dark ground to the colour of its bright ground. */
  | { kind: "grey"; dark: string; bright: string }
  /** Titan: its haze in the colour given, with the near-infrared surface showing through faintly. */
  | { kind: "haze"; color: string };

export interface MapRecipe {
  /** Whether the mosaic has longitude 180 in its middle and must be turned by half a turn. */
  centredOn180: boolean;
  colouring: Colouring;
  /** The body's visual albedo, which sets the average brightness of the texture. */
  albedo: number;
  /**
   * Gives the filled parts the craters and relief of the imaged ones (`inventTerrain`), for a body whose
   * unseen part is so large that a smooth fill looks like the globe was cut off.
   */
  inventUnseen?: true;
}

/** Pixels this dark in every channel are taken as "not imaged". */
const NO_DATA = 6;

/** Turns the picture about the axis by half a turn, which moves longitude 180 from the middle to the edges. */
export function halfTurn({ width, height, rgb }: Picture): Picture {
  const out = new Uint8Array(rgb.length);
  const half = Math.floor(width / 2);
  for (let y = 0; y < height; y++) {
    const row = y * width * 3;
    out.set(rgb.subarray(row + half * 3, row + width * 3), row);
    out.set(rgb.subarray(row, row + half * 3), row + (width - half) * 3);
  }
  return { width, height, rgb: out };
}

/**
 * Marks the pixels that were never imaged, grown by `margin` pixels so that the dark fringe the scaling
 * leaves along their edge is replaced as well.
 */
export function findGaps({ width, height, rgb }: Picture, margin = 2): Uint8Array {
  let mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    if (rgb[i * 3] <= NO_DATA && rgb[i * 3 + 1] <= NO_DATA && rgb[i * 3 + 2] <= NO_DATA) mask[i] = 1;
  }
  for (let step = 0; step < margin; step++) {
    const grown = mask.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) continue;
        const left = (x + width - 1) % width;
        const right = (x + 1) % width;
        if (
          mask[y * width + left] ||
          mask[y * width + right] ||
          (y > 0 && mask[(y - 1) * width + x]) ||
          (y < height - 1 && mask[(y + 1) * width + x])
        ) {
          grown[y * width + x] = 1;
        }
      }
    }
    mask = grown;
  }
  return mask;
}

/** The colour of a "#rrggbb" string, from 0 to 1. */
function color(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The average brightness (0 to 1, as stored) a texture gets for an albedo. Photographs are exposed for
 * their subject, so the real range from coal-dark Ceres to snow-white Enceladus is compressed; the order
 * stays.
 */
export function targetBrightness(albedo: number): number {
  return Math.min(0.82, 0.28 + 0.5 * Math.sqrt(albedo));
}

/** Applies the colouring and the brightness of `recipe` to the imaged pixels; gaps are left as they are. */
export function colourise(picture: Picture, gaps: Uint8Array, recipe: MapRecipe): Picture {
  const { width, height, rgb } = picture;
  const count = width * height;
  const out = new Float32Array(count * 3);
  const colouring = recipe.colouring;
  const dark = colouring.kind === "grey" ? color(colouring.dark) : [0, 0, 0];
  const bright = colouring.kind === "grey" ? color(colouring.bright) : [0, 0, 0];
  const haze = colouring.kind === "haze" ? color(colouring.color) : [0, 0, 0];

  // The mean grey of the imaged part, around which Titan's surface varies.
  let greySum = 0;
  let imaged = 0;
  for (let i = 0; i < count; i++) {
    if (gaps[i]) continue;
    greySum += luminance(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) / 255;
    imaged++;
  }
  const meanGrey = imaged > 0 ? greySum / imaged : 0.5;

  for (let i = 0; i < count; i++) {
    if (gaps[i]) continue;
    const r = rgb[i * 3] / 255;
    const g = rgb[i * 3 + 1] / 255;
    const b = rgb[i * 3 + 2] / 255;
    const grey = luminance(r, g, b);
    let pixel: [number, number, number];
    if (colouring.kind === "colour") {
      const s = colouring.saturation;
      pixel = [grey + (r - grey) * s, grey + (g - grey) * s, grey + (b - grey) * s];
    } else if (colouring.kind === "grey") {
      // The tint runs from the dark to the bright ground, scaled so that it keeps the grey's brightness.
      const tint = [0, 1, 2].map((c) => dark[c] + (bright[c] - dark[c]) * grey);
      const tintLight = luminance(tint[0], tint[1], tint[2]) || 1;
      pixel = [tint[0] * (grey / tintLight), tint[1] * (grey / tintLight), tint[2] * (grey / tintLight)];
    } else {
      // Through the haze the bright and dark lands only change the light by a few per cent.
      const shade = 1 + 0.15 * (grey - meanGrey);
      pixel = [haze[0] * shade, haze[1] * shade, haze[2] * shade];
    }
    out.set(pixel, i * 3);
  }

  // Bends the tones of the imaged part with a power curve until their mean is the brightness the albedo
  // calls for. Unlike a plain gain this never clips the bright ground to white.
  const histogram = new Float64Array(256);
  for (let i = 0; i < count; i++) {
    if (gaps[i]) continue;
    const light = luminance(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]);
    histogram[Math.min(255, Math.max(0, Math.round(light * 255)))]++;
  }
  const meanAt = (power: number) => {
    let sum = 0;
    for (let level = 1; level < 256; level++) sum += histogram[level] * (level / 255) ** power;
    return sum / (imaged || 1);
  };
  let power = 1;
  if (colouring.kind !== "haze" && imaged > 0) {
    const target = targetBrightness(recipe.albedo);
    // The mean falls as the power rises, so bisection finds it.
    let low = 0.1;
    let high = 10;
    for (let step = 0; step < 40; step++) {
      power = Math.sqrt(low * high);
      if (meanAt(power) > target) low = power;
      else high = power;
    }
  }
  const result = new Uint8Array(rgb.length);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) {
      result[i * 3 + c] = gaps[i] ? rgb[i * 3 + c] : Math.round(Math.min(1, Math.max(0, out[i * 3 + c])) ** power * 255);
    }
  }
  return { width, height, rgb: result };
}

/**
 * Fills the gaps with a smooth continuation of the surrounding tones. The picture is averaged into coarse
 * cells, empty cells take the mean of their neighbours until the values settle (wrapping round in
 * longitude), and gap pixels read the result with bilinear interpolation.
 */
export function fillGaps(picture: Picture, gaps: Uint8Array, cell = 8): Picture {
  const { width, height, rgb } = picture;
  const cw = Math.ceil(width / cell);
  const ch = Math.ceil(height / cell);
  let grid = new Float32Array(cw * ch * 3);
  const known = new Uint8Array(cw * ch);
  const weight = new Float32Array(cw * ch);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (gaps[i]) continue;
      const c = Math.floor(y / cell) * cw + Math.floor(x / cell);
      for (let k = 0; k < 3; k++) grid[c * 3 + k] += rgb[i * 3 + k];
      weight[c]++;
    }
  }
  let any = false;
  let mean = [0, 0, 0];
  let total = 0;
  for (let c = 0; c < cw * ch; c++) {
    if (weight[c] === 0) continue;
    known[c] = 1;
    any = true;
    for (let k = 0; k < 3; k++) {
      mean[k] += grid[c * 3 + k];
      grid[c * 3 + k] /= weight[c];
    }
    total += weight[c];
  }
  if (!any) return picture;
  mean = mean.map((value) => value / total);
  for (let c = 0; c < cw * ch; c++) if (!known[c]) grid.set(mean, c * 3);

  // The edge of a mosaic is where the images met the terminator: bright sunlit slopes and long shadows,
  // which the relaxation below would draw out into streaks. The grid only feeds the fill, so the imaged
  // cells are smoothed first, each weighted by how many imaged pixels it holds; the fill then continues
  // the broad tones and not single spots.
  for (let round = 0; round < 40; round++) {
    const next = grid.slice();
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const c = y * cw + x;
        if (!known[c]) continue;
        const around = [c, y * cw + ((x + cw - 1) % cw), y * cw + ((x + 1) % cw)];
        if (y > 0) around.push(c - cw);
        if (y < ch - 1) around.push(c + cw);
        let sum = 0;
        for (const n of around) if (known[n]) sum += weight[n];
        for (let k = 0; k < 3; k++) {
          let value = 0;
          for (const n of around) if (known[n]) value += grid[n * 3 + k] * weight[n];
          next[c * 3 + k] = value / sum;
        }
      }
    }
    grid = next;
  }

  // Relaxes the unknown cells towards the mean of their neighbours. A few hundred rounds reach far enough
  // for a gap as large as a hemisphere at this cell size.
  for (let round = 0; round < 600; round++) {
    const next = grid.slice();
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const c = y * cw + x;
        if (known[c]) continue;
        const neighbours = [y * cw + ((x + cw - 1) % cw), y * cw + ((x + 1) % cw)];
        if (y > 0) neighbours.push(c - cw);
        if (y < ch - 1) neighbours.push(c + cw);
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (const n of neighbours) sum += grid[n * 3 + k];
          next[c * 3 + k] = sum / neighbours.length;
        }
      }
    }
    grid = next;
  }

  const out = rgb.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!gaps[i]) continue;
      const gx = (x + 0.5) / cell - 0.5;
      const gy = Math.min(Math.max((y + 0.5) / cell - 0.5, 0), ch - 1);
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const at = (cx: number, cy: number, k: number) => grid[(Math.min(cy, ch - 1) * cw + ((cx % cw) + cw) % cw) * 3 + k];
      for (let k = 0; k < 3; k++) {
        const top = at(x0, y0, k) * (1 - fx) + at(x0 + 1, y0, k) * fx;
        const bottom = at(x0, y0 + 1, k) * (1 - fx) + at(x0 + 1, y0 + 1, k) * fx;
        out[i * 3 + k] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return { width, height, rgb: out };
}

/** Blurs a field of `width` × `height` with a box of `radius` three times, which is close to a Gaussian. Wraps in longitude. */
function blur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  let field = values;
  const size = 2 * radius + 1;
  for (let pass = 0; pass < 3; pass++) {
    const across = new Float32Array(field.length);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = 0;
      for (let dx = -radius; dx <= radius; dx++) sum += field[row + ((dx % width) + width) % width];
      for (let x = 0; x < width; x++) {
        across[row + x] = sum / size;
        sum += field[row + ((x + radius + 1) % width)] - field[row + ((x - radius + width) % width)];
      }
    }
    const down = new Float32Array(field.length);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let dy = -radius; dy <= radius; dy++) sum += across[Math.min(height - 1, Math.max(0, y + dy)) * width + x];
        down[y * width + x] = sum / size;
      }
    }
    field = down;
  }
  return field;
}

/** How far, in pixels, each pixel of `mask` lies from the nearest pixel outside it, counted up to `limit`. Outside pixels are 0. */
function distanceOut(mask: Uint8Array, width: number, height: number, limit: number): Uint16Array {
  const distance = new Uint16Array(mask.length).fill(limit);
  let front: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      distance[i] = 0;
      front.push(i);
    }
  }
  for (let step = 1; step < limit && front.length > 0; step++) {
    const next: number[] = [];
    for (const i of front) {
      const x = i % width;
      const y = (i - x) / width;
      const around = [y * width + ((x + 1) % width), y * width + ((x + width - 1) % width)];
      if (y > 0) around.push(i - width);
      if (y < height - 1) around.push(i + width);
      for (const n of around) {
        if (distance[n] > step) {
          distance[n] = step;
          next.push(n);
        }
      }
    }
    front = next;
  }
  return distance;
}

/** Marks the pixels of the gaps that hold more than `least` pixels each, wrapping round in longitude. */
function largeGaps(gaps: Uint8Array, width: number, height: number, least: number): Uint8Array {
  const large = new Uint8Array(gaps.length);
  const seen = new Uint8Array(gaps.length);
  for (let first = 0; first < gaps.length; first++) {
    if (!gaps[first] || seen[first]) continue;
    const members = [first];
    seen[first] = 1;
    for (let next = 0; next < members.length; next++) {
      const i = members[next];
      const x = i % width;
      const y = (i - x) / width;
      const around = [y * width + ((x + 1) % width), y * width + ((x + width - 1) % width)];
      if (y > 0) around.push(i - width);
      if (y < height - 1) around.push(i + width);
      for (const n of around) {
        if (gaps[n] && !seen[n]) {
          seen[n] = 1;
          members.push(n);
        }
      }
    }
    if (members.length > least) for (const i of members) large[i] = 1;
  }
  return large;
}

/** Spacing of the lattice the borrowed pieces hang on, in radii of the body: about 7 degrees. */
const PIECE = 0.12;

/**
 * Gives the filled parts the relief of the imaged ones: craters, ridges and the grain of the ground. The
 * picture is split into its broad tones (a blur of about three degrees, the same on both sides of the
 * edge of the imaged ground, so no step shows there) and the relief above them. The relief of the
 * unseen part is borrowed from the sharpest imaged parts, a piece for every point of a lattice on the
 * sphere, each turned its own way, measured on the ground so it is not stretched towards the pole, and
 * blended with its neighbours so no piece shows its edge. The choice depends only on the position on
 * the body, so every size of the texture would get the same terrain.
 *
 * Two things keep the seam out of sight. Over a band of some six degrees inside the imaged ground, the
 * real relief gives way to the borrowed one gradually; at the edge itself only the borrowed one is left,
 * as the real one holds the step from the mosaic's border there. And next to coarse images, the borrowed relief
 * starts as soft as they are and grows to its full strength over some 30 degrees further south.
 */
export function inventTerrain(picture: Picture, gaps: Uint8Array): Picture {
  const { width, height, rgb } = picture;
  const count = width * height;
  const light = new Float32Array(count);
  for (let i = 0; i < count; i++) light[i] = luminance(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  const broad = blur(light, width, height, Math.max(1, Math.round(width / 120)));
  const relief = new Float32Array(count);
  for (let i = 0; i < count; i++) relief[i] = light[i] - broad[i];
  // Sharpness is judged by the finest grain alone. Coarse images of the far side have large blotches
  // in `relief` too, and pieces of them looked smeared.
  const grain = blur(light, width, height, 1);

  // Sources: the cells of a fixed grid of 64 × 32 that were fully imaged, away from the poles, and in the
  // sharpest third of those, where the spacecraft came close.
  const columns = 64;
  const rows = 32;
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const cells: { u: number; v: number; sharpness: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const latitude = 90 - ((row + 0.5) / rows) * 180;
    if (Math.abs(latitude) > 60) continue;
    for (let column = 0; column < columns; column++) {
      let sharpness = 0;
      let pixels = 0;
      let seen = true;
      for (let y = Math.floor(row * cellHeight); y < Math.floor((row + 1) * cellHeight) && seen; y++) {
        for (let x = Math.floor(column * cellWidth); x < Math.floor((column + 1) * cellWidth); x++) {
          const i = y * width + x;
          if (gaps[i]) {
            seen = false;
            break;
          }
          sharpness += (light[i] - grain[i]) ** 2;
          pixels++;
        }
      }
      if (seen && pixels > 0) cells.push({ u: (column + 0.5) / columns, v: (row + 0.5) / rows, sharpness: sharpness / pixels });
    }
  }
  if (cells.length === 0) return picture;
  const ranked = [...cells].sort((a, b) => b.sharpness - a.sharpness);
  const sources = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3)));
  const sourceGrain = Math.sqrt(sources.reduce((sum, cell) => sum + cell.sharpness, 0) / sources.length) || 1;

  // Each lattice point borrows one source and turns it, always the same for the same point.
  const pieces = new Map<string, { longitude: number; latitude: number; cos: number; sin: number }>();
  const piece = (i: number, j: number, k: number) => {
    const key = `${i},${j},${k}`;
    let found = pieces.get(key);
    if (!found) {
      const random = seededRandom(hashText(key));
      const source = sources[Math.floor(random() * sources.length)];
      const turn = random() * 2 * Math.PI;
      found = { longitude: source.u * 2 * Math.PI, latitude: (0.5 - source.v) * Math.PI, cos: Math.cos(turn), sin: Math.sin(turn) };
      pieces.set(key, found);
    }
    return found;
  };
  const sample = (x: number, y: number) => {
    const fx = ((x % width) + width) % width;
    const fy = Math.min(height - 1, Math.max(0, y));
    const x0 = Math.floor(fx);
    const y0 = Math.min(height - 2, Math.floor(fy));
    const tx = fx - x0;
    const ty = fy - y0;
    const x1 = (x0 + 1) % width;
    if (gaps[y0 * width + x0] || gaps[(y0 + 1) * width + x1]) return null;
    const top = relief[y0 * width + x0] * (1 - tx) + relief[y0 * width + x1] * tx;
    const bottom = relief[(y0 + 1) * width + x0] * (1 - tx) + relief[(y0 + 1) * width + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  };
  /** The borrowed relief at a pixel, at the strength of the sharpest imaged parts. */
  const borrowed = (x: number, y: number) => {
    const latitude = (0.5 - (y + 0.5) / height) * Math.PI;
    const longitude = ((x + 0.5) / width) * 2 * Math.PI;
    const point = [Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude)];
    const cell = point.map((value) => value / PIECE);
    const base = cell.map(Math.floor);
    const fraction = cell.map((value, axis) => smoothstep(0, 1, value - base[axis]));
    let sum = 0;
    let weights = 0;
    for (let corner = 0; corner < 8; corner++) {
      const offset = [corner & 1, (corner >> 1) & 1, (corner >> 2) & 1];
      const weight = offset.reduce((product, bit, axis) => product * (bit ? fraction[axis] : 1 - fraction[axis]), 1);
      if (weight < 1e-4) continue;
      // The lattice point, put on the sphere, and the ground offset of this pixel from it, east and north.
      const lattice = base.map((value, axis) => (value + offset[axis]) * PIECE);
      const length = Math.hypot(lattice[0], lattice[1], lattice[2]) || 1;
      const centre = lattice.map((value) => value / length);
      const centreLatitude = Math.asin(Math.max(-1, Math.min(1, centre[1])));
      const centreLongitude = Math.atan2(centre[2], centre[0]);
      const east = [-Math.sin(centreLongitude), 0, Math.cos(centreLongitude)];
      const north = [-Math.sin(centreLatitude) * Math.cos(centreLongitude), Math.cos(centreLatitude), -Math.sin(centreLatitude) * Math.sin(centreLongitude)];
      const away = point.map((value, axis) => value - centre[axis]);
      const e = away[0] * east[0] + away[2] * east[2];
      const n = away[0] * north[0] + away[1] * north[1] + away[2] * north[2];
      const source = piece(base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]);
      const turnedEast = e * source.cos - n * source.sin;
      const turnedNorth = e * source.sin + n * source.cos;
      const sampleLatitude = source.latitude + turnedNorth;
      const sampleLongitude = source.longitude + turnedEast / Math.cos(source.latitude);
      const value = sample((sampleLongitude / (2 * Math.PI)) * width - 0.5, (0.5 - sampleLatitude / Math.PI) * height - 0.5);
      if (value === null) continue;
      sum += weight * value;
      weights += weight * weight;
    }
    // Blending pieces of zero mean by their weights would flatten the relief where they overlap; dividing
    // by the root of the summed squares keeps its strength the same everywhere.
    return weights === 0 ? 0 : sum / Math.sqrt(weights);
  };

  // The band across the edge, and the reach over which the borrowed relief grows to its full strength.
  const band = Math.max(2, Math.round(width / 60));
  const growth = Math.max(band, Math.round(width / 12));
  const intoGap = distanceOut(gaps, width, height, growth);
  // Only a large gap reaches into the imaged ground. Mosaics also have small holes amid sharp images,
  // and a band round each of them blurred much of the real surface.
  const large = largeGaps(gaps, width, height, count / 50);
  const outsideLarge = new Uint8Array(count);
  for (let i = 0; i < count; i++) outsideLarge[i] = large[i] ? 0 : 1;
  const intoImaged = distanceOut(outsideLarge, width, height, 3 * band);

  // How fine the grain of the real ground is just beyond the band, for each longitude, smoothed over some
  // ten degrees and measured against the sources: this is how soft the borrowed relief starts there.
  // Coarse images have strong blotches but no grain, so the borrowed relief starts soft below them.
  const edgeSum = new Float32Array(width);
  const edgeCount = new Float32Array(width);
  for (let i = 0; i < count; i++) {
    if (gaps[i] || intoImaged[i] < band || intoImaged[i] >= 3 * band) continue;
    const x = i % width;
    edgeSum[x] += (light[i] - grain[i]) ** 2;
    edgeCount[x]++;
  }
  const spread = Math.max(1, Math.round(width / 72));
  const start = new Float32Array(width).fill(1);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let pixels = 0;
    for (let dx = -spread; dx <= spread; dx++) {
      const column = (x + dx + width) % width;
      sum += edgeSum[column];
      pixels += edgeCount[column];
    }
    if (pixels > 0) start[x] = Math.min(1, Math.max(0.15, Math.sqrt(sum / pixels) / sourceGrain));
  }

  const out = rgb.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      // Negative inside the imaged ground, positive in the gap; deeper than the band in the imaged ground
      // nothing changes.
      const across = gaps[i] ? intoGap[i] : large[i] ? 0 : -intoImaged[i];
      if (across <= -band) continue;
      const share = smoothstep(-band, 0, across);
      const strength = start[x] + (1 - start[x]) * smoothstep(band, growth, across);
      const value = broad[i] + relief[i] * (1 - share) + borrowed(x, y) * strength * share;
      // Added rather than multiplied, which made the tint of dark pixels glow in colour.
      const change = value - light[i];
      for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(Math.min(255, Math.max(0, rgb[i * 3 + k] + change)));
    }
  }
  return { width, height, rgb: out };
}

/** The whole treatment of one mosaic, already scaled to its final size. Also returns the share that was filled. */
export function prepareMap(picture: Picture, recipe: MapRecipe): { picture: Picture; filled: number } {
  const turned = recipe.centredOn180 ? halfTurn(picture) : picture;
  // The limb of a mosaic is often darkened over a few original pixels, so the margin grows with the size.
  const gaps = findGaps(turned, Math.max(2, Math.round(turned.width / 512)));
  const filled = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
  const smooth = fillGaps(colourise(turned, gaps, recipe), gaps);
  return { picture: recipe.inventUnseen ? inventTerrain(smooth, gaps) : smooth, filled };
}
