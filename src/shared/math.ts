/**
 * Returns a generator of numbers from 0 (inclusive) to 1 (exclusive) that gives the same sequence for the
 * same seed on every machine (mulberry32). Whatever is drawn by lot uses it, so a planet, a belt or a
 * galaxy looks the same on every visit.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a 32-bit hash that is always the same for the same text (FNV-1a). */
export function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Rises smoothly from 0 at `low` to 1 at `high`, as the GLSL function of the same name does. */
export function smoothstep(low: number, high: number, value: number): number {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Moves `value` towards `goal` by at most `step`. */
export function approach(value: number, goal: number, step: number): number {
  return value < goal ? Math.min(goal, value + step) : Math.max(goal, value - step);
}

/** Normalises an angle to the range -π to π. */
export function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI;
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
}

/** Mixes two positive values by their logarithms, so a change across many powers of ten looks even. */
export function mixLog(a: number, b: number, share: number): number {
  return a * (b / a) ** share;
}
