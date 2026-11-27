import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { GALACTIC_CENTRE } from "@/app/map/galaxy";
import { GALAXY_GLOW_FRAGMENT, SCREEN_VERTEX } from "@/app/map/scene/shaders";
import type { GlobePose } from "@/app/globe/renderer";
import { globeRadius, lightDirection, lockedSway, type GlobeSpec } from "@/app/globe/spec";
import { drawJob, planetJob, type Picture } from "../../scripts/gl-page";

export type { Picture };

/**
 * Draws a planet or the galaxy in the test browser with the real shaders and
 * texture maps, set up exactly as renderer.ts does (scripts/gl-page.ts), and
 * returns the pixels. Tests use it to choose the planet, the moment and the
 * camera directly, which the planet pages and the map do not allow.
 */

/** Opens a simple page of the site so that textures can be fetched from its origin. Call it once per test. */
export async function openLab(page: Page): Promise<void> {
  await page.goto("/legal/notice");
}

/** Draws a planet as renderer.ts does, in a square of `size` pixels. */
export function drawPlanet(page: Page, spec: GlobeSpec, pose: GlobePose, size = 160): Promise<Picture> {
  return drawJob(page, planetJob(spec, pose, size, "sm"));
}

/** The camera for `drawGalaxy`, positioned relative to the galactic centre. */
export interface GalaxyView {
  /** The camera position in parsecs from the galactic centre. */
  eye: [number, number, number];
  forward: [number, number, number];
  /** This direction must be perpendicular to `forward`. */
  up: [number, number, number];
  /** Half the picture height at distance 1. The default of 0.52 matches the field of view of the map. */
  reach?: number;
  /** Use 1 for a camera outside the disc and 0 for one inside it (see GalaxyView.update). */
  outside?: number;
}

/** Draws the galaxy as the map does, in a square of `size` pixels. */
export function drawGalaxy(page: Page, view: GalaxyView, size = 160): Promise<Picture> {
  const reach = view.reach ?? 0.52;
  const [fx, fy, fz] = view.forward;
  const [ux, uy, uz] = view.up;
  const right = [fy * uz - fz * uy, fz * ux - fx * uz, fx * uy - fy * ux];
  return drawJob(page, {
    vertex: `#version 300 es\n${SCREEN_VERTEX}`,
    fragment: `#version 300 es\n${GALAXY_GLOW_FRAGMENT}`,
    shape: "square",
    uniforms: {
      uEye: view.eye.map((value, axis) => value + GALACTIC_CENTRE[axis]),
      uForward: view.forward,
      uRight: right.map((value) => value * reach),
      uUp: view.up.map((value) => value * reach),
      uFade: 1,
      uOutside: view.outside ?? 1,
    },
    // The picture is loaded at the same size as on the map (scene/galaxyView.ts, PICTURE_SIZE).
    maps: [{ name: "uMap", url: "/textures/sky/galaxy.jpg", wraps: false, size: 512 }],
    noise: false,
    width: size,
    height: size,
  });
}

/** Returns the brightness of the pixel at `index`, from 0 to 255. */
export function brightness(picture: Picture, index: number): number {
  const at = index * 4;
  return 0.3 * picture.data[at] + 0.6 * picture.data[at + 1] + 0.1 * picture.data[at + 2];
}

export interface PlanetPixel {
  index: number;
  /** The distance from the planet centre in planet radii. Values below 1 lie on the planet. */
  fromCentre: number;
  /** The cosine of the star's angle: 1 with the star overhead, 0 at the terminator and negative at night. */
  sunward: number;
}

/**
 * Returns the pixels of a `drawPlanet` picture with their position on the
 * sphere. Pass the same spec and pose that drew the picture. Flattened
 * planets are treated as spheres.
 */
export function planetPixels(picture: Picture, spec: GlobeSpec, pose: GlobePose): PlanetPixel[] {
  const size = picture.width;
  const radius = (size / 2) * globeRadius(spec) * (pose.zoom ?? 1);
  const light = lightDirection((pose.yaw ?? 0) + lockedSway(spec, pose.seconds), pose.pitch);
  const pixels: PlanetPixel[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / radius;
      const dy = (size / 2 - (y + 0.5)) / radius;
      const fromCentre = Math.hypot(dx, dy);
      const dz = Math.sqrt(Math.max(1 - fromCentre * fromCentre, 0));
      pixels.push({
        index: y * size + x,
        fromCentre,
        sunward: fromCentre < 1 ? dx * light[0] + dy * light[1] + dz * light[2] : 0,
      });
    }
  }
  return pixels;
}

export function mean(pixels: readonly PlanetPixel[], value: (pixel: PlanetPixel) => number): number {
  if (pixels.length === 0) throw new Error("No pixel to look at.");
  return pixels.reduce((sum, pixel) => sum + value(pixel), 0) / pixels.length;
}

/** Returns the mean absolute difference per colour channel, from 0 to 255, optionally over some pixels only. */
export function difference(a: Picture, b: Picture, among?: readonly PlanetPixel[]): number {
  const indices = among ? among.map((pixel) => pixel.index) : Array.from({ length: a.width * a.height }, (_, i) => i);
  let sum = 0;
  for (const index of indices) {
    for (let channel = 0; channel < 3; channel++) {
      sum += Math.abs(a.data[index * 4 + channel] - b.data[index * 4 + channel]);
    }
  }
  return sum / (indices.length * 3);
}

const LOOKS = path.resolve("tests/e2e/looks");
const LOOK_SIZE = 48;
/** This is the allowed mean difference per colour channel, out of 255. */
const LOOK_TOLERANCE = 5;

/**
 * Compares a picture with the reference `name` in tests/e2e/looks. Both are
 * downscaled first, so that edge pixels, which differ between machines, do
 * not count, while changed colours or missing clouds still do. After an
 * intended change, renew the references with
 * `UPDATE_LOOKS=1 npm run test:e2e -- shaders` and review them before
 * committing them.
 */
export async function expectLook(picture: Picture, name: string): Promise<void> {
  const file = path.join(LOOKS, `${name}.png`);
  // The colours are already premultiplied by alpha, so dropping alpha gives the picture on black.
  const small = sharp(Buffer.from(picture.data), { raw: { width: picture.width, height: picture.height, channels: 4 } })
    .removeAlpha()
    .resize(LOOK_SIZE, LOOK_SIZE, { kernel: "cubic" });
  if (process.env.UPDATE_LOOKS) {
    mkdirSync(LOOKS, { recursive: true });
    await small.png().toFile(file);
    return;
  }
  expect(existsSync(file), `There is no kept picture ${name}.png yet. Run with UPDATE_LOOKS=1 to make it.`).toBe(true);
  const now = await small.raw().toBuffer();
  const kept = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < now.length; i++) sum += Math.abs(now[i] - kept[i]);
  expect(sum / now.length, `The look of ${name} has changed. If that is meant, renew tests/e2e/looks with UPDATE_LOOKS=1.`).toBeLessThan(LOOK_TOLERANCE);
}
