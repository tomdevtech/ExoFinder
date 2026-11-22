import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { planetAppearance } from "@/app/planets/appearance";
import {
  globeRadius,
  globeRotation,
  lightDirection,
  linearColor,
  lockedSway,
  moonPosition,
  seedOffset,
  type GlobeSpec,
} from "@/app/globe/spec";
import {
  ALL_SURFACE_DEFINES,
  defineLines,
  LARGE_MAP_WIDTH,
  SHARP_MAPS,
  stretchesLargeMaps,
  surfaceConstants,
  surfaceDefines,
  surfaceUniforms,
  textureUrls,
} from "@/app/globe/uniforms";

function globe(slug: string, source: "nasa" | "sol" = "sol"): GlobeSpec {
  return planetAppearance({
    slug,
    source,
    planetClass: "rocky",
    climateClass: "temperate",
    starTeffK: 5772,
    radiusEarth: null,
    eqTempK: null,
    densityEarth: null,
    orbitalPeriodDays: null,
  }).globe;
}

/** Applies a 3x3 rotation, given row by row, to a direction. */
function turn(matrix: number[], [x, y, z]: number[]): number[] {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

describe("linearColor", () => {
  it("maps black and white to the ends of the range", () => {
    expect(linearColor("#000000")).toEqual([0, 0, 0]);
    expect(linearColor("#ffffff")).toEqual([1, 1, 1]);
  });

  it("reads the three channels in the order red, green, blue", () => {
    const [red, green, blue] = linearColor("#ff8000");
    expect(red).toBe(1);
    expect(green).toBeCloseTo((128 / 255) ** 2.2, 9);
    expect(blue).toBe(0);
  });
});

describe("seedOffset", () => {
  it("gives different seeds different places in the noise", () => {
    expect(seedOffset(12)).toEqual(seedOffset(12));
    expect(seedOffset(12)).not.toEqual(seedOffset(13));
  });
});

describe("globeRadius", () => {
  it("shrinks a ringed planet so that its rings fit into the picture", () => {
    const earth = globe("earth");
    const saturn = globe("saturn");
    expect(globeRadius(earth)).toBe(0.84);
    expect(saturn.rings).not.toBeNull();
    expect(globeRadius(saturn) * saturn.rings!.outer).toBeCloseTo(0.84, 9);
  });

  it("leaves room for a moon", () => {
    const moon = { size: 0.1, distance: 1.3, period: 20, phase: 0 };
    expect(globeRadius({ ...globe("earth"), moon }) * 1.4).toBeCloseTo(0.84, 9);
  });
});

describe("moonPosition", () => {
  const moon = { size: 0.1, distance: 1.3, period: 20, phase: 0.4 };

  it("keeps the moon on its orbit and brings it back after one round", () => {
    const spec = { ...globe("earth"), moon };
    for (const seconds of [0, 3, 11.5]) {
      expect(Math.hypot(...moonPosition(spec, seconds)!)).toBeCloseTo(1.3, 9);
    }
    const start = moonPosition(spec, 0)!;
    moonPosition(spec, 20)!.forEach((value, i) => expect(value).toBeCloseTo(start[i], 9));
    expect(moonPosition(spec, 5)![0]).not.toBeCloseTo(start[0], 3);
  });

  it("lays the orbit above the equator of the planet", () => {
    const spec = { ...globe("earth"), moon };
    // The axis as the viewer sees it is the middle column of the rotation matrix.
    const rotation = globeRotation(spec, 0);
    const axis = [rotation[1], rotation[4], rotation[7]];
    const position = moonPosition(spec, 7)!;
    expect(axis[0] * position[0] + axis[1] * position[1] + axis[2] * position[2]).toBeCloseTo(0, 9);
  });

  it("is nothing without a moon", () => {
    expect(moonPosition(globe("earth"), 3)).toBeNull();
  });
});

describe("lockedSway", () => {
  it("swings the view around a planet that cannot turn, and leaves the others alone", () => {
    const free = globe("some-b", "nasa");
    const held = { ...free, locked: 1 };
    expect(lockedSway(free, 13)).toBe(0);
    // The clouds of a gas planet circle it whether it is locked or not, so there is nothing to sway.
    expect(lockedSway({ ...held, kind: "bands" }, 13)).toBe(0);
    const angles = Array.from({ length: 200 }, (_, second) => lockedSway(held, second));
    expect(Math.max(...angles)).toBeGreaterThan(0.6);
    expect(Math.min(...angles)).toBeLessThan(-0.6);
    // The sway must never go so far that the viewer sees only the night side.
    for (const angle of angles) expect(Math.abs(angle)).toBeLessThan(1);
  });
});

describe("globeRotation", () => {
  it("only turns: lengths and right angles stay", () => {
    const m = globeRotation(globe("earth"), 12.3, 0.4, -0.2);
    const rows = [m.slice(0, 3), m.slice(3, 6), m.slice(6, 9)];
    for (const row of rows) expect(Math.hypot(...row)).toBeCloseTo(1, 9);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(rows[0], rows[1])).toBeCloseTo(0, 9);
    expect(dot(rows[0], rows[2])).toBeCloseTo(0, 9);
    expect(dot(rows[1], rows[2])).toBeCloseTo(0, 9);
  });

  it("spins the planet around its axis, which stays where it is", () => {
    const spec = globe("earth");
    const now = globeRotation(spec, 0);
    const later = globeRotation(spec, 7);
    const axisNow = turn(now, [0, 1, 0]);
    const axisLater = turn(later, [0, 1, 0]);
    axisNow.forEach((value, i) => expect(axisLater[i]).toBeCloseTo(value, 9));
    expect(turn(later, [1, 0, 0])[0]).not.toBeCloseTo(turn(now, [1, 0, 0])[0], 3);
  });

  it("is back where it started after one turn", () => {
    const spec = { ...globe("earth"), spin: 1 };
    const start = globeRotation(spec, 0);
    const end = globeRotation(spec, 40);
    start.forEach((value, i) => expect(end[i]).toBeCloseTo(value, 9));
  });

  it("turns planets with a negative spin the other way", () => {
    const forwards = { ...globe("earth"), spin: 1 };
    const backwards = { ...forwards, spin: -1 };
    const a = globeRotation(forwards, 3);
    const b = globeRotation(backwards, -3);
    a.forEach((value, i) => expect(b[i]).toBeCloseTo(value, 9));
  });
});

describe("lightDirection", () => {
  it("has the length 1 and comes from the upper left front", () => {
    const [x, y, z] = lightDirection();
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    expect(x).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
  });

  it("moves with the camera", () => {
    expect(lightDirection(1, 0)).not.toEqual(lightDirection());
    expect(Math.hypot(...lightDirection(1, 0.5))).toBeCloseTo(1, 9);
  });
});

describe("surfaceDefines", () => {
  const gas = () =>
    planetAppearance({
      slug: "some-c",
      source: "nasa",
      planetClass: "gas_giant",
      climateClass: "hot",
      starTeffK: 6000,
      radiusEarth: null,
      eqTempK: null,
      densityEarth: null,
      orbitalPeriodDays: null,
    }).globe;

  it("tells the shader which kind of surface to draw", () => {
    expect(surfaceDefines(globe("earth")).KIND).toBe(0);
    expect(surfaceDefines(globe("some-b", "nasa")).KIND).toBe(1);
    expect(surfaceDefines(gas()).KIND).toBe(2);
  });

  it("leaves out relief where a planet has no heights", () => {
    // A real map takes its heights from the picture when it shows ground, unless the body has a relief map.
    expect(surfaceDefines({ ...globe("mars"), relief: 0.8 }).RELIEF).toBe(1);
    expect(surfaceDefines(globe("earth")).RELIEF).toBe(2);
    expect(surfaceDefines(globe("jupiter")).RELIEF).toBe(0);
    // A terrain preset always holds heights, while gas has no ground at all.
    expect(surfaceDefines({ ...globe("some-b", "nasa"), relief: 0 }).RELIEF).toBe(1);
    expect(surfaceDefines({ ...gas(), relief: 1 }).RELIEF).toBe(0);
  });

  it("leaves the veil of air out where there is no ground under air", () => {
    expect(surfaceDefines(globe("earth")).AIR).toBe(1);
    expect(surfaceDefines(globe("titan")).AIR).toBe(1);
    expect(surfaceDefines(globe("some-b", "nasa")).AIR).toBe(1);
    // The Moon has no air, and Jupiter and Venus show no ground.
    expect(surfaceDefines(globe("moon")).AIR).toBe(0);
    expect(surfaceDefines(globe("jupiter")).AIR).toBe(0);
    expect(surfaceDefines(globe("venus")).AIR).toBe(0);
    expect(surfaceDefines(gas()).AIR).toBe(0);
    expect(surfaceDefines({ ...globe("some-b", "nasa"), atmosphere: null }).AIR).toBe(0);
  });

  it("returns exactly the combinations the warm-up builds", () => {
    const built = ALL_SURFACE_DEFINES.map(defineLines);
    expect(new Set(built).size).toBe(built.length);
    const returned = new Set<string>();
    const rocky = globe("some-b", "nasa");
    for (const spec of [globe("earth"), globe("mars"), globe("moon"), globe("jupiter"), rocky, { ...rocky, atmosphere: null }, gas()]) {
      for (const relief of [0, 1]) returned.add(defineLines(surfaceDefines({ ...spec, relief })));
    }
    expect(returned).toEqual(new Set(built));
  });
});

describe("surfaceUniforms", () => {
  it("switches off what a planet does not have", () => {
    const bare: GlobeSpec = {
      ...globe("some-b", "nasa"),
      ocean: null,
      clouds: null,
      glow: null,
      atmosphere: null,
      rings: null,
      second: null,
      weather: null,
      aurora: null,
    };
    const uniforms = surfaceUniforms(bare);
    expect(uniforms.uOcean[3]).toBeLessThan(-1);
    expect(uniforms.uCloud[3]).toBe(0);
    expect(uniforms.uGlow[3]).toBe(0);
    expect(uniforms.uAtmo[3]).toBe(0);
    expect(uniforms.uRing[2]).toBe(0);
    expect(uniforms.uAurora[3]).toBe(0);
    expect(uniforms.uMapFlags).toEqual([0, 0, 0, 0]);
    // Without a second preset or a weather preset the turn is the identity matrix.
    expect(uniforms.uMapTurn2).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(uniforms.uWeatherTurn).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("hands every part of the description to the shader unchanged", () => {
    const giant = planetAppearance({
      slug: "hot-b",
      source: "nasa",
      planetClass: "gas_giant",
      climateClass: "hot",
      starTeffK: 6000,
      radiusEarth: null,
      eqTempK: null,
      densityEarth: null,
      orbitalPeriodDays: null,
    }).globe;
    const uniforms = surfaceUniforms(giant);
    expect(uniforms.uFlow).toBe(giant.flow);
    expect(uniforms.uJets).toEqual(giant.jets);
    expect(uniforms.uBelts).toEqual(giant.belts);
    expect(uniforms.uBands).toEqual([giant.bands.contrast, giant.bands.turbulence, giant.bands.storms, giant.bands.wisps]);
    const rocky = globe("some-b", "nasa");
    expect(surfaceUniforms(rocky).uTerrain).toEqual(rocky.terrain);
    expect(surfaceUniforms(rocky).uMapTurn).toEqual(rocky.turn);
    expect(surfaceUniforms(rocky).uMapTurn2).toEqual(rocky.second?.turn);
    // The second preset uses the texture slot of the night map, which flag 0 signals.
    expect(surfaceUniforms(rocky).uMapFlags[0]).toBe(1);
    expect(surfaceUniforms(rocky).uZones).toBe(rocky.zones);
    expect(surfaceUniforms({ ...rocky, locked: 1 }).uLocked).toBe(1);
    expect(surfaceUniforms({ ...giant, lightning: 0.7 }).uLightning).toBe(0.7);
    const lights = surfaceUniforms({ ...rocky, aurora: { color: "#ffffff", strength: 0.5 } }).uAurora;
    expect(lights).toEqual([1, 1, 1, 0.5]);
    const stormy = { ...giant, storms: { cyclones: 0.1, dust: 0.2, spin: 0.3, outbreaks: 0.4 } };
    expect(surfaceUniforms(stormy).uStormSpin).toBe(0.3);
  });

  it("lays the weather preset of a world with seas on the sphere", () => {
    const rocky = globe("some-b", "nasa");
    expect(rocky.weather).not.toBeNull();
    expect(surfaceUniforms(rocky).uWeatherTurn).toEqual(rocky.weather?.turn);
    // The weather preset uses the texture slot of the cloud map, which flag 1 signals.
    expect(surfaceUniforms(rocky).uMapFlags[1]).toBe(1);
    expect(surfaceUniforms({ ...rocky, weather: null }).uMapFlags[1]).toBe(0);
  });

  it("announces the extra maps of Earth and the ring map of Saturn", () => {
    const earth = surfaceUniforms(globe("earth")).uMapFlags;
    expect(earth[0]).toBe(1);
    expect(earth[1]).toBe(1);
    expect(surfaceUniforms(globe("saturn")).uMapFlags[2]).toBe(1);
  });
});

describe("textureUrls", () => {
  it("names the files of a planet of the solar system", () => {
    expect(textureUrls(globe("earth"), "lg")).toEqual({
      day: "/textures/planets/earth-lg.jpg",
      night: "/textures/planets/earth-night-lg.jpg",
      clouds: "/textures/planets/earth-clouds-lg.jpg",
      ring: null,
      relief: "/textures/planets/earth-relief-lg.jpg",
      relief2: null,
      // The cloud map comes with the winds that keep it moving.
      flow: "/textures/planets/earth-clouds-flow.webp",
    });
    expect(textureUrls(globe("mars"), "lg").flow).toBeNull();
    expect(textureUrls(globe("saturn"), "sm")).toMatchObject({
      day: "/textures/planets/saturn-sm.jpg",
      ring: "/textures/planets/saturn-ring.png",
    });
  });

  it("names the preset of an exoplanet", () => {
    const rocky = globe("some-b", "nasa");
    expect(textureUrls(rocky, "sm")).toEqual({
      day: `/textures/presets/${rocky.maps.day}-sm.webp`,
      night: `/textures/presets/${rocky.second?.map}-sm.webp`,
      clouds: `/textures/presets/${rocky.weather?.map}-sm.webp`,
      ring: null,
      relief: `/textures/presets/${rocky.maps.day}-relief-sm.avif`,
      relief2: `/textures/presets/${rocky.second?.map}-relief-sm.avif`,
      flow: `/textures/presets/${rocky.weather?.map}-flow.webp`,
    });
    const giant = planetAppearance({
      slug: "hot-b",
      source: "nasa",
      planetClass: "gas_giant",
      climateClass: "hot",
      starTeffK: 6000,
      radiusEarth: null,
      eqTempK: null,
      densityEarth: null,
      orbitalPeriodDays: null,
    }).globe;
    expect(textureUrls(giant, "lg").day).toMatch(/^\/textures\/presets\/bands-[a-z]+-lg\.webp$/);
    // A band preset comes with the winds that keep its clouds moving.
    expect(textureUrls(giant, "lg").flow).toBe(`/textures/presets/${giant.maps.day}-flow.webp`);
    expect(textureUrls(giant, "lg").relief).toBeNull();
  });

  it("finds every extra-large map it names, twice as wide as the large ones", async () => {
    for (const name of SHARP_MAPS) {
      const file = path.resolve("public/textures/planets", `${name}-xl.${name.endsWith("-relief") ? "jpg" : "webp"}`);
      expect(existsSync(file), file).toBe(true);
      expect((await sharp(file).metadata()).width, file).toBe(LARGE_MAP_WIDTH * 2);
    }
  });

  it("asks for the extra-large maps only once the large ones are stretched two and a half times", () => {
    // A planet on its page is a few hundred pixels across and keeps its large maps.
    expect(stretchesLargeMaps(250)).toBe(false);
    expect(stretchesLargeMaps(600)).toBe(false);
    const edge = (LARGE_MAP_WIDTH * 2.5) / (2 * Math.PI);
    expect(stretchesLargeMaps(edge - 1)).toBe(false);
    expect(stretchesLargeMaps(edge + 1)).toBe(true);
    expect(stretchesLargeMaps(3000)).toBe(true);
  });

  it("holds the slopes and the seas of Earth in its relief map, in every size", async () => {
    for (const [size, width] of [["sm", LARGE_MAP_WIDTH / 4], ["lg", LARGE_MAP_WIDTH], ["xl", LARGE_MAP_WIDTH * 2]] as const) {
      const file = path.resolve("public/textures/planets", `earth-relief-${size}.jpg`);
      const { data, info } = await sharp(file, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height, info.channels], file).toEqual([width, width / 2, 3]);
      /** The mean of one channel over a small box around a place. */
      const at = (channel: number, lon: number, lat: number, box: number) => {
        let sum = 0;
        let count = 0;
        for (let dy = -box; dy <= box; dy += 0.25) {
          for (let dx = -box; dx <= box; dx += 0.25) {
            const x = Math.floor(((lon + dx + 180) / 360) * info.width);
            const y = Math.floor(((90 - lat - dy) / 180) * info.height);
            sum += data[(y * info.width + x) * 3 + channel];
            count++;
          }
        }
        return sum / count;
      };
      // Blue is the sea: the Pacific is water and the Sahara is not.
      expect(at(2, -150, 0, 1.5), file).toBeGreaterThan(240);
      expect(at(2, 10, 23, 1.5), file).toBeLessThan(15);
      // Level ground and open sea are mid grey in red and green.
      expect(at(0, -150, 0, 1.5), file).toBeCloseTo(127.5, -1);
      expect(at(1, -150, 0, 1.5), file).toBeCloseTo(127.5, -1);
      // Green is the lean towards north: the Himalaya falls south towards India, the Kunlun north
      // towards the Tarim basin. The source counts towards south, so a missed flip would show here.
      expect(at(1, 85, 27.6, 0.4), file).toBeLessThan(at(1, 82, 36.8, 0.4) - 5);
      // Red is the lean towards east: the Andes fall west to the Pacific and east to the lowlands.
      expect(at(0, -70.2, -20, 0.4), file).toBeLessThan(at(0, -64.5, -20, 0.4) - 3);
    }
  });

  it("names the extra-large maps where they exist, and the large ones elsewhere", () => {
    expect(textureUrls(globe("earth"), "xl")).toMatchObject({
      day: "/textures/planets/earth-xl.webp",
      night: "/textures/planets/earth-night-xl.webp",
      clouds: "/textures/planets/earth-clouds-xl.webp",
      relief: "/textures/planets/earth-relief-xl.jpg",
    });
    // Neptune's source is no larger than its large map, and presets come in two sizes only.
    expect(textureUrls(globe("neptune"), "xl")).toEqual(textureUrls(globe("neptune"), "lg"));
    const rocky = globe("some-b", "nasa");
    expect(textureUrls(rocky, "xl")).toEqual(textureUrls(rocky, "lg"));
  });
});

describe("surfaceConstants", () => {
  it("holds what the single functions work out for a spec", () => {
    for (const spec of [globe("earth"), globe("saturn"), globe("some-b", "nasa")]) {
      const constants = surfaceConstants(spec);
      expect(constants.defines).toEqual(surfaceDefines(spec));
      expect(constants.program).toBe(defineLines(surfaceDefines(spec)));
      expect(constants.uniforms).toEqual(surfaceUniforms(spec));
      for (const size of ["sm", "lg", "xl"] as const) {
        expect(constants.urls[size]).toEqual(textureUrls(spec, size));
      }
    }
  });

  it("works them out once per spec, because a renderer asks for every picture", () => {
    const spec = globe("earth");
    expect(surfaceConstants(spec)).toBe(surfaceConstants(spec));
  });

  it("keeps two specs apart, also when they describe the same planet", () => {
    const first = surfaceConstants(globe("earth"));
    const second = surfaceConstants(globe("earth"));
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(surfaceConstants(globe("mars")).urls.sm.day).not.toBe(first.urls.sm.day);
  });
});
