import { smoothstep } from "@/shared/math";
import { pcg3d } from "./noise";
import { seedOffset, type GlobeSpec } from "./spec";

/**
 * Computes the storms of a planet at one moment for the shader. Each slot hosts one storm after
 * another, and position, size and age depend only on time and seed, so a planet always shows the
 * same weather at the same moment. The result is the same for every pixel, so it is computed once
 * per frame here instead of per pixel in the shader.
 */

export const CYCLONE_SLOTS = 4;
export const DUST_SLOTS = 3;

export interface StormUniforms {
  /**
   * Twelve numbers per cyclone, living ones first: centre in the drifting cloud frame and size;
   * strength, hemisphere as 1 or -1 (2 or -2 if tropical), maturity and spin rate; elongation and
   * a seed for its lumps.
   */
  uCyclones: number[];
  uCycloneCount: number;
  /** The centre and radius of each dust storm. */
  uDusts: number[];
  /** The strength of each dust storm; 0 means there is none. */
  uDustLives: [number, number, number];
  /**
   * The outbreak on a gas planet: longitude and latitude of its head, age from 0 to 1, and strength
   * (0 for none).
   */
  uOutbreak: [number, number, number, number];
  /** 1 or -1 for the side of the head the tail trails on. */
  uOutbreakTail: number;
}

const TAU = 2 * Math.PI;

/** Returns three values from 0 to 1, using the same integer hash as the shaders so both agree. */
function hash3(x: number, y: number, z: number): [number, number, number] {
  const [a, b, c] = pcg3d(Math.trunc(x) + 65536, Math.trunc(y) + 65536, Math.trunc(z) + 65536);
  return [a / 4294967295, b / 4294967295, c / 4294967295];
}

/** Returns a point on the unit sphere from sin(latitude) and longitude. */
function onBall(sinLat: number, lon: number): [number, number, number] {
  const cosLat = Math.sqrt(Math.max(1 - sinLat * sinLat, 0));
  return [cosLat * Math.sin(lon), sinLat, cosLat * Math.cos(lon)];
}

/**
 * Returns which life a slot is in, how long it lasts in seconds and its progress from 0 to 1. Each
 * slot starts at its own time, so the storms of a planet come and go one after another.
 */
function stormLife(slot: number, seed: number, seconds: number, shortest: number, spread: number) {
  const own = hash3(slot + 41, Math.floor(seed * 13), 9);
  const span = shortest + spread * own[0];
  const age = seconds / span + own[1] * 7;
  return { turn: Math.floor(age), span, age: age - Math.floor(age) };
}

/** The wind of a band preset at sin(latitude). It must match presetWind in surface.glsl.ts. */
function presetWind(spec: GlobeSpec, s: number): number {
  const [strength, count, equator, narrowness] = spec.jets;
  const jets = strength * Math.sin(s * count + spec.belts[1]) + equator * Math.exp(-s * s * narrowness);
  return jets * (1 - Math.abs(s) ** 6);
}

/**
 * Sea cyclones. Tropical ones form near the equator, drift west, swing towards the pole and grow;
 * mid-latitude ones are wider and drift east.
 */
function cyclones(spec: GlobeSpec, seconds: number): number[] {
  const [seedX, seedY, seedZ] = seedOffset(spec.seed);
  const alive: number[] = [];
  for (let slot = 0; slot < CYCLONE_SLOTS && spec.storms.cyclones > 0; slot++) {
    const life = stormLife(slot, seedX, seconds, 70, 50);
    const f = life.age;
    const rnd = hash3(slot + 11, life.turn, Math.floor(seedY * 17));
    const rnd2 = hash3(slot + 23, life.turn, Math.floor(seedZ * 19));
    // Calmer planets leave some slots empty.
    if (rnd2[2] > spec.storms.cyclones) continue;
    const strength = smoothstep(0, 0.2, f) * (1 - smoothstep(0.7, 1, f));
    const hemisphere = rnd[0] < 0.5 ? -1 : 1;
    const tropical = rnd[2] < 0.6;
    let sinLat: number;
    let lon = rnd[1] * TAU;
    let size: number;
    if (tropical) {
      sinLat = hemisphere * (0.12 + 0.12 * rnd2[0] + 0.4 * smoothstep(0.35, 1, f));
      lon += -0.7 * Math.min(f, 0.55) + 1.1 * Math.max(f - 0.55, 0);
      size = (0.08 + 0.06 * rnd2[1]) * (0.55 + 0.45 * smoothstep(0, 0.4, f)) * (1 + 0.7 * smoothstep(0.6, 1, f));
    } else {
      sinLat = hemisphere * (0.48 + 0.25 * rnd2[0]);
      lon += 0.9 * f;
      size = 0.16 + 0.12 * rnd2[1];
    }
    const mature = tropical ? smoothstep(0.15, 0.4, f) * (1 - smoothstep(0.7, 0.95, f)) : 0;
    alive.push(
      ...onBall(sinLat, lon),
      size,
      strength,
      hemisphere * (tropical ? 2 : 1),
      mature,
      // The storm winds up tighter as it matures and ages.
      1.1 + 1.6 * mature + 0.012 * f * life.span,
      1 + 0.3 * (rnd2[0] - 0.5),
      rnd[0] * 37 + life.turn,
      0,
      0,
    );
  }
  return alive;
}

/** Dust storms on a dry planet with air. About one in eight grows until it covers the whole planet. */
function dustStorms(spec: GlobeSpec, seconds: number): { places: number[]; lives: [number, number, number] } {
  const [seedX, seedY] = seedOffset(spec.seed);
  const places = new Array<number>(DUST_SLOTS * 4).fill(0);
  const lives: [number, number, number] = [0, 0, 0];
  for (let slot = 0; slot < DUST_SLOTS && spec.storms.dust > 0; slot++) {
    const life = stormLife(slot + 7, seedX, seconds, 90, 60);
    const f = life.age;
    const rnd = hash3(slot + 31, life.turn, Math.floor(seedX * 23));
    const rnd2 = hash3(slot + 37, life.turn, Math.floor(seedY * 29));
    if (rnd2[2] > spec.storms.dust) continue;
    const reach = rnd[2] < 0.12 ? 3.3 : 0.28 + 0.35 * rnd2[0];
    const radius = 0.05 + (reach - 0.05) * smoothstep(0, 0.55, f);
    places.splice(slot * 4, 4, ...onBall((rnd[0] - 0.5) * 1.3, rnd[1] * TAU + 0.25 * f), radius);
    lives[slot] = smoothstep(0, 0.15, f) * (1 - smoothstep(0.7, 1, f));
  }
  return { places, lives };
}

/** A storm outbreak on a gas planet: fresh cloud wells up at one point and the wind draws it out along its band. */
function outbreak(spec: GlobeSpec, seconds: number): { state: [number, number, number, number]; tail: number } {
  const none = { state: [0, 0, 0, 0] as [number, number, number, number], tail: 1 };
  if (spec.storms.outbreaks <= 0) return none;
  const [seedX, , seedZ] = seedOffset(spec.seed);
  const life = stormLife(17, seedX, seconds, 60, 40);
  const f = life.age;
  const rnd = hash3(53, life.turn, Math.floor(seedZ * 31));
  if (rnd[2] > spec.storms.outbreaks) return none;
  const strength = smoothstep(0, 0.08, f) * (1 - smoothstep(0.55, 1, f));
  const sinLat = (rnd[0] - 0.5) * 1.2;
  const wind = presetWind(spec, sinLat);
  return {
    state: [rnd[1] * TAU + wind * 0.04 * spec.pace * f * life.span, Math.asin(sinLat), f, strength],
    tail: wind >= 0 ? -1 : 1,
  };
}

/** Returns the storm uniforms for the given number of seconds after the start. */
export function stormUniforms(spec: GlobeSpec, seconds: number): StormUniforms {
  const alive = cyclones(spec, seconds);
  const dust = dustStorms(spec, seconds);
  const plume = outbreak(spec, seconds);
  return {
    uCyclones: [...alive, ...new Array<number>(CYCLONE_SLOTS * 12 - alive.length).fill(0)],
    uCycloneCount: alive.length / 12,
    uDusts: dust.places,
    uDustLives: dust.lives,
    uOutbreak: plume.state,
    uOutbreakTail: plume.tail,
  };
}
