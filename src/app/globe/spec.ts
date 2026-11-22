/** A rotation or mirroring as a 3x3 matrix in column-major order, which is how GLSL reads it. */
export type Turn = [number, number, number, number, number, number, number, number, number];

export const NO_TURN: Turn = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Everything the planet images and the 3D view need to draw a planet. It is plain data, so the
 * server can compute it and pass it to the browser.
 */
export interface GlobeSpec {
  /**
   * `map` uses a real surface map, which only solar system planets have. `terrain` (rocky planets)
   * and `bands` (gas giants) use a simulated preset that the planet's values colour.
   */
  kind: "map" | "terrain" | "bands";
  /** Seeds the computed parts (clouds, fine grain, coastlines), so a planet always looks the same. */
  seed: number;
  /** For rocky planets: low, middle and high ground. For gas planets: dark belts, base colour and bright zones. */
  palette: [string, string, string];
  /**
   * `level` is the preset height (0 to 1) below which there is water. A `map` shows its own seas and
   * ignores it.
   */
  ocean: { color: string; level: number } | null;
  /** Size of the polar caps: 0 for none, 1 for ice down to the equator. */
  ice: number;
  /** `cover` is the share of the sky covered by clouds, from 0 to 1. */
  clouds: { color: string; cover: number } | null;
  /** Light the planet gives off itself: lava on solid planets, heat on gas giants. */
  glow: { color: string; strength: number } | null;
  /** Polar lights, which show around the magnetic poles on the night side. */
  aurora: { color: string; strength: number } | null;
  /** How often lightning flashes in the storms of a gas planet at night; 0 means never. */
  lightning: number;
  /**
   * How lively the storms are, each from 0 to 1: sea cyclones, dust storms, how fast the storms and
   * the turbulence of a gas planet move (up to 1.4 on a lively Neptune-like one), and cloud outbreaks.
   */
  storms: { cyclones: number; dust: number; spin: number; outbreaks: number };
  /** How deep the craters of a terrain preset show, from 0 to 1. */
  craters: number;
  /** How strongly heights catch the light; 0 gives a smooth sphere. */
  relief: number;
  /**
   * Only for `bands`: how much the belts stand out, how strongly the fine streaks and the storms show,
   * and how much bright high cloud drifts above the deck in wisps (0 for none).
   */
  bands: { contrast: number; turbulence: number; storms: number; wisps: number };
  /** `density` ranges from 0 (none) to 1 (as thick as on Earth or Venus). */
  atmosphere: { color: string; density: number } | null;
  /** The colour of the starlight. */
  light: string;
  /** Inner and outer edge in planet radii. `map` names a ring texture. */
  rings: { inner: number; outer: number; map: string | null } | null;
  /**
   * A moon on a circular orbit above the equator. Its radius and orbit radius are in planet radii,
   * the period is in on-screen seconds, and the starting phase is in radians.
   */
  moon: { size: number; distance: number; period: number; phase: number } | null;
  /** How much shorter the planet is from pole to pole than across: 0 for a sphere, 0.1 for Saturn. */
  flattening: number;
  /** How sharply the climate zones follow latitude: 1 for an upright axis, less the more the axis is tilted. */
  zones: number;
  /**
   * 1 for a tidally locked planet, whose climate runs from the point under the star to the night
   * side instead of following latitude; 0 for a planet with days and nights.
   */
  locked: number;
  tiltDeg: number;
  /** Direction and speed of rotation: 1 is the usual pace, and negative values turn backwards. */
  spin: number;
  /**
   * How the clouds move: 0 not at all, 1 as bands drifting against each other (gas giants), 2 as one
   * cloud deck that lags towards the poles (Venus).
   */
  flow: number;
  /**
   * Band winds for flow 1: strength and number of the alternating jets, then strength (negative is
   * backwards) and narrowness of the equatorial jet. For `bands` these are the simulated winds; on
   * a hot planet held by its star the equatorial jet is stronger.
   */
  jets: [number, number, number, number];
  /** How fast the clouds move along their winds: 1 is the usual pace. A hotter gas planet is stirred harder by its star. */
  pace: number;
  /**
   * How the preset is laid on the sphere. A `terrain` may be turned and mirrored any way, but `bands`
   * only turn about the axis and swap east and west or north and south, so the belts follow latitude.
   */
  turn: Turn;
  /** A second `terrain` preset with its own turn. Mixing the two in large patches makes each planet look unique. */
  second: { map: string; turn: Turn } | null;
  /**
   * For a `terrain` with seas: the weather preset its clouds are drawn from. It only turns about the
   * axis and swaps north and south, so the storm tracks follow the latitudes and the lows keep
   * turning the way the planet's spin makes them.
   */
  weather: { map: string; turn: Turn } | null;
  /**
   * For rocky planets: the height (0 to 1) up to which lava or dry basins reach (0 for none), river
   * strength (rivers of lava on a planet that glows), relief height, and 1 for an ice crust.
   */
  terrain: [number, number, number, number];
  /** For gas planets: the share of the preset's latitudes that is shown, and the phase of its jets (see `jets`). */
  belts: [number, number];
  /**
   * Texture names: in public/textures/planets for `map`, and in public/textures/presets (as `day`)
   * for `terrain` and `bands`. `relief` is a map of a real body's slopes and seas, which replaces
   * guessing both from the colours of its day map.
   */
  maps: { day: string; night: string | null; clouds: string | null; relief: string | null };
}

/** The share of the image's half width the planet fills, leaving room for rings and a moon. */
export function globeRadius(spec: GlobeSpec): number {
  const reach = Math.max(
    1,
    spec.rings?.outer ?? 0,
    spec.moon ? spec.moon.distance + spec.moon.size : 0,
  );
  return 0.84 / reach;
}

/**
 * A tidally locked rocky planet cannot turn in front of the viewer, so the viewer swings slowly to
 * and fro instead, which moves the terminator across the image. Gas planets do not need this because
 * their winds move the clouds. Returns the angle to add to the viewer's yaw, in radians.
 */
export function lockedSway(spec: GlobeSpec, seconds: number): number {
  if (spec.kind !== "terrain") return 0;
  return spec.locked * 0.85 * Math.sin(seconds * SPIN_RATE * 0.5);
}

/** The moon's position as the viewer sees it, in planet radii: x right, y up, z towards the viewer. */
export function moonPosition(
  spec: GlobeSpec,
  seconds: number,
  yaw = 0,
  pitch = 0,
): [number, number, number] | null {
  if (!spec.moon) return null;
  const angle = spec.moon.phase + (seconds / spec.moon.period) * 2 * Math.PI;
  const x = Math.cos(angle) * spec.moon.distance;
  const z = Math.sin(angle) * spec.moon.distance;
  const frame = axisFrame(spec, yaw, pitch);
  return [frame[0] * x + frame[2] * z, frame[3] * x + frame[5] * z, frame[6] * x + frame[8] * z];
}

/** Converts "#rrggbb" to linear red, green and blue from 0 to 1, which the shader calculates with. */
export function linearColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => (((value >> shift) & 0xff) / 255) ** 2.2;
  return [channel(16), channel(8), channel(0)];
}

/** Derives three noise offsets from the seed. */
export function seedOffset(seed: number): [number, number, number] {
  return [(seed * 0.731) % 97, (seed * 1.379) % 89, (seed * 2.113) % 83];
}

/**
 * A rotation as a row-major 3x3 matrix from planet space (y is the axis) to view space (x right,
 * y up, z towards the viewer). It combines the spin, the axial tilt and the camera's `yaw` and `pitch`.
 */
export function globeRotation(
  spec: GlobeSpec,
  seconds: number,
  yaw = 0,
  pitch = 0,
): number[] {
  const phase = ((spec.seed * 0.618) % 1) * Math.PI * 2;
  const spin = rotationY(phase + seconds * SPIN_RATE * spec.spin);
  return multiply(axisFrame(spec, yaw, pitch), spin);
}

/** The same rotation without the spin, which places the axis and the equator. */
function axisFrame(spec: GlobeSpec, yaw: number, pitch: number): number[] {
  const tilt = rotationZ((-spec.tiltDeg * Math.PI) / 180);
  // The north pole leans a little towards the viewer so the rings open up.
  const lean = rotationX(LEAN);
  const camera = multiply(rotationX(pitch), rotationY(yaw));
  return multiply(camera, multiply(lean, tilt));
}

/** The direction to the star as the viewer sees it: from the upper left and slightly from the front. */
export function lightDirection(yaw = 0, pitch = 0): [number, number, number] {
  const camera = multiply(rotationX(pitch), rotationY(yaw));
  const [x, y, z] = LIGHT;
  return [
    camera[0] * x + camera[1] * y + camera[2] * z,
    camera[3] * x + camera[4] * y + camera[5] * z,
    camera[6] * x + camera[7] * y + camera[8] * z,
  ];
}

/** One rotation takes about 40 seconds. */
export const SPIN_RATE = (Math.PI * 2) / 40;
const LEAN = 0.24;
const LIGHT = normalize([-0.62, 0.42, 0.66]);

function normalize([x, y, z]: number[]): [number, number, number] {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function rotationX(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

function rotationY(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function rotationZ(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] =
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}
