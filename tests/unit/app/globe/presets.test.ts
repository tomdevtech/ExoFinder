import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import PRESETS from "@/app/globe/presets.json";

/**
 * The maps in public/textures/presets and presets.json come from the same
 * `npm run presets` run. These tests catch a map that is missing, has the
 * wrong size or was regenerated without updating its numbers.
 */

const file = (name: string, size: "sm" | "lg") =>
  path.resolve("public/textures/presets", `${name}-${size}.webp`);

const terrain = Object.entries(PRESETS.terrain);
const bands = Object.entries(PRESETS.bands);

describe("the base maps of the planets", () => {
  it("are there in both sizes, twice as wide as high, with three channels", async () => {
    for (const name of [...Object.keys(PRESETS.terrain), ...Object.keys(PRESETS.bands), ...PRESETS.weather]) {
      for (const [size, width] of [["sm", 512], ["lg", 2048]] as const) {
        expect(existsSync(file(name, size)), `${name}-${size}.webp`).toBe(true);
        const picture = await sharp(file(name, size)).metadata();
        expect([picture.width, picture.height, picture.channels], `${name}-${size}.webp`).toEqual([width, width / 2, 3]);
      }
    }
  });

  it("come with the slopes of every rocky one and the winds of every banded and weather one", async () => {
    const folder = path.resolve("public/textures/presets");
    for (const name of Object.keys(PRESETS.terrain)) {
      for (const [size, width] of [["sm", 512], ["lg", 2048]] as const) {
        const relief = path.join(folder, `${name}-relief-${size}.avif`);
        expect(existsSync(relief), relief).toBe(true);
        // The slopes of the height lie above those of the craters, so the picture is square.
        const picture = await sharp(relief).metadata();
        expect([picture.width, picture.height], relief).toEqual([width, width]);
      }
    }
    expect(PRESETS.weather.length).toBeGreaterThanOrEqual(3);
    for (const name of [...Object.keys(PRESETS.bands), ...PRESETS.weather]) {
      const flow = path.join(folder, `${name}-flow.webp`);
      expect(existsSync(flow), flow).toBe(true);
      const picture = await sharp(flow).metadata();
      expect([picture.width, picture.height], flow).toEqual([512, 256]);
    }
  });

  it("come with rising levels from 0 to 1 for every rocky one", () => {
    expect(terrain.length).toBeGreaterThanOrEqual(9);
    for (const [name, { levels }] of terrain) {
      expect(levels, name).toHaveLength(21);
      expect(levels[0], name).toBe(0);
      expect(levels[20], name).toBe(1);
      for (let i = 1; i < levels.length; i++) expect(levels[i], name).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  it("have the heights the levels were counted from", async () => {
    // The level at one half is the height below which half of the surface lies.
    // It is recounted from the small map, weighting pixels near the poles less because they cover less ground.
    for (const [name, { levels }] of terrain) {
      const { data, info } = await sharp(file(name, "sm")).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
      let below = 0;
      let all = 0;
      for (let y = 0; y < info.height; y++) {
        const ground = Math.max(Math.cos((0.5 - (y + 0.5) / info.height) * Math.PI), 0.12);
        for (let x = 0; x < info.width; x++) {
          all += ground;
          if (data[y * info.width + x] / 255 < levels[10]) below += ground;
        }
      }
      // The small map is a downscaled copy, so the share is only approximately one half.
      expect(below / all, name).toBeGreaterThan(0.4);
      expect(below / all, name).toBeLessThan(0.6);
    }
  });

  it("come with the winds they were simulated with for every banded one", () => {
    expect(bands.length).toBeGreaterThanOrEqual(6);
    for (const [name, winds] of bands) {
      expect(winds.count, name).toBeGreaterThan(0);
      expect(winds.narrowness, name).toBeGreaterThan(0);
      expect(winds.strength, name).toBeGreaterThan(0);
      // The winds are normalised so that the fastest latitude moves at about speed 1 in either direction.
      expect(winds.strength + Math.abs(winds.equator), name).toBeCloseTo(1, 2);
      expect(winds.phase, name).toBeGreaterThanOrEqual(0);
      expect(winds.phase, name).toBeLessThan(2 * Math.PI);
    }
  });

  it("name the largest storms of every banded one, where the map has them", async () => {
    for (const [name, winds] of bands) {
      expect(winds.storms.length, name).toBeLessThanOrEqual(6);
      if (name !== "bands-hazy") expect(winds.storms.length, name).toBeGreaterThan(0);
      const { data, info } = await sharp(file(name, "sm")).extractChannel(2).raw().toBuffer({ resolveWithObject: true });
      for (const [lon, lat, size, spin] of winds.storms) {
        expect(Math.abs(spin), name).toBe(1);
        expect(size, name).toBeGreaterThan(0);
        // The blue channel marks storms, so the listed centre must be blue on the map.
        const column = Math.min(info.width - 1, Math.floor((lon / (2 * Math.PI) + 0.5) * info.width));
        const row = Math.min(info.height - 1, Math.floor((0.5 - lat / Math.PI) * info.height));
        let strongest = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const y = Math.min(info.height - 1, Math.max(0, row + dy));
            const x = (column + dx + info.width) % info.width;
            strongest = Math.max(strongest, data[y * info.width + x]);
          }
        }
        expect(strongest, `${name} at ${lon}, ${lat}`).toBeGreaterThan(150);
      }
    }
  });

  it("keep the storms of the gas giants apart from their belts", async () => {
    // The blue channel marks storms, so most of a map has none and some of it does.
    for (const [name] of bands) {
      if (name === "bands-hazy") continue;
      const { data } = await sharp(file(name, "sm")).extractChannel(2).raw().toBuffer({ resolveWithObject: true });
      const marked = data.filter((value) => value > 128).length / data.length;
      expect(marked, name).toBeGreaterThan(0);
      expect(marked, name).toBeLessThan(0.2);
    }
  });
});
