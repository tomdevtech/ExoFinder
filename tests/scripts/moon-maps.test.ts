import { describe, expect, it } from "vitest";
import { colourise, fillGaps, findGaps, halfTurn, inventTerrain, prepareMap, targetBrightness, type Picture } from "../../scripts/moon-maps";
import { seededRandom } from "@/shared/math";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SOLAR_BODIES } from "@/app/solar-system/bodies";

/** A picture of `width` × `height` whose pixels `paint` returns as [r, g, b]. */
function picture(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Picture {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgb.set(paint(x, y), (y * width + x) * 3);
  return { width, height, rgb };
}

const at = ({ width, rgb }: Picture, x: number, y: number) => Array.from(rgb.subarray((y * width + x) * 3, (y * width + x) * 3 + 3));
const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("halfTurn", () => {
  it("moves longitude 180 from the middle to the edges and back", () => {
    const original = picture(8, 2, (x) => [x * 10, 0, 0]);
    const turned = halfTurn(original);
    expect(at(turned, 0, 0)[0]).toBe(40);
    expect(at(turned, 4, 1)[0]).toBe(0);
    expect(halfTurn(turned)).toEqual(original);
  });
});

describe("findGaps", () => {
  it("marks black pixels and a margin round them, wrapping round in longitude", () => {
    const image = picture(10, 5, (x, y) => (x === 0 && y === 2 ? [0, 0, 0] : [120, 110, 100]));
    const gaps = findGaps(image, 1);
    expect(gaps[2 * 10 + 0]).toBe(1);
    expect(gaps[2 * 10 + 1]).toBe(1);
    expect(gaps[2 * 10 + 9]).toBe(1);
    expect(gaps[1 * 10 + 0]).toBe(1);
    expect(gaps[2 * 10 + 2]).toBe(0);
    expect(gaps.reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  it("does not take dark ground for a gap", () => {
    const image = picture(4, 4, () => [12, 10, 9]);
    expect(findGaps(image).every((value) => value === 0)).toBe(true);
  });
});

describe("fillGaps", () => {
  it("continues the surrounding tones smoothly and leaves imaged pixels alone", () => {
    // The southern half is imaged with a brightness that rises from west to east, the north is black.
    const image = picture(64, 32, (x, y) => (y < 16 ? [0, 0, 0] : [40 + x * 2, 40 + x * 2, 40 + x * 2]));
    const gaps = findGaps(image, 0);
    const filled = fillGaps(image, gaps, 4);
    for (let y = 16; y < 32; y++) for (let x = 0; x < 64; x++) expect(at(filled, x, y)).toEqual(at(image, x, y));
    // Just above the edge the fill matches the ground below it (away from the jump of the ramp where the
    // picture wraps round); it never turns black or bright white.
    expect(Math.abs(at(filled, 32, 15)[0] - at(image, 32, 16)[0])).toBeLessThan(12);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 64; x++) {
        expect(at(filled, x, y)[0]).toBeGreaterThanOrEqual(38);
        expect(at(filled, x, y)[0]).toBeLessThanOrEqual(170);
      }
    }
  });

  it("does nothing when nothing was imaged", () => {
    const black = picture(8, 4, () => [0, 0, 0]);
    expect(fillGaps(black, findGaps(black))).toEqual(black);
  });
});

describe("colourise", () => {
  const grey = picture(16, 8, (x) => [x * 16, x * 16, x * 16]);
  const none = new Uint8Array(16 * 8);

  it("tints grey mosaics from the dark to the bright colour and keeps the order of brightness", () => {
    const tinted = colourise(grey, none, { centredOn180: false, colouring: { kind: "grey", dark: "#804020", bright: "#e0e0ff" }, albedo: 0.3 });
    const darkPixel = at(tinted, 3, 0);
    const brightPixel = at(tinted, 14, 0);
    expect(darkPixel[0]).toBeGreaterThan(darkPixel[2]);
    expect(brightPixel[2]).toBeGreaterThanOrEqual(brightPixel[0]);
    for (let x = 1; x < 16; x++) expect(luminance(at(tinted, x, 0))).toBeGreaterThanOrEqual(luminance(at(tinted, x - 1, 0)) - 1);
  });

  it("sets the average brightness after the albedo", () => {
    for (const albedo of [0.09, 0.3, 0.9]) {
      const result = colourise(grey, none, { centredOn180: false, colouring: { kind: "colour", saturation: 1 }, albedo });
      let sum = 0;
      for (let x = 0; x < 16; x++) for (let y = 0; y < 8; y++) sum += luminance(at(result, x, y));
      expect(sum / 128 / 255).toBeCloseTo(targetBrightness(albedo), 1);
    }
    expect(targetBrightness(0.09)).toBeLessThan(targetBrightness(0.9));
  });

  it("tones down colours and leaves the gaps for fillGaps", () => {
    const red = picture(2, 1, () => [200, 60, 60]);
    const gaps = new Uint8Array([0, 1]);
    const result = colourise(red, gaps, { centredOn180: false, colouring: { kind: "colour", saturation: 0.3 }, albedo: 0.3 });
    const [r, g] = at(result, 0, 0);
    // Red was 70 % above green; toned down to 30 % it stays well below half of that.
    expect((r - g) / r).toBeLessThan(0.5 * ((200 - 60) / 200));
    expect(at(result, 1, 0)).toEqual([200, 60, 60]);
  });

  it("veils Titan in its haze with the surface showing only faintly", () => {
    const result = colourise(grey, none, { centredOn180: false, colouring: { kind: "haze", color: "#d39a4c" }, albedo: 0.2 });
    const lightest = luminance(at(result, 15, 0));
    const darkest = luminance(at(result, 0, 0));
    expect(lightest / darkest).toBeLessThan(1.4);
    expect(at(result, 8, 0)[0]).toBeGreaterThan(at(result, 8, 0)[2]);
  });
});

describe("inventTerrain", () => {
  // The north is imaged with a fine grain, as if seen closely; the south was never imaged.
  const random = seededRandom(7);
  const grain = picture(256, 128, (x, y) => {
    if (y >= 64) return [0, 0, 0];
    const value = Math.round(120 + 60 * (random() - 0.5));
    return [value, value, value];
  });
  const gaps = findGaps(grain, 0);
  const smooth = fillGaps(grain, gaps, 4);
  const terrain = inventTerrain(smooth, gaps);

  /** The mean and the spread of the brightness over the rows from `top` to `bottom`. */
  const rows = (image: Picture, top: number, bottom: number) => {
    const values: number[] = [];
    for (let y = top; y < bottom; y++) for (let x = 0; x < image.width; x++) values.push(luminance(at(image, x, y)));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    return { mean, spread };
  };

  it("leaves the imaged ground as it is, apart from a narrow band along the large gap", () => {
    // The band is a sixtieth of the width: four pixels here.
    for (let y = 0; y < 60; y++) for (let x = 0; x < 256; x++) expect(at(terrain, x, y)).toEqual(at(smooth, x, y));
  });

  it("crosses the edge of the imaged ground without a step in brightness", () => {
    expect(Math.abs(rows(terrain, 62, 64).mean - rows(terrain, 64, 66).mean)).toBeLessThan(4);
  });

  it("leaves the ground round a small hole alone and only fills the hole", () => {
    // A hole of three by three pixels amid the imaged ground, besides the large gap in the south.
    const holed = picture(256, 128, (x, y) => (y >= 64 || (x >= 100 && x < 103 && y >= 30 && y < 33) ? [0, 0, 0] : at(grain, x, y) as [number, number, number]));
    const holes = findGaps(holed, 0);
    const filled = fillGaps(holed, holes, 4);
    const result = inventTerrain(filled, holes);
    for (let y = 20; y < 44; y++) {
      for (let x = 90; x < 113; x++) {
        if (!holes[y * 256 + x]) expect(at(result, x, y)).toEqual(at(filled, x, y));
      }
    }
  });

  it("gives the unseen part the grain of the imaged one, where the smooth fill had none", () => {
    expect(rows(smooth, 80, 128).spread).toBeLessThan(2);
    expect(rows(terrain, 80, 128).spread).toBeGreaterThan(0.4 * rows(grain, 0, 64).spread);
  });

  it("keeps the tones of the fill, adding relief and no light or shadow of its own", () => {
    expect(Math.abs(rows(terrain, 80, 128).mean - rows(smooth, 80, 128).mean)).toBeLessThan(3);
  });

  it("starts the relief as soft as the images above it, and lets it grow further from them", () => {
    // The western half is imaged sharply, the eastern half only coarsely, without any grain.
    const noise = seededRandom(11);
    const mixed = picture(256, 128, (x, y) => {
      if (y >= 64) return [0, 0, 0];
      const value = x < 128 ? Math.round(120 + 60 * (noise() - 0.5)) : Math.round(120 + 20 * Math.sin(x / 9));
      return [value, value, value];
    });
    const holes = findGaps(mixed, 0);
    const result = inventTerrain(fillGaps(mixed, holes, 4), holes);
    const spread = (top: number, bottom: number, left: number, right: number) => {
      const values: number[] = [];
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) values.push(luminance(at(result, x, y)));
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    };
    // Below the coarse images the relief starts faint and grows to the south.
    expect(spread(65, 69, 150, 240)).toBeLessThan(spread(100, 110, 150, 240) / 2);
    // Below the sharp ones it is about as strong right away as further south.
    expect(spread(65, 69, 20, 110)).toBeGreaterThan(spread(100, 110, 20, 110) / 2);
  });

  it("borrows the same terrain every time", () => {
    expect(inventTerrain(smooth, gaps)).toEqual(terrain);
  });

  it("does nothing when nothing was imaged", () => {
    const black = picture(64, 32, () => [0, 0, 0]);
    const all = findGaps(black, 0);
    expect(inventTerrain(black, all)).toEqual(black);
  });

  it("is applied by prepareMap only for a recipe that asks for it", () => {
    const recipe = { centredOn180: false, colouring: { kind: "grey", dark: "#606060", bright: "#d0d0d0" }, albedo: 0.3 } as const;
    const plain = prepareMap(grain, recipe).picture;
    const invented = prepareMap(grain, { ...recipe, inventUnseen: true }).picture;
    expect(rows(plain, 90, 128).spread).toBeLessThan(2);
    expect(rows(invented, 90, 128).spread).toBeGreaterThan(5);
  });
});

describe("prepareMap", () => {
  it("turns, colours and fills a mosaic, and reports how much was filled", () => {
    const mosaic = picture(32, 16, (x, y) => (y < 4 ? [0, 0, 0] : [90, 90, 90]));
    const { picture: prepared, filled } = prepareMap(mosaic, {
      centredOn180: true,
      colouring: { kind: "grey", dark: "#606060", bright: "#d0d0d0" },
      albedo: 0.3,
    });
    // Four black rows of sixteen, plus the margin of two rows that findGaps adds.
    expect(filled).toBeCloseTo(6 / 16, 6);
    for (let i = 0; i < prepared.rgb.length; i++) expect(prepared.rgb[i]).toBeGreaterThan(20);
  });
});

describe("the map sources", () => {
  it("name a map, a credit and a licence for every body with a page, apart from those never mapped whole", () => {
    // No spacecraft has mapped all of Deimos, Hyperion or the small moons near Saturn's rings; their pages say
    // so and show the shape alone.
    const unmapped = ["deimos", "hyperion", "pan", "daphnis", "atlas", "prometheus", "pandora", "epimetheus", "janus", "telesto", "calypso", "helene"];
    expect(Object.keys(MAP_SOURCES).sort()).toEqual(
      SOLAR_BODIES.map((body) => body.slug)
        .filter((slug) => !unmapped.includes(slug))
        .sort(),
    );
    // The south of Pluto and Charon carries borrowed terrain, and their pages must say that it is invented.
    for (const slug of ["pluto", "charon"]) expect(MAP_SOURCES[slug].note).toContain("illustration");
    for (const source of Object.values(MAP_SOURCES)) {
      expect(source.download).toMatch(/^https:\/\//);
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.credit.length).toBeGreaterThan(5);
      expect(source.licence.length).toBeGreaterThan(3);
    }
  });
});
