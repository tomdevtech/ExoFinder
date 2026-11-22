import { linearColor, NO_TURN, seedOffset, type GlobeSpec, type Turn } from "./spec";

type Vec2 = [number, number];
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

/** The values for the uniforms of surface.glsl.ts, except the textures and the time. */
export interface SurfaceUniforms {
  uSeed: Vec3;
  uColLow: Vec3;
  uColMid: Vec3;
  uColHigh: Vec3;
  uOcean: Vec4;
  uIce: number;
  uCloud: Vec4;
  uGlow: Vec4;
  uCraters: number;
  uRelief: number;
  uBands: Vec4;
  uAtmo: Vec4;
  uLight: Vec3;
  uRing: Vec3;
  uMapFlags: Vec4;
  uFlow: number;
  uJets: Vec4;
  uZones: number;
  uLocked: number;
  uMapTurn: Turn;
  uMapTurn2: Turn;
  uWeatherTurn: Turn;
  uTerrain: Vec4;
  uBelts: Vec2;
  uAurora: Vec4;
  uLightning: number;
  uStormSpin: number;
  uPace: number;
}

const KIND = { map: 0, terrain: 1, bands: 2 } as const;

/**
 * The parts of surface.glsl.ts a planet needs, as #define values. Every combination is a separate
 * program, so a planet only compiles the code it uses, which compiles much faster.
 */
export interface SurfaceDefines {
  /** 0 for a map, 1 for a terrain preset, 2 for a band preset. */
  KIND: 0 | 1 | 2;
  /** 1 when heights catch the light, 2 when a map's slopes come from a relief map of their own. */
  RELIEF: 0 | 1 | 2;
  /** 1 for solid ground under air, which veils the ground. Gas, closed cloud decks and airless bodies have 0. */
  AIR: 0 | 1;
}

export function surfaceDefines(spec: GlobeSpec): SurfaceDefines {
  return {
    KIND: KIND[spec.kind],
    // Terrain always has relief and bands never do. Maps of gas planets have none either.
    RELIEF: spec.kind === "map" && spec.maps.relief ? 2 : spec.kind === "terrain" || (spec.kind === "map" && spec.relief > 0) ? 1 : 0,
    // The clouds of a map that flow are all there is to see of it (the gas giants, Venus).
    AIR: spec.atmosphere && spec.kind !== "bands" && !(spec.kind === "map" && spec.flow > 0) ? 1 : 0,
  };
}

/** Every combination that surfaceDefines can return, so all programs can be built in advance. */
export const ALL_SURFACE_DEFINES: SurfaceDefines[] = [
  { KIND: 0, RELIEF: 2, AIR: 1 },
  { KIND: 0, RELIEF: 1, AIR: 1 },
  { KIND: 0, RELIEF: 1, AIR: 0 },
  { KIND: 0, RELIEF: 0, AIR: 1 },
  { KIND: 0, RELIEF: 0, AIR: 0 },
  { KIND: 1, RELIEF: 1, AIR: 1 },
  { KIND: 1, RELIEF: 1, AIR: 0 },
  { KIND: 2, RELIEF: 0, AIR: 0 },
];

/** The #define lines for a shader. They also serve as the key of its program. */
export function defineLines(defines: SurfaceDefines): string {
  return `#define KIND ${defines.KIND}\n#define RELIEF ${defines.RELIEF}\n#define AIR ${defines.AIR}\n`;
}

export function surfaceUniforms(spec: GlobeSpec): SurfaceUniforms {
  return {
    uSeed: seedOffset(spec.seed),
    uColLow: linearColor(spec.palette[0]),
    uColMid: linearColor(spec.palette[1]),
    uColHigh: linearColor(spec.palette[2]),
    // A sea level far below every height means there is no ocean.
    uOcean: spec.ocean ? [...linearColor(spec.ocean.color), spec.ocean.level] : [0, 0, 0, -10],
    uIce: spec.ice,
    uCloud: spec.clouds ? [...linearColor(spec.clouds.color), spec.clouds.cover] : [1, 1, 1, 0],
    uGlow: spec.glow ? [...linearColor(spec.glow.color), spec.glow.strength] : [0, 0, 0, 0],
    uCraters: spec.craters,
    uRelief: spec.relief,
    uBands: [spec.bands.contrast, spec.bands.turbulence, spec.bands.storms, spec.bands.wisps],
    uAtmo: spec.atmosphere
      ? [...linearColor(spec.atmosphere.color), spec.atmosphere.density]
      : [0, 0, 0, 0],
    uLight: linearColor(spec.light),
    uRing: spec.rings ? [spec.rings.inner, spec.rings.outer, 1] : [0, 0, 0],
    uMapFlags: [
      spec.maps.night || spec.second ? 1 : 0,
      spec.maps.clouds || spec.weather ? 1 : 0,
      spec.rings?.map ? 1 : 0,
      spec.ocean ? 1 : 0,
    ],
    uFlow: spec.flow,
    uJets: spec.jets,
    uZones: spec.zones,
    uLocked: spec.locked,
    uMapTurn: spec.turn,
    uMapTurn2: spec.second?.turn ?? NO_TURN,
    uWeatherTurn: spec.weather?.turn ?? NO_TURN,
    uTerrain: spec.terrain,
    uBelts: spec.belts,
    uAurora: spec.aurora ? [...linearColor(spec.aurora.color), spec.aurora.strength] : [0, 0, 0, 0],
    uLightning: spec.lightning,
    // The storms that come and go depend on time, so stormUniforms in storms.ts provides them.
    uStormSpin: spec.storms.spin,
    uPace: spec.pace,
  };
}

/** The textures of a planet, by the sampler of surface.glsl.ts that reads each. */
export interface TextureUrls {
  day: string;
  /** The city lights, or for a `terrain` its second preset, because the shader reads both from the same slot. */
  night: string | null;
  clouds: string | null;
  ring: string | null;
  /** For a `terrain`: the slopes of its preset and of its second preset. For a `map`: its relief map. */
  relief: string | null;
  relief2: string | null;
  /** The winds of a band preset, or of the weather preset or the cloud map in `clouds`. */
  flow: string | null;
}

/**
 * The maps in public/textures/planets that also come extra large, twice as wide as the large ones
 * (scripts/fetch-textures.ts). The 3D view loads them once it has zoomed in far enough to need them.
 */
export const SHARP_MAPS: ReadonlySet<string> = new Set([
  "mercury",
  "venus",
  "earth",
  "earth-night",
  "earth-clouds",
  "earth-relief",
  "mars",
  "jupiter",
  "saturn",
]);

/** The width of the large maps in pixels. */
export const LARGE_MAP_WIDTH = 2048;

/**
 * The URLs of a planet's textures. The small ones are for lists, the large ones for the 3D view, and
 * the extra-large ones for the 3D view zoomed in; a map that does not come extra large is named in
 * its large size.
 */
/**
 * Whether a planet drawn with the given radius in pixels is large enough for its extra-large maps:
 * once its circumference is two and a half times the width of the large ones. Not earlier: a built-in
 * graphics card takes twice as long for a picture of Earth when it has to read the extra-large maps
 * pixel for pixel.
 */
export function stretchesLargeMaps(radius: number): boolean {
  return 2 * Math.PI * radius > LARGE_MAP_WIDTH * 2.5;
}

export function textureUrls(spec: GlobeSpec, size: "sm" | "lg" | "xl"): TextureUrls {
  const url = (name: string | null) => {
    if (!name) return null;
    if (size !== "xl") return `/textures/planets/${name}-${size}.jpg`;
    if (!SHARP_MAPS.has(name)) return `/textures/planets/${name}-lg.jpg`;
    // Relief maps hold numbers, which WebP would blur.
    return `/textures/planets/${name}-xl.${name.endsWith("-relief") ? "jpg" : "webp"}`;
  };
  const presetSize = size === "xl" ? "lg" : size;
  const preset = (name: string) => `/textures/presets/${name}-${presetSize}.webp`;
  const relief = (name: string) => `/textures/presets/${name}-relief-${presetSize}.avif`;
  const terrain = spec.kind === "terrain";
  return {
    day: spec.kind === "map" ? (url(spec.maps.day) as string) : preset(spec.maps.day),
    night: spec.second ? preset(spec.second.map) : url(spec.maps.night),
    clouds: spec.weather ? preset(spec.weather.map) : url(spec.maps.clouds),
    ring: spec.rings?.map ? `/textures/planets/${spec.rings.map}.png` : null,
    relief: terrain ? relief(spec.maps.day) : url(spec.maps.relief),
    relief2: terrain && spec.second ? relief(spec.second.map) : null,
    // A flow map is small and smooth, so one size serves lists and the 3D view.
    flow: spec.weather
      ? `/textures/presets/${spec.weather.map}-flow.webp`
      : spec.kind === "bands"
        ? `/textures/presets/${spec.maps.day}-flow.webp`
        : spec.maps.clouds
          ? `/textures/planets/${spec.maps.clouds}-flow.webp`
          : null,
  };
}

/** What every picture of a planet needs but its spec alone decides. */
export interface SurfaceConstants {
  defines: SurfaceDefines;
  /** The key of the program built for these defines. */
  program: string;
  uniforms: SurfaceUniforms;
  urls: Record<"sm" | "lg" | "xl", TextureUrls>;
}

const constants = new WeakMap<GlobeSpec, SurfaceConstants>();

/**
 * The defines, uniforms and texture URLs of a spec, worked out once: a renderer asks for them for every
 * picture of every planet on the page. A spec must therefore not be changed once it has been drawn.
 */
export function surfaceConstants(spec: GlobeSpec): SurfaceConstants {
  let known = constants.get(spec);
  if (!known) {
    const defines = surfaceDefines(spec);
    known = {
      defines,
      program: defineLines(defines),
      uniforms: surfaceUniforms(spec),
      urls: { sm: textureUrls(spec, "sm"), lg: textureUrls(spec, "lg"), xl: textureUrls(spec, "xl") },
    };
    constants.set(spec, known);
  }
  return known;
}
