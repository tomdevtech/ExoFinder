import { hashText } from "@/shared/math";
import type { ClimateClass, PlanetClass } from "./classify";
import { mixColors, shade } from "./color";
import PRESETS from "@/app/globe/presets.json";
import { NO_TURN, type GlobeSpec, type Turn } from "@/app/globe/spec";

/** Describes how a planet looks. The still image, the animated image and the 3D globe all read it, so they show the same planet. */
export interface Appearance {
  base: string;
  /** Patches or bands drawn over the base colour from bottom to top. Only the still image uses them. */
  layers: Layer[];
  /** True for Jupiter-like bands, false for continent-like patches. */
  banded: boolean;
  /** Colour of the atmosphere rim, or null when the planet has no visible atmosphere. */
  atmosphere: string | null;
  /** Colour cast of the starlight, or null when the light is Sun-like. */
  starTint: string | null;
  rings: boolean;
  /** Seed of the procedural pattern, so the same planet always gets the same image. */
  seed: number;
  /** The same look in the detail the animated image and the 3D globe need. */
  globe: GlobeSpec;
}

export interface Layer {
  color: string;
  /** Roughly how much of the surface the layer covers, from 0 to 1. */
  coverage: number;
  opacity: number;
}

/**
 * What is known about a planet. Measured values shape the look where they exist; features nobody has
 * measured (terrain, rings, moons, aurorae) are derived from the slug, so they stay the same for each planet.
 */
export interface AppearanceInput {
  slug: string;
  source: "nasa" | "sol";
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
  starTeffK: number | null;
  /** Radius in Earth radii. Larger planets have stronger gravity and therefore get lower mountains. */
  radiusEarth: number | null;
  /** Equilibrium temperature in kelvin. It places the planet within its climate class, so a world near freezing gets more ice. */
  eqTempK: number | null;
  /** Density relative to Earth, set only when mass and radius were both measured. It tells iron, rock and water worlds apart. */
  densityEarth: number | null;
  /** Planets on short orbits are assumed to be tidally locked. */
  orbitalPeriodDays: number | null;
}

type BandLook = Pick<GlobeSpec["bands"], "contrast" | "turbulence">;

/** The globe parts that depend on the kind of planet. Parts left out get defaults. */
type Traits = Partial<Pick<GlobeSpec, "palette" | "ocean" | "clouds" | "glow" | "relief" | "aurora">> & {
  bands?: BandLook;
  density?: number;
};

type Look = Pick<Appearance, "base" | "layers" | "atmosphere"> & {
  rings?: boolean;
  traits?: Traits;
};

const layer = (color: string, coverage: number, opacity = 1): Layer => ({
  color,
  coverage,
  opacity,
});

/** Looks for rocky planets and super-Earths, chosen by climate class. */
const SOLID: Record<ClimateClass | "unknown", Look> = {
  // A shell of ice with darker, older ice in between.
  frozen: {
    base: "#c9d6e2",
    layers: [layer("#8ea4ba", 0.45), layer("#f4f8fb", 0.3)],
    atmosphere: "#cfe4ff",
    traits: { clouds: { color: "#ffffff", cover: 0.12 }, density: 0.35 },
  },
  // Dry and dusty with small polar caps, like Mars.
  cold: {
    base: "#a67c5f",
    layers: [layer("#6f5142", 0.45), layer("#e6ddd2", 0.18, 0.9)],
    atmosphere: "#e0c7b0",
    traits: { clouds: { color: "#f3e9dc", cover: 0.1 }, density: 0.35 },
  },
  // Liquid water is possible, so the planet gets oceans, land and clouds.
  temperate: {
    base: "#255a94",
    layers: [layer("#4a7a4f", 0.38), layer("#b9a37a", 0.16), layer("#ffffff", 0.3, 0.8)],
    atmosphere: "#8ec5ff",
    traits: {
      palette: ["#3f6f45", "#a8946c", "#8a8279"],
      ocean: { color: "#1c4f8a", level: 0.03 },
      clouds: { color: "#ffffff", cover: 0.5 },
      density: 1,
    },
  },
  // It is too hot for water, so the surface is desert and dust.
  hot: {
    base: "#c2905a",
    layers: [layer("#8a552c", 0.45), layer("#e6c690", 0.25)],
    atmosphere: "#f1d2a0",
    traits: { clouds: { color: "#f0dcb4", cover: 0.18 }, density: 0.6 },
  },
  // The planet is hot enough to melt rock, so a dark crust shows glowing lava.
  scorching: {
    base: "#2b1b18",
    layers: [layer("#57241a", 0.5), layer("#ff6a2a", 0.16), layer("#ffd27a", 0.05)],
    atmosphere: "#e8603a",
    traits: {
      palette: ["#14100e", "#2a1f1b", "#45322b"],
      glow: { color: "#ff5a1f", strength: 1 },
      // The vapour over molten rock is thin. Thicker, it would veil the dark ground in its own colour.
      density: 0.2,
      relief: 1.2,
    },
  },
  // Without a known temperature the planet is drawn as bare, cratered rock.
  unknown: {
    base: "#85878f",
    layers: [layer("#5d5f69", 0.45), layer("#b3b5bd", 0.2)],
    atmosphere: null,
    traits: { relief: 1.2 },
  },
};

/**
 * Band winds for the solar-system maps (GlobeSpec.jets). Jupiter has many narrow alternating jets and Saturn
 * one broad equatorial jet; on Uranus and Neptune the equatorial wind blows backwards.
 */
const NO_JETS: GlobeSpec["jets"] = [0, 0, 0, 0];
const GIANT_JETS: GlobeSpec["jets"] = [0.7, 16, 0.35, 6];
const SATURN_JETS: GlobeSpec["jets"] = [0.2, 9, 1, 5];
const ICE_GIANT_JETS: GlobeSpec["jets"] = [0.15, 6, -1, 2.5];

/** Neutral values for the globe parts that a kind of surface does not use. */
const NO_TERRAIN: GlobeSpec["terrain"] = [0, 0, 1, 0];
const NO_BELTS: GlobeSpec["belts"] = [1, 0];

/** Names of the simulated base maps. scripts/generate-presets.ts writes their metadata to presets.json. */
type Preset = keyof typeof PRESETS.terrain;
type BandPreset = keyof typeof PRESETS.bands;

/** Base maps a rocky planet can be drawn from, by climate. A name listed twice is picked twice as often. */
const TERRAIN_PRESETS: Record<ClimateClass | "unknown", readonly Preset[]> = {
  frozen: ["icecrust", "icecrust", "cratered", "basins"],
  cold: ["desert", "continents", "supercontinent", "cratered", "basins", "highlands"],
  temperate: ["continents", "archipelago", "supercontinent", "highlands"],
  hot: ["desert", "volcanic", "supercontinent", "highlands", "basins"],
  scorching: ["volcanic", "volcanic", "cratered", "basins"],
  unknown: ["cratered", "basins"],
};

/** Band presets for gas giants and Neptune-like planets, with separate lists for very hot or hazy ones. */
const GIANT_PRESETS: readonly BandPreset[] = ["bands-stormy", "bands-stormy", "bands-fine", "bands-wild", "bands-broad"];
const HOT_GIANT_PRESETS: readonly BandPreset[] = ["bands-wild", "bands-wild", "bands-stormy", "bands-fine"];
const NEPTUNE_PRESETS: readonly BandPreset[] = ["bands-calm", "bands-calm", "bands-broad", "bands-hazy", "bands-fine"];
const HAZY_NEPTUNE_PRESETS: readonly BandPreset[] = ["bands-hazy", "bands-hazy", "bands-calm", "bands-broad"];

/** Weather presets for rocky planets with seas (the `weather` list of presets.json). */
const WEATHER_PRESETS: readonly string[] = PRESETS.weather;

/** How deep the craters of each preset appear. */
const TERRAIN_CRATERS: Record<Preset, number> = {
  continents: 0.4,
  archipelago: 0.4,
  supercontinent: 0.4,
  highlands: 0.4,
  desert: 0.7,
  cratered: 1,
  basins: 0.9,
  volcanic: 0.5,
  icecrust: 0.6,
};

const STRONG_BANDS: BandLook = { contrast: 1, turbulence: 1 };

/** The colours of a gas planet at one temperature: dark belts, base colour, bright zones and the haze at the limb. */
interface GasColors {
  low: string;
  mid: string;
  high: string;
  atmosphere: string;
}

/**
 * Gas giant colours by temperature, after Sudarsky's classes. Cold giants have ammonia clouds, warmer ones water
 * clouds, then clear blue skies; hot giants turn dark because sodium and potassium absorb the light, and the
 * hottest glow under silicate clouds. Colours are interpolated between the stops.
 */
const GIANT_COLORS: [tempK: number, colors: GasColors][] = [
  [60, { low: "#9a7a52", mid: "#cdb48a", high: "#efe3c8", atmosphere: "#f0dfb8" }],
  [130, { low: "#a5673f", mid: "#d2b48c", high: "#efe3cd", atmosphere: "#f0dcbc" }],
  [220, { low: "#9fb0c4", mid: "#dfe3e6", high: "#ffffff", atmosphere: "#dfe9ff" }],
  [330, { low: "#7d95b8", mid: "#c5d2e0", high: "#f2f6fa", atmosphere: "#cfe0ff" }],
  [600, { low: "#1f3f78", mid: "#33609f", high: "#7aa6d6", atmosphere: "#8fb8f0" }],
  [1000, { low: "#1e2433", mid: "#343c52", high: "#5b6680", atmosphere: "#7f8fb5" }],
  [1500, { low: "#1f1220", mid: "#3a2030", high: "#7a4a40", atmosphere: "#ff8a4a" }],
  [2300, { low: "#160c12", mid: "#2a1418", high: "#8c3a2a", atmosphere: "#ff7a3a" }],
];

/**
 * Neptune-like colours by temperature. Methane makes cold ones blue, mild ones have water clouds, warm ones lie
 * under a pale haze and hot ones are dark.
 */
const NEPTUNE_COLORS: [tempK: number, colors: GasColors][] = [
  [60, { low: "#2a4fa8", mid: "#3b6fd6", high: "#8fc4f0", atmosphere: "#8fc4ff" }],
  [130, { low: "#3f8fae", mid: "#62b7cf", high: "#c5eef5", atmosphere: "#b5f0ff" }],
  [250, { low: "#356b93", mid: "#4d8fb8", high: "#e6f0f5", atmosphere: "#a8dcff" }],
  [450, { low: "#6f8086", mid: "#9fb0ae", high: "#d5ddd6", atmosphere: "#cfe0d8" }],
  [750, { low: "#655c9c", mid: "#8f86c4", high: "#cfc6ea", atmosphere: "#cfc0ff" }],
  [1100, { low: "#22193f", mid: "#3a2f6b", high: "#7f6aa8", atmosphere: "#b08cff" }],
  [1800, { low: "#1a1228", mid: "#2e2046", high: "#c75a8a", atmosphere: "#d98cff" }],
];

/**
 * Possible haze tints for warm Neptune-like planets, such as Titan-like tans, grey greens and slate blues.
 * The temperature cannot tell them apart, so each planet picks one.
 */
const HAZES = ["#c9ae86", "#9fb8a8", "#8ea3c4", "#b9a0c8", "#c8c3b4"];

/** Neutral colours for gas planets of unknown temperature, so the picture claims nothing that is not known. */
const UNKNOWN_GIANT: GasColors = { low: "#8a7a62", mid: "#b3a58c", high: "#ddd3c0", atmosphere: "#e6dcc8" };
const UNKNOWN_NEPTUNE: GasColors = { low: "#456886", mid: "#5f86ad", high: "#b9d0e2", atmosphere: "#a8ccee" };

/** Interpolates the colours between two temperature stops. Temperatures are compared by ratio because the stops span a wide range. */
function gasColors(stops: [tempK: number, colors: GasColors][], tempK: number): GasColors {
  const last = stops.length - 1;
  if (tempK <= stops[0][0]) return stops[0][1];
  if (tempK >= stops[last][0]) return stops[last][1];
  const upper = stops.findIndex(([temp]) => temp >= tempK);
  const [coolTemp, cool] = stops[upper - 1];
  const [hotTemp, hot] = stops[upper];
  const share = Math.log(tempK / coolTemp) / Math.log(hotTemp / coolTemp);
  return {
    low: mixColors(cool.low, hot.low, share),
    mid: mixColors(cool.mid, hot.mid, share),
    high: mixColors(cool.high, hot.high, share),
    atmosphere: mixColors(cool.atmosphere, hot.atmosphere, share),
  };
}

/** Data only the solar-system planets have: real maps and their real shape and tilt. */
interface SolarSystemLook extends Look {
  banded: boolean;
  /** Band winds, only for banded planets. */
  jets?: GlobeSpec["jets"];
  /** Axial tilt in degrees. */
  tiltDeg: number;
  /** Negative for planets that rotate backwards. */
  spin?: number;
  /** How much shorter the polar radius is than the equatorial one (1 - polar / equatorial). */
  flattening?: number;
  /** Whether a night map with city lights exists. */
  night?: boolean;
  /** Whether a separate cloud map exists. */
  cloudMap?: boolean;
  /** Whether a map of the slopes and seas exists. */
  reliefMap?: boolean;
}

/** Solar-system planets get their real colours and surface maps instead of the generic rules. Keyed by slug. */
const SOLAR_SYSTEM: Record<string, SolarSystemLook> = {
  mercury: {
    base: "#8f8a85",
    layers: [layer("#6a6560", 0.45), layer("#b5afa8", 0.2)],
    atmosphere: null,
    banded: false,
    tiltDeg: 0,
    traits: { relief: 1.5 },
  },
  venus: {
    base: "#d9b77a",
    layers: [layer("#c49a58", 0.45), layer("#f0deb0", 0.3)],
    atmosphere: "#f5e2b0",
    banded: true,
    tiltDeg: 3,
    spin: -0.6,
    traits: { density: 1, relief: 0 },
  },
  earth: {
    base: "#1f4f8f",
    layers: [layer("#3f7a48", 0.36), layer("#b39b6e", 0.14), layer("#ffffff", 0.32, 0.85)],
    atmosphere: "#7fbaff",
    banded: false,
    tiltDeg: 23.4,
    night: true,
    cloudMap: true,
    reliefMap: true,
    traits: {
      ocean: { color: "#1f4f8f", level: 0 },
      density: 1,
      relief: 0.8,
      aurora: { color: "#58f29a", strength: 0.6 },
    },
  },
  mars: {
    base: "#b5532f",
    layers: [layer("#7c3320", 0.42), layer("#dc9a70", 0.2)],
    atmosphere: "#e8b090",
    banded: false,
    tiltDeg: 25.2,
    // Mars has thin water-ice clouds that the ground map does not show.
    traits: { density: 0.3, relief: 1.2, clouds: { color: "#f4ece6", cover: 0.4 } },
  },
  jupiter: {
    base: "#d2b48c",
    layers: [layer("#a5673f", 0.42), layer("#efe3cd", 0.32)],
    atmosphere: "#f0dcbc",
    banded: true,
    jets: GIANT_JETS,
    tiltDeg: 3.1,
    spin: 1.4,
    flattening: 0.065,
    traits: { density: 0.5, relief: 0, aurora: { color: "#b070ff", strength: 0.8 } },
  },
  saturn: {
    base: "#dcc592",
    layers: [layer("#bfa26a", 0.4), layer("#f1e6c6", 0.3)],
    atmosphere: "#f3e6c0",
    banded: true,
    jets: SATURN_JETS,
    rings: true,
    tiltDeg: 26.7,
    spin: 1.4,
    flattening: 0.098,
    traits: { density: 0.5, relief: 0, aurora: { color: "#b070ff", strength: 0.6 } },
  },
  uranus: {
    base: "#a6dfe3",
    layers: [layer("#8fd0d6", 0.4, 0.7), layer("#c9f0f2", 0.2, 0.6)],
    atmosphere: "#c9f6ff",
    banded: true,
    jets: ICE_GIANT_JETS,
    // Uranus lies on its side.
    tiltDeg: 82,
    spin: -1,
    flattening: 0.023,
    traits: { density: 0.6, relief: 0 },
  },
  neptune: {
    base: "#3558c9",
    layers: [layer("#2742a0", 0.42), layer("#7fa6f0", 0.16, 0.8)],
    atmosphere: "#86aaff",
    banded: true,
    jets: ICE_GIANT_JETS,
    tiltDeg: 28.3,
    flattening: 0.017,
    traits: { density: 0.6, relief: 0 },
  },

  // The moons and dwarf planets of src/app/solar-system/bodies.ts. The colours only serve the still image
  // and the size comparison; the 3D model shows each body's real map.
  moon: airless("#8b8680", "#5e5b57", "#b0aba4"),
  io: airless("#d8c46a", "#9a7a3a", "#f2ead0", 0.8),
  europa: airless("#c9b9a0", "#8c6e52", "#ebe4d8", 0.6),
  ganymede: airless("#8e8478", "#5f574e", "#c4bcb0"),
  callisto: airless("#6e6458", "#4a4038", "#a39a8c"),
  mimas: airless("#a9a49e", "#7f7a74", "#cfcac4"),
  enceladus: airless("#e8ecee", "#c6ced2", "#ffffff", 0.8),
  tethys: airless("#d8d6d0", "#b0ada6", "#efede8"),
  dione: airless("#c9c6c0", "#9d9a94", "#e6e3de"),
  rhea: airless("#bdb9b2", "#94908a", "#dddad4"),
  // Titan's haze hides the ground in visible light, so the model shows the haze, as a camera would.
  titan: {
    base: "#d29a4e",
    layers: [layer("#b47a38", 0.4), layer("#e6b66c", 0.3)],
    atmosphere: "#e0a654",
    banded: false,
    tiltDeg: 0,
    traits: { density: 1, relief: 0 },
  },
  iapetus: airless("#8f8270", "#2e2620", "#e8e4dc"),
  miranda: airless("#a8a5a0", "#7d7a76", "#cac7c2"),
  ariel: airless("#b4b0aa", "#8a8680", "#d6d2cc"),
  umbriel: airless("#6e6b67", "#4e4b48", "#8e8b86"),
  titania: airless("#a8a39c", "#7e7972", "#cbc6bf"),
  oberon: airless("#8f8780", "#665e58", "#b0a9a2"),
  triton: airless("#c9b8a8", "#a08e80", "#e8ddd2", 0.8),
  charon: airless("#9a9088", "#6e5550", "#b8b0a8"),
  ceres: airless("#6a665f", "#4c4944", "#9a958c"),
  vesta: airless("#9a948c", "#6d6760", "#c9c3ba"),
  phobos: airless("#5b5651", "#403c38", "#7d7770"),
  deimos: airless("#6f6861", "#4f4944", "#8f8880"),
  hyperion: airless("#a8957d", "#5f5143", "#cdbda6"),
  // The small moons near the rings are coated in bright ring dust; Phoebe is as dark as coal.
  pan: airless("#c9c3b8", "#9a948a", "#e3ded5"),
  daphnis: airless("#c9c3b8", "#9a948a", "#e3ded5"),
  atlas: airless("#c9c3b8", "#9a948a", "#e3ded5"),
  prometheus: airless("#c2bcb1", "#938d84", "#ded9d0"),
  pandora: airless("#c2bcb1", "#938d84", "#ded9d0"),
  epimetheus: airless("#bdb7ad", "#8e8880", "#dad5cc"),
  janus: airless("#bdb7ad", "#8e8880", "#dad5cc"),
  telesto: airless("#d6d2cb", "#aaa59d", "#eeebe6"),
  calypso: airless("#dbd8d2", "#b0aca5", "#f1efea"),
  helene: airless("#d3cfc8", "#a7a29a", "#ebe8e2"),
  phoebe: airless("#4f4a44", "#36322e", "#6f6962"),
  pluto: airless("#c9a789", "#7a4a35", "#efe6da", 0.8),
};

/** An airless body with a real map: dark ground, base colour and bright ground. */
function airless(base: string, dark: string, bright: string, relief = 1.2): SolarSystemLook {
  return {
    base,
    layers: [layer(dark, 0.4), layer(bright, 0.25)],
    atmosphere: null,
    banded: false,
    tiltDeg: 0,
    traits: { relief },
  };
}

/** Saturn's main rings span 1.24 to 2.27 planet radii. */
const SATURN_RINGS = { inner: 1.24, outer: 2.27, map: "saturn-ring" };

/** Cool stars shine reddish and hot stars bluish; Sun-like light stays neutral (null). */
function starTint(teffK: number | null): string | null {
  if (teffK === null) return null;
  if (teffK < 3700) return "#ff6a3a";
  if (teffK < 4800) return "#ffa25e";
  if (teffK > 7500) return "#9cc0ff";
  return null;
}

/**
 * Assumed vegetation colour by stellar temperature. Plants reflect the light they do not use, so they would be
 * near-black under red dwarfs, green under Sun-like stars and teal to blue under hot stars. This is speculative
 * but follows published studies.
 */
const PLANT_COLORS: [teffK: number, color: string][] = [
  [2600, "#2b2024"],
  [3700, "#3a2d2a"],
  [4800, "#4f5a2c"],
  [5800, "#3f6f45"],
  [6800, "#2f6c62"],
  [8000, "#34588a"],
];

function plantColor(teffK: number | null): string {
  if (teffK === null) return "#3f6f45";
  const last = PLANT_COLORS.length - 1;
  if (teffK <= PLANT_COLORS[0][0]) return PLANT_COLORS[0][1];
  if (teffK >= PLANT_COLORS[last][0]) return PLANT_COLORS[last][1];
  const upper = PLANT_COLORS.findIndex(([teff]) => teff >= teffK);
  const [coolTeff, cool] = PLANT_COLORS[upper - 1];
  const [hotTeff, hot] = PLANT_COLORS[upper];
  return mixColors(cool, hot, (teffK - coolTeff) / (hotTeff - coolTeff));
}

/** Starlight colour for the 3D globe. It is paler than the tint so that surface colours stay readable. */
function starLight(teffK: number | null): string {
  if (teffK === null) return "#ffffff";
  if (teffK < 3700) return "#ffe2d2";
  if (teffK < 4800) return "#ffeee0";
  if (teffK > 7500) return "#edf2ff";
  return "#ffffff";
}

/** Rounds to four decimals, which is finer than any pixel and keeps the serialised spec small. */
const round = (value: number) => Math.round(value * 10000) / 10000;

/** Rotation about the polar axis by an angle; passing -1 mirrors east-west or north-south. */
function axisTurn(angle: number, mirrorEast: number, mirrorNorth: number): Turn {
  const c = round(Math.cos(angle));
  const s = round(Math.sin(angle));
  return [mirrorEast * c, 0, -s, 0, mirrorNorth, 0, mirrorEast * s, 0, c];
}

/** Uniformly distributed random rotation from three numbers between 0 and 1 (Shoemake's method); passing -1 mirrors it. */
function freeTurn(u1: number, u2: number, u3: number, mirror: number): Turn {
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  const x = a * Math.sin(2 * Math.PI * u2);
  const y = a * Math.cos(2 * Math.PI * u2);
  const z = b * Math.sin(2 * Math.PI * u3);
  const w = b * Math.cos(2 * Math.PI * u3);
  return [
    mirror * (1 - 2 * (y * y + z * z)),
    2 * (x * y + z * w),
    2 * (x * z - y * w),
    mirror * 2 * (x * y - z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z + x * w),
    mirror * 2 * (x * z + y * w),
    2 * (y * z - x * w),
    1 - 2 * (x * x + y * y),
  ].map(round) as Turn;
}

const NO_STORMS: GlobeSpec["storms"] = { cyclones: 0, dust: 0, spin: 0, outbreaks: 0 };

/** Builds the globe spec of a look. Features only some planets have start switched off, and the caller sets them. */
function globe(
  look: Look,
  rest: Pick<GlobeSpec, "kind" | "seed" | "light" | "rings" | "tiltDeg" | "spin" | "maps" | "flow" | "jets" | "turn" | "zones" | "flattening">,
): GlobeSpec {
  const traits = look.traits ?? {};
  return {
    palette: traits.palette ?? [look.layers[0].color, look.base, look.layers[1].color],
    ocean: traits.ocean ?? null,
    ice: 0,
    clouds: traits.clouds ?? null,
    glow: traits.glow ?? null,
    aurora: traits.aurora ?? null,
    lightning: 0,
    storms: NO_STORMS,
    craters: 0,
    relief: traits.relief ?? 1,
    bands: { ...(traits.bands ?? STRONG_BANDS), storms: 0, wisps: 0 },
    atmosphere: look.atmosphere
      ? { color: look.atmosphere, density: traits.density ?? 0.7 }
      : null,
    moon: null,
    locked: 0,
    pace: 1,
    second: null,
    weather: null,
    terrain: NO_TERRAIN,
    belts: NO_BELTS,
    ...rest,
  };
}

/** How firmly a planet is tidally locked: 1 for orbits up to 12 days, 0 from 30 days on, linear in between. */
function tidalLock(orbitalPeriodDays: number | null): number {
  if (orbitalPeriodDays === null) return 0;
  return round(Math.min(1, Math.max(0, (30 - orbitalPeriodDays) / 18)));
}

/**
 * Estimates the bulk composition from mass and radius. A rocky planet's radius is about mass^0.27 in Earth units;
 * a clearly smaller planet is iron-rich, and a clearly larger one holds much water or ice.
 */
function composition(densityEarth: number | null, radiusEarth: number | null): "iron" | "rock" | "water" {
  if (densityEarth === null || radiusEarth === null) return "rock";
  const rockRadius = (densityEarth * radiusEarth ** 3) ** 0.27;
  const swollen = radiusEarth / rockRadius;
  return swollen < 0.9 ? "iron" : swollen > 1.15 ? "water" : "rock";
}

/** Derives the look of a planet from what is known about it and about its star. */
export function planetAppearance(input: AppearanceInput): Appearance {
  const seed = (hashText(input.slug) % 9973) + 1;

  const sol = input.source === "sol" ? SOLAR_SYSTEM[input.slug] : undefined;
  if (sol) {
    const solGlobe = globe(sol, {
      kind: "map",
      seed,
      light: "#ffffff",
      rings: sol.rings ? SATURN_RINGS : null,
      tiltDeg: sol.tiltDeg,
      spin: sol.spin ?? 1,
      flattening: sol.flattening ?? 0,
      flow: input.slug === "venus" ? 2 : sol.banded ? 1 : 0,
      jets: sol.jets ?? NO_JETS,
      turn: NO_TURN,
      zones: 1,
      maps: {
        day: input.slug,
        night: sol.night ? `${input.slug}-night` : null,
        clouds: sol.cloudMap ? `${input.slug}-clouds` : null,
        relief: sol.reliefMap ? `${input.slug}-relief` : null,
      },
    });
    return {
      base: sol.base,
      layers: sol.layers,
      atmosphere: sol.atmosphere,
      banded: sol.banded,
      rings: sol.rings ?? false,
      starTint: null,
      seed,
      // Mars has dust storms that can cover the whole planet.
      globe: input.slug === "mars" ? { ...solGlobe, storms: { ...NO_STORMS, dust: 1 } } : solGlobe,
    };
  }

  const climate = input.climateClass ?? "unknown";
  const gaseous =
    input.planetClass === "gas_giant" || input.planetClass === "neptune_like";

  // Features nobody has measured are derived from the slug, so each planet always looks the same.
  const chance = (what: string) => (hashText(`${input.slug}/${what}`) % 10000) / 10000;
  const pick = <T,>(what: string, from: readonly T[]): T =>
    from[Math.floor(chance(what) * from.length)];
  // Every planet shifts its hue, saturation and lightness a little, so no two look quite alike.
  const hue = (chance("hue") - 0.5) * 30;
  const saturation = 1 + (chance("saturation") - 0.5) * 0.4;
  const lightness = (chance("lightness") - 0.5) * 0.08;
  const own = (color: string) => shade(color, { hue, saturation, lightness });

  const locked = tidalLock(input.orbitalPeriodDays);
  // The real axial tilt is unknown, so each planet gets one between 0 and 30 degrees.
  // A tidally locked planet stands upright.
  let tiltDeg = ((hashText(`${input.slug}/tilt`) % 300) / 10) * (1 - locked);
  // A tilted axis brings seasons, which soften the climate zones and shrink the ice caps.
  const upright = 1 - tiltDeg / 30;
  const warmth = climateWarmth(climate, input.eqTempK);
  // Red dwarfs flare, and their particle storms strengthen the aurorae of their planets.
  const flaring = input.starTeffK !== null && input.starTeffK < 4000;
  const light = starLight(input.starTeffK);

  if (gaseous) {
    const giant = input.planetClass === "gas_giant";
    const tempK = input.eqTempK;
    const measured =
      tempK === null
        ? giant
          ? UNKNOWN_GIANT
          : UNKNOWN_NEPTUNE
        : gasColors(giant ? GIANT_COLORS : NEPTUNE_COLORS, tempK);
    // Warm Neptune-like planets are veiled in haze that hides the belts and sets the colour.
    const hazy = !giant && tempK !== null && tempK > 350 && tempK < 900;
    const haze = pick("haze", HAZES);
    const veiled = (color: string, share: number) => own(hazy ? mixColors(color, haze, share) : color);
    const colors: GasColors = {
      low: veiled(measured.low, 0.45),
      mid: veiled(measured.mid, 0.6),
      high: veiled(measured.high, 0.5),
      atmosphere: veiled(measured.atmosphere, 0.5),
    };
    const preset = pick(
      "preset",
      giant
        ? tempK !== null && tempK > 1000
          ? HOT_GIANT_PRESETS
          : GIANT_PRESETS
        : hazy
          ? HAZY_NEPTUNE_PRESETS
          : NEPTUNE_PRESETS,
    );
    // Giants start to glow by themselves at about 900 K, dull red at first and more orange the hotter they are.
    const heat = tempK === null ? 0 : Math.min(1, Math.max(0, (tempK - 900) / 1500));
    const glow =
      heat > 0
        ? {
            color: giant ? mixColors("#e0401a", "#ffa040", heat) : mixColors("#a8306a", "#e0609a", heat),
            strength: round(0.1 + 0.75 * heat),
          }
        : null;
    // Rings and moons do not survive close to the star, and locked planets spin too slowly to flatten.
    const free = locked < 0.5;
    const cool = tempK === null || tempK < 300;
    const ringed = free && chance("rings") < (cool ? 0.22 : 0.06);
    const inner = 1.25 + 0.3 * chance("rings/inner");
    if (ringed) tiltDeg = Math.max(tiltDeg, 12);
    const moon = free && !ringed && chance("moon") < 0.3;
    // Reuse the winds the preset was simulated with, so the clouds keep drifting along the streaks they were drawn with.
    const winds = PRESETS.bands[preset];
    // The star drives the winds: the hotter the planet, the faster they blow, from three quarters of the usual
    // pace at 100 K to over one and a half times at 2000 K. A hot planet held by its star also has one fast
    // stream round its equator, as the hot Jupiters whose winds were measured do.
    const stirred = tempK === null ? null : Math.min(1, Math.max(0, Math.log(tempK / 100) / Math.log(20)));
    // How lively the weather of a Neptune-like planet is, is drawn by lot: some stay as calm as Uranus looks, others
    // show more streaks and whirls that turn faster. Under a veil of haze less of it shows.
    const lively = giant ? 0 : chance("lively") ** 1.5 * (hazy ? 0.5 : 1);
    const pace = round((stirred === null ? 1 : 0.75 + 0.85 * stirred) * (1 + 0.3 * lively));
    const stream = locked * (stirred ?? 0);
    const look: Look = {
      base: colors.mid,
      layers: [layer(colors.low, 0.45), layer(colors.high, giant ? 0.3 : 0.2, giant ? 1 : 0.8)],
      atmosphere: colors.atmosphere,
      traits: {
        glow,
        bands: {
          contrast: round((giant ? 0.8 + 0.3 * chance("contrast") : 0.45 + 0.25 * chance("contrast")) * (hazy ? 0.6 : 1)),
          turbulence: round(giant ? 0.7 + 0.3 * chance("streaks") : 0.55 + 0.2 * chance("streaks") + 0.45 * lively),
        },
        aurora:
          chance("aurora") < 0.35
            ? {
                color: mixColors("#b070ff", "#ff6aa0", chance("aurora/colour")),
                strength: round((flaring ? 0.7 : 0.4) + 0.4 * chance("aurora/strength")),
              }
            : null,
      },
    };
    const bands = globe(look, {
      kind: "bands",
      seed,
      light,
      rings: ringed ? { inner: round(inner), outer: round(inner + 0.45 + 0.5 * chance("rings/outer")), map: null } : null,
      tiltDeg,
      // A tidally locked giant does not rotate, but its winds still carry the clouds round at about half speed.
      spin: round(1.3 * (1 - 0.5 * locked)),
      flattening: round((giant ? 0.03 + 0.07 * chance("flattening") : 0.01 + 0.03 * chance("flattening")) * (1 - locked)),
      maps: { day: preset, night: null, clouds: null, relief: null },
      flow: 1,
      jets: [round(winds.strength * (1 - 0.4 * stream)), winds.count, round(winds.equator * (1 + stream)), winds.narrowness],
      turn: axisTurn(chance("turn") * Math.PI * 2, chance("mirror-x") < 0.5 ? -1 : 1, chance("mirror-y") < 0.5 ? -1 : 1),
      zones: 1,
    });
    return {
      base: look.base,
      layers: look.layers,
      atmosphere: look.atmosphere,
      banded: true,
      rings: ringed,
      starTint: starTint(input.starTeffK),
      seed,
      globe: {
        ...bands,
        locked,
        pace,
        bands: { ...bands.bands, storms: round(0.4 + 0.6 * chance("storms")), wisps: giant ? 0 : round(0.15 + 0.85 * lively) },
        // The belts cover between two thirds and all of the latitudes.
        belts: [round(0.64 + 0.36 * chance("belts")), winds.phase],
        // Lightning needs water clouds, which the hottest giants lack.
        lightning: (tempK === null || tempK < 1500) && chance("lightning") < 0.35 ? round(0.4 + 0.6 * chance("lightning/rate")) : 0,
        // The preset's storms and turbulence keep moving, and now and then fresh cloud wells up and is drawn out along its band, as on Saturn.
        storms: {
          ...NO_STORMS,
          spin: round((0.7 + 0.3 * chance("storms/spin")) * (1 + 0.4 * lively)),
          outbreaks: (tempK === null || tempK < 1500) && chance("outbreaks") < 0.45 ? round(0.5 + 0.5 * chance("outbreaks/rate")) : 0,
        },
        moon: moon
          ? {
              size: round(0.04 + 0.06 * chance("moon/size")),
              distance: round(1.2 + 0.15 * chance("moon/distance")),
              period: round(14 + 20 * chance("moon/period")),
              phase: round(chance("moon/phase") * Math.PI * 2),
            }
          : null,
      },
    };
  }

  const made = composition(input.densityEarth, input.radiusEarth);
  const solid = SOLID[climate];
  // Iron worlds are darker and greyer than rocky ones.
  const rock = (color: string) =>
    made === "iron" ? shade(own(color), { saturation: 0.5, lightness: -0.06 }) : own(color);
  const plants = climate === "temperate" ? plantColor(input.starTeffK) : null;
  const traits = solid.traits ?? {};
  const palette: GlobeSpec["palette"] = traits.palette
    ? [plants ?? rock(traits.palette[0]), rock(traits.palette[1]), rock(traits.palette[2])]
    : [rock(solid.layers[0].color), rock(solid.base), rock(solid.layers[1].color)];
  const look: Look = {
    // Seas of temperate worlds and lava of scorching ones keep their own colours.
    base: climate === "temperate" ? own(solid.base) : rock(solid.base),
    layers: solid.layers.map((item, index) => ({
      ...item,
      color:
        index === 0 && plants
          ? plants
          : climate === "scorching" && index > 0
            ? item.color
            : rock(item.color),
    })),
    atmosphere: solid.atmosphere && own(solid.atmosphere),
    traits: {
      ...traits,
      palette,
      ocean: traits.ocean && { ...traits.ocean, color: own(traits.ocean.color) },
    },
  };

  const list = TERRAIN_PRESETS[climate];
  // Water-rich cold worlds freeze into an ice shell.
  const preset = made === "water" && (climate === "cold" || climate === "frozen") ? "icecrust" : pick("preset", list);
  const others = list.filter((name) => name !== preset);
  const second = others.length > 0 ? pick("second", others) : null;
  const base = globe(look, {
    kind: "terrain",
    seed,
    light,
    rings: null,
    tiltDeg,
    spin: round(1 - locked),
    flattening: 0,
    maps: { day: preset, night: null, clouds: null, relief: null },
    flow: 0,
    jets: NO_JETS,
    turn: freeTurn(chance("turn"), chance("turn/2"), chance("turn/3"), chance("mirror") < 0.5 ? -1 : 1),
    // A tidally locked planet keeps the same climate at every place, so its zones stay fixed.
    zones: round(locked + (1 - locked) * (0.4 + 0.6 * upright)),
  });
  // Higher surface gravity on larger planets means lower mountains.
  const radius = input.radiusEarth ?? 1;
  const relief = Math.min(1.3, Math.max(0.6, 1.25 - 0.35 * (radius - 1)));
  const icy = preset === "icecrust";
  // Lava runs in rivers where the ground is steep and floods the plains where gravity has flattened
  // it, so a small planet shows more rivers and a large one wider seas.
  const steep = (relief - 0.6) / 0.7;
  const lavaRivers = round(Math.min(1, 0.25 + 0.45 * steep + 0.3 * chance("lava/rivers")));
  // The height below which the given share of the surface lies, averaged over both presets.
  const levelAt = (share: number) =>
    round(second ? (presetLevel(preset, share) + presetLevel(second, share)) / 2 : presetLevel(preset, share));
  const level =
    climate === "scorching"
      ? // Depending on temperature, lava fills anything from the deepest basins to two thirds of the surface.
        levelAt(0.1 + 0.4 * warmth + 0.1 * chance("lava") + 0.1 * (1 - steep))
      : climate === "temperate" || icy
        ? 0
        : levelAt(0.15 + 0.25 * chance("basins"));
  const cool = 1 - warmth;
  // Ice caps shrink as the planet gets warmer. On a tidally locked planet the ice covers the night side instead.
  const caps =
    climate === "temperate"
      ? 0.04 + 0.2 * cool
      : climate === "cold"
        ? 0.1 + 0.22 * cool
        : climate === "frozen"
          ? 0.24 + 0.2 * cool
          : 0;
  const nightIce = climate === "temperate" ? 0.42 + 0.14 * cool : climate === "cold" ? 0.52 + 0.1 * cool : caps;
  const ice = caps * (0.65 + 0.5 * upright) * (1 - locked) + nightIce * locked;
  // Hot water worlds lie under a deck of steam.
  const steamy = made === "water" && climate === "hot";
  const cover = steamy
    ? 0.85
    : climate === "temperate"
      ? 0.4 + 0.2 * warmth
      : climate === "cold"
        ? 0.05 + 0.1 * warmth
        : climate === "frozen"
          ? 0.06 + 0.1 * warmth
          : climate === "hot"
            ? 0.1 + 0.16 * warmth
            : 0;
  const glow =
    climate === "scorching"
      ? // Freshly melted rock glows red, and hotter lava glows orange.
        { color: mixColors("#e0401a", "#ffa040", warmth), strength: round(0.7 + 0.5 * warmth) }
      : climate === "hot" && warmth > 0.7
        ? // Near rock's melting point the lowest plains start to glow.
          { color: "#ff5a1f", strength: round(((warmth - 0.7) / 0.3) * 0.4) }
        : null;
  // Warmer worlds lock less water in ice, so their seas stand higher. Water worlds are nearly all sea.
  const sea =
    made === "water"
      ? 0.93 + 0.06 * chance("sea")
      : Math.min(0.9, Math.max(0.3, 0.45 + 0.4 * chance("sea") + (warmth - 0.5) * 0.12));
  const free = locked < 0.5;
  const moon = free && chance("moon") < 0.15;
  const aurora =
    base.atmosphere && chance("aurora") < (flaring ? 0.7 : 0.3)
      ? {
          // Aurorae are oxygen green where plants could grow, otherwise pink or blue from other gases.
          color: plants ? "#58f29a" : mixColors("#7fd0ff", "#ff8ad0", chance("aurora/colour")),
          strength: round((flaring ? 0.8 : 0.45) + 0.4 * chance("aurora/strength")),
        }
      : null;
  return {
    base: look.base,
    layers: look.layers,
    atmosphere: look.atmosphere,
    banded: false,
    rings: false,
    starTint: starTint(input.starTeffK),
    seed,
    globe: {
      ...base,
      locked,
      second: second && {
        map: second,
        turn: freeTurn(chance("second/turn"), chance("second/turn/2"), chance("second/turn/3"), chance("second/mirror") < 0.5 ? -1 : 1),
      },
      // The weather presets follow the latitudes, so they only fit a planet with days and nights. A
      // locked one keeps its computed clouds, which gather under the star.
      weather:
        base.ocean && base.clouds && locked < 0.5
          ? { map: pick("weather", WEATHER_PRESETS), turn: axisTurn(chance("weather/turn") * Math.PI * 2, 1, chance("weather/mirror") < 0.5 ? -1 : 1) }
          : null,
      ice: round(ice),
      clouds: base.clouds && { ...base.clouds, cover: round(cover) },
      atmosphere:
        base.atmosphere && steamy
          ? { ...base.atmosphere, density: 1 }
          : base.atmosphere && climate === "scorching"
            ? // A large planet holds more of the smoke and vapour that rise from its lava.
              { ...base.atmosphere, density: round(0.1 + 0.07 * (1 - steep) + 0.13 * chance("lava/smoke")) }
            : base.atmosphere,
      glow,
      aurora,
      storms: {
        ...NO_STORMS,
        // Cyclones feed on warm sea, so warmer oceans get more of them.
        cyclones: base.ocean ? round(0.45 + 0.5 * warmth) : 0,
        // Wind lifts dust where there is air but no water to hold the ground.
        dust:
          !base.ocean && !icy && climate !== "scorching" && base.atmosphere && base.atmosphere.density >= 0.15 && !steamy
            ? round(0.4 + 0.6 * chance("dust"))
            : 0,
      },
      ocean: base.ocean && { ...base.ocean, level: levelAt(sea) },
      craters: round(Math.min(1, TERRAIN_CRATERS[preset] * (climate === "temperate" ? 0.4 : 1) * (made === "iron" ? 1.3 : 1))),
      terrain: [
        level,
        climate === "temperate" ? 1 : climate === "cold" || climate === "hot" ? 0.7 : climate === "scorching" ? lavaRivers : 0,
        round(relief * (icy ? 0.6 : 1)),
        icy ? 1 : 0,
      ],
      moon: moon
        ? {
            size: round(0.08 + 0.12 * chance("moon/size")),
            distance: round(1.22 + 0.15 * chance("moon/distance")),
            period: round(14 + 20 * chance("moon/period")),
            phase: round(chance("moon/phase") * Math.PI * 2),
          }
        : null,
    },
  };
}

/** Temperature range in kelvin of each climate class (see classify.ts), with assumed bounds for the open-ended classes. */
const CLIMATE_RANGE: Record<ClimateClass, [number, number]> = {
  frozen: [50, 150],
  cold: [150, 250],
  temperate: [250, 350],
  hot: [350, 1000],
  scorching: [1000, 2500],
};

/**
 * Where a temperature lies within its climate class: 0 at the cold end, 1 at the hot end and 0.5 if unknown.
 * The wide "hot" range is measured by temperature ratio.
 */
function climateWarmth(climate: ClimateClass | "unknown", eqTempK: number | null): number {
  if (climate === "unknown" || eqTempK === null) return 0.5;
  const [low, high] = CLIMATE_RANGE[climate];
  const share =
    climate === "hot"
      ? Math.log(eqTempK / low) / Math.log(high / low)
      : (eqTempK - low) / (high - low);
  return Math.min(1, Math.max(0, share));
}

/** Returns the height (0 to 1) below which the given share of a preset's surface lies. */
function presetLevel(preset: Preset, share: number): number {
  const levels = PRESETS.terrain[preset].levels;
  const at = Math.min(0.9999, Math.max(0, share)) * (levels.length - 1);
  const index = Math.floor(at);
  return levels[index] + (levels[index + 1] - levels[index]) * (at - index);
}
