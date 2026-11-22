import { describe, expect, it } from "vitest";
import { planetAppearance, type AppearanceInput } from "@/app/planets/appearance";
import PRESETS from "@/app/globe/presets.json";
import { NO_TURN } from "@/app/globe/spec";

function input(overrides: Partial<AppearanceInput> = {}): AppearanceInput {
  return {
    slug: "test-b",
    source: "nasa",
    planetClass: "rocky",
    climateClass: "temperate",
    starTeffK: 5800,
    radiusEarth: null,
    eqTempK: null,
    densityEarth: null,
    orbitalPeriodDays: null,
    ...overrides,
  };
}

describe("planetAppearance", () => {
  it("gives the same planet the same look every time", () => {
    expect(planetAppearance(input())).toEqual(planetAppearance(input()));
  });

  it("gives planets of the same kind different patterns and colours", () => {
    const a = planetAppearance(input({ slug: "kepler-22-b" }));
    const b = planetAppearance(input({ slug: "kepler-452-b" }));
    expect(a.globe.kind).toBe(b.globe.kind);
    expect(a.seed).not.toBe(b.seed);
    expect(a.base).not.toBe(b.base);
    expect(a.globe.ocean?.color).not.toBe(b.globe.ocean?.color);
  });

  it("draws every exoplanet from a preset, turned and mirrored its own way", () => {
    const names = Array.from({ length: 40 }, (_, index) => `planet-${index}-b`);
    const rocky = names.map((slug) => planetAppearance(input({ slug })).globe);
    const giants = names.map(
      (slug) => planetAppearance(input({ slug, planetClass: "gas_giant" })).globe,
    );
    for (const globe of rocky) {
      expect(globe.kind).toBe("terrain");
      expect(["continents", "archipelago", "supercontinent", "highlands"]).toContain(globe.maps.day);
      expect(globe.ocean?.level).toBeGreaterThan(0);
      expect(globe.ocean?.level).toBeLessThan(1);
    }
    for (const globe of giants) {
      expect(globe.kind).toBe("bands");
      expect(globe.maps.day).toMatch(/^bands-/);
      expect(globe.flow).toBe(1);
    }
    // A turn may only rotate or mirror, so its three columns must be orthonormal.
    const columns = (turn: number[]) => [turn.slice(0, 3), turn.slice(3, 6), turn.slice(6, 9)];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const globe of [...rocky, ...giants]) {
      const [x, y, z] = columns(globe.turn);
      for (const column of [x, y, z]) expect(dot(column, column)).toBeCloseTo(1, 3);
      expect(dot(x, y)).toBeCloseTo(0, 3);
      expect(dot(x, z)).toBeCloseTo(0, 3);
      expect(dot(y, z)).toBeCloseTo(0, 3);
    }
    // The belts of a gas planet must follow its latitudes, so it may only turn about its axis.
    for (const globe of giants) expect(Math.abs(columns(globe.turn)[1][1])).toBe(1);
    expect(rocky.filter((globe) => Math.abs(columns(globe.turn)[1][1]) < 0.95).length).toBeGreaterThan(30);
    expect(new Set(rocky.map((globe) => globe.maps.day)).size).toBeGreaterThan(1);
    expect(new Set(rocky.map((globe) => globe.turn.join())).size).toBe(rocky.length);
    expect(new Set(rocky.map((globe) => globe.ocean?.level)).size).toBeGreaterThan(30);
  });

  it("mixes two base maps on a rocky planet, each turned its own way", () => {
    const names = Array.from({ length: 40 }, (_, index) => `mixed-${index}-b`);
    for (const climateClass of ["frozen", "cold", "temperate", "hot", "scorching", null] as const) {
      for (const slug of names) {
        const globe = planetAppearance(input({ slug, climateClass })).globe;
        expect(globe.second).not.toBeNull();
        expect(globe.second?.map).not.toBe(globe.maps.day);
        expect(Object.keys(PRESETS.terrain)).toContain(globe.second?.map);
        expect(globe.second?.turn).not.toEqual(globe.turn);
      }
    }
    // Gas planets and solar-system planets keep a single map.
    expect(planetAppearance(input({ planetClass: "gas_giant" })).globe.second).toBeNull();
    expect(planetAppearance(input({ slug: "mars", source: "sol" })).globe.second).toBeNull();
  });

  it("colours a gas planet by its temperature", () => {
    const channels = (hex: string) =>
      [16, 8, 0].map((shift) => (Number.parseInt(hex.slice(1), 16) >> shift) & 0xff);
    const base = (planetClass: "gas_giant" | "neptune_like", eqTempK: number | null) =>
      channels(planetAppearance(input({ planetClass, eqTempK })).base);
    // Giants are cream and brown where ammonia freezes, blue where the air is clear and dark when hot.
    const [coldRed, , coldBlue] = base("gas_giant", 110);
    expect(coldRed).toBeGreaterThan(coldBlue);
    const [clearRed, , clearBlue] = base("gas_giant", 600);
    expect(clearBlue).toBeGreaterThan(clearRed);
    const sum = (rgb: number[]) => rgb[0] + rgb[1] + rgb[2];
    expect(sum(base("gas_giant", 1500))).toBeLessThan(sum(base("gas_giant", 220)) * 0.5);
    // Between these temperatures the colour changes gradually rather than in one jump.
    expect(base("gas_giant", 400)).not.toEqual(base("gas_giant", 330));
    expect(base("gas_giant", 400)).not.toEqual(base("gas_giant", 600));
    // Cold planets like Neptune are blue, and a planet of unknown temperature still gets a colour.
    const [neptuneRed, , neptuneBlue] = base("neptune_like", 60);
    expect(neptuneBlue).toBeGreaterThan(neptuneRed);
    expect(sum(base("neptune_like", null))).toBeGreaterThan(0);
    // From about 900 K a giant glows by itself, and more strongly the hotter it is.
    const glow = (eqTempK: number) =>
      planetAppearance(input({ planetClass: "gas_giant", eqTempK })).globe.glow;
    expect(glow(600)).toBeNull();
    expect(glow(1200)?.strength).toBeGreaterThan(0);
    expect(glow(2300)?.strength).toBeGreaterThan(glow(1200)?.strength ?? 0);
    const bases = Array.from({ length: 30 }, (_, index) =>
      planetAppearance(input({ slug: `twin-${index}-b`, planetClass: "gas_giant", eqTempK: 130 })).base,
    );
    expect(new Set(bases).size).toBeGreaterThan(25);
  });

  it("holds a planet close to its star with one side towards it", () => {
    for (const planetClass of ["rocky", "gas_giant"] as const) {
      const held = planetAppearance(input({ planetClass, orbitalPeriodDays: 3 })).globe;
      expect(held.locked).toBe(1);
      expect(held.tiltDeg).toBe(0);
      expect(held.flattening).toBe(0);
      expect(held.rings).toBeNull();
      expect(held.moon).toBeNull();
      const free = planetAppearance(input({ planetClass, orbitalPeriodDays: 300 })).globe;
      expect(free.locked).toBe(0);
      expect(free.spin).toBeGreaterThan(0);
      // The ground of a locked planet stands still, but the clouds of a locked
      // gas planet keep circling it, more slowly than on a free one.
      if (planetClass === "rocky") expect(held.spin).toBe(0);
      else {
        expect(held.spin).toBeGreaterThan(0);
        expect(held.spin).toBeLessThan(free.spin);
      }
      // A planet without a known orbit is assumed to have days and nights.
      expect(planetAppearance(input({ planetClass })).globe.locked).toBe(0);
    }
    // For periods in between, the locking loosens gradually.
    const loose = planetAppearance(input({ orbitalPeriodDays: 21 })).globe.locked;
    expect(loose).toBeGreaterThan(0);
    expect(loose).toBeLessThan(1);
    // On a mild locked world the ice covers the night side instead of the poles.
    const held = planetAppearance(input({ orbitalPeriodDays: 3 })).globe;
    const free = planetAppearance(input({ orbitalPeriodDays: 300 })).globe;
    expect(held.ice).toBeGreaterThan(0.4);
    expect(held.ice).toBeGreaterThan(free.ice);
    expect(held.zones).toBe(1);
  });

  it("reads from the density what a rocky planet is made of", () => {
    const made = (densityEarth: number | null, extra: Partial<AppearanceInput> = {}) =>
      planetAppearance(input({ radiusEarth: 1.5, densityEarth, ...extra })).globe;
    const level = (share: number, globe: ReturnType<typeof made>) => {
      const levels = (name: string) => PRESETS.terrain[name as keyof typeof PRESETS.terrain].levels;
      const at = (name: string) => levels(name)[Math.round(share * 20)];
      return (at(globe.maps.day) + at(globe.second?.map ?? globe.maps.day)) / 2;
    };
    // Earth-like rock compressed by its own weight, or no measured density, gives an ordinary world.
    const rock = made(1.4);
    expect(rock).toEqual(made(null));
    // A density far too low for rock means a water world that is nearly all sea.
    const water = made(0.5);
    expect(water.ocean?.level).toBeGreaterThan(level(0.9, water));
    expect(rock.ocean?.level).toBeLessThanOrEqual(level(0.9, rock) + 0.001);
    // On a cold world that water is a shell of ice, and on a hot one a deck of steam.
    expect(made(0.5, { climateClass: "cold" }).maps.day).toBe("icecrust");
    expect(made(0.5, { climateClass: "hot" }).clouds?.cover).toBeGreaterThan(0.8);
    // A density far too high means an iron world, which is darker and greyer.
    const brightness = (hex: string) =>
      [16, 8, 0].reduce((sum, shift) => sum + ((Number.parseInt(hex.slice(1), 16) >> shift) & 0xff), 0);
    const iron = made(2.6, { climateClass: "hot" });
    const dust = made(1.4, { climateClass: "hot" });
    expect(brightness(iron.palette[1])).toBeLessThan(brightness(dust.palette[1]));
  });

  it("gives some planets rings, moons, polar lights and a flattened shape", () => {
    const names = Array.from({ length: 300 }, (_, index) => `world-${index}-b`);
    const giants = names.map(
      (slug) => planetAppearance(input({ slug, planetClass: "gas_giant", eqTempK: 120 })).globe,
    );
    const ringed = giants.filter((globe) => globe.rings);
    expect(ringed.length).toBeGreaterThan(30);
    expect(ringed.length).toBeLessThan(110);
    for (const globe of ringed) {
      expect(globe.rings!.outer).toBeGreaterThan(globe.rings!.inner);
      expect(globe.rings!.inner).toBeGreaterThan(1.2);
      // Rings seen edge-on would be a line, and a moon would have to pass through them.
      expect(globe.tiltDeg).toBeGreaterThanOrEqual(12);
      expect(globe.moon).toBeNull();
    }
    for (const globe of giants) {
      expect(globe.flattening).toBeGreaterThanOrEqual(0.03);
      expect(globe.flattening).toBeLessThanOrEqual(0.1);
      // A moon must circle outside the planet but still inside the picture.
      if (globe.moon) expect(globe.moon.distance - globe.moon.size).toBeGreaterThan(1.05);
    }
    expect(giants.filter((globe) => globe.moon).length).toBeGreaterThan(40);
    expect(giants.filter((globe) => globe.aurora).length).toBeGreaterThan(70);
    const stormy = giants.filter((globe) => globe.lightning > 0).length;
    expect(stormy).toBeGreaterThan(70);
    expect(stormy).toBeLessThan(140);

    const rocky = names.map((slug) => planetAppearance(input({ slug })).globe);
    for (const globe of rocky) {
      expect(globe.rings).toBeNull();
      expect(globe.flattening).toBe(0);
      expect(globe.lightning).toBe(0);
    }
    expect(rocky.filter((globe) => globe.moon).length).toBeGreaterThan(20);
    // Red dwarfs are more active, so their planets get polar lights more often.
    const lights = (starTeffK: number) =>
      names.filter((slug) => planetAppearance(input({ slug, starTeffK })).globe.aurora).length;
    expect(lights(3200)).toBeGreaterThan(lights(5800) * 1.5);
    // A planet without air has nothing that could light up.
    for (const slug of names.slice(0, 40)) {
      expect(planetAppearance(input({ slug, climateClass: null })).globe.aurora).toBeNull();
    }
  });

  it("lets the winds a band preset was simulated with blow on", () => {
    const names = Array.from({ length: 40 }, (_, index) => `giant-${index}-b`);
    const globes = names.flatMap((slug) =>
      (["gas_giant", "neptune_like"] as const).map(
        (planetClass) => planetAppearance(input({ slug, planetClass })).globe,
      ),
    );
    for (const globe of globes) {
      const winds = PRESETS.bands[globe.maps.day as keyof typeof PRESETS.bands];
      expect(globe.jets).toEqual([winds.strength, winds.count, winds.equator, winds.narrowness]);
      // The belts span between two thirds and all of the preset's latitudes and keep its jet phase.
      expect(globe.belts[0]).toBeGreaterThanOrEqual(0.64);
      expect(globe.belts[0]).toBeLessThanOrEqual(1);
      expect(globe.belts[1]).toBe(winds.phase);
      expect(globe.bands.storms).toBeGreaterThanOrEqual(0.4);
      expect(globe.bands.storms).toBeLessThanOrEqual(1);
    }
    expect(new Set(globes.map((globe) => globe.maps.day))).toEqual(new Set(Object.keys(PRESETS.bands)));
    expect(new Set(globes.map((globe) => globe.jets.join())).size).toBe(Object.keys(PRESETS.bands).length);
    // The presets are normalised so that the fastest latitude moves at about speed 1 in either direction.
    for (const winds of Object.values(PRESETS.bands)) {
      expect(winds.strength + Math.abs(winds.equator)).toBeCloseTo(1, 2);
    }
    const rocky = planetAppearance(input()).globe;
    expect(rocky.flow).toBe(0);
    expect(rocky.bands.storms).toBe(0);
  });

  it("lets the winds of a gas planet blow faster the hotter it is, round the equator most of all when its star holds it", () => {
    const giant = (overrides: Partial<AppearanceInput>) =>
      planetAppearance(input({ slug: "windy-b", planetClass: "gas_giant", ...overrides })).globe;
    const cold = giant({ eqTempK: 110 });
    const warm = giant({ eqTempK: 600 });
    const hot = giant({ eqTempK: 1900 });
    expect(cold.pace).toBeLessThan(warm.pace);
    expect(warm.pace).toBeLessThan(hot.pace);
    expect(cold.pace).toBeGreaterThanOrEqual(0.75);
    expect(hot.pace).toBeLessThanOrEqual(1.6);
    // Without a temperature the winds keep the usual pace, and so do the clouds of a rocky planet.
    expect(giant({ eqTempK: null }).pace).toBe(1);
    expect(planetAppearance(input()).globe.pace).toBe(1);
    // A planet with days and nights keeps the jets of its preset, however hot it is.
    const winds = PRESETS.bands[hot.maps.day as keyof typeof PRESETS.bands];
    expect(hot.jets).toEqual([winds.strength, winds.count, winds.equator, winds.narrowness]);
    const held = giant({ eqTempK: 1900, orbitalPeriodDays: 3 });
    expect(Math.abs(held.jets[2])).toBeGreaterThan(Math.abs(hot.jets[2]) * 1.5);
    expect(held.jets[0]).toBeLessThan(hot.jets[0]);
    expect(Math.sign(held.jets[2])).toBe(Math.sign(hot.jets[2]));
    // A cool planet held by its star has no such stream.
    expect(giant({ eqTempK: 100, orbitalPeriodDays: 3 }).jets).toEqual(giant({ eqTempK: 100 }).jets);
  });

  it("makes some Neptune-like planets livelier than others, and leaves the gas giants as they are", () => {
    const names = Array.from({ length: 60 }, (_, index) => `lively-${index}-b`);
    const neptunes = names.map((slug) => planetAppearance(input({ slug, planetClass: "neptune_like", eqTempK: 260 })).globe);
    const still = planetAppearance(input({ slug: "windy-b", planetClass: "gas_giant", eqTempK: 260 })).globe.pace;
    for (const globe of neptunes) {
      // Every one of them shows a little high cloud, and its weather never moves slower than a giant's at that temperature.
      expect(globe.bands.wisps).toBeGreaterThanOrEqual(0.15);
      expect(globe.bands.wisps).toBeLessThanOrEqual(1);
      expect(globe.pace).toBeGreaterThanOrEqual(still);
      expect(globe.pace).toBeLessThanOrEqual(still * 1.3 + 0.001);
      expect(globe.storms.spin).toBeLessThanOrEqual(1.4);
    }
    // Most stay calm and a few are lively.
    const wisps = neptunes.map((globe) => globe.bands.wisps).sort((a, b) => a - b);
    expect(wisps[Math.floor(wisps.length / 2)]).toBeLessThan(0.55);
    expect(wisps[wisps.length - 1]).toBeGreaterThan(0.8);
    expect(wisps[0]).toBeLessThan(0.25);
    // The livelier a planet, the more of everything: wisps, streaks and pace go together.
    const calmest = neptunes.reduce((a, b) => (a.bands.wisps < b.bands.wisps ? a : b));
    const liveliest = neptunes.reduce((a, b) => (a.bands.wisps > b.bands.wisps ? a : b));
    expect(liveliest.pace).toBeGreaterThan(calmest.pace);
    // Under a veil of haze less of the weather shows.
    for (const slug of names) {
      const clear = planetAppearance(input({ slug, planetClass: "neptune_like", eqTempK: 260 })).globe;
      const hazy = planetAppearance(input({ slug, planetClass: "neptune_like", climateClass: "hot", eqTempK: 600 })).globe;
      expect(hazy.bands.wisps).toBeLessThanOrEqual(clear.bands.wisps);
    }
    for (const slug of names) {
      const giant = planetAppearance(input({ slug, planetClass: "gas_giant", eqTempK: 260 })).globe;
      expect(giant.bands.wisps).toBe(0);
      expect(giant.pace).toBe(still);
      expect(giant.storms.spin).toBeLessThanOrEqual(1);
    }
  });

  it("colours the plants by the light of the star", () => {
    const plants = (starTeffK: number | null) =>
      planetAppearance(input({ starTeffK })).globe.palette[0];
    expect(plants(5800)).toBe("#3f6f45");
    expect(plants(null)).toBe("#3f6f45");
    // Plants are nearly black under a red dwarf and blue under a hot star.
    const brightness = (hex: string) =>
      [16, 8, 0].reduce((sum, shift) => sum + ((Number.parseInt(hex.slice(1), 16) >> shift) & 0xff), 0);
    expect(brightness(plants(2600))).toBeLessThan(brightness(plants(5800)) * 0.5);
    const blue = (hex: string) => Number.parseInt(hex.slice(1), 16) & 0xff;
    const green = (hex: string) => (Number.parseInt(hex.slice(1), 16) >> 8) & 0xff;
    expect(blue(plants(8000))).toBeGreaterThan(green(plants(8000)));
    expect(plants(5300)).not.toBe(plants(4800));
    expect(plants(5300)).not.toBe(plants(5800));
    // The still image in the lists must show the same plant colour as the globe.
    expect(planetAppearance(input({ starTeffK: 3000 })).layers[0].color).toBe(plants(3000));
    // Only worlds with life are affected; a desert keeps its dust whatever the star.
    const desert = (starTeffK: number) =>
      planetAppearance(input({ climateClass: "hot", starTeffK })).globe.palette;
    expect(desert(3000)).toEqual(desert(8000));
  });

  it("lets a tilted axis blur the climate zones and shrink the ice caps", () => {
    const names = Array.from({ length: 60 }, (_, index) => `tilted-${index}-b`);
    const globes = names.map((slug) => planetAppearance(input({ slug })).globe);
    const upright = globes.reduce((a, b) => (a.tiltDeg < b.tiltDeg ? a : b));
    const tilted = globes.reduce((a, b) => (a.tiltDeg > b.tiltDeg ? a : b));
    expect(tilted.tiltDeg - upright.tiltDeg).toBeGreaterThan(20);
    expect(tilted.zones).toBeLessThan(upright.zones);
    expect(tilted.ice).toBeLessThan(upright.ice);
    for (const globe of globes) {
      expect(globe.zones).toBeGreaterThanOrEqual(0.4);
      expect(globe.zones).toBeLessThanOrEqual(1);
    }
    // Gas giants and solar-system planets keep their bands and maps unchanged.
    expect(planetAppearance(input({ planetClass: "gas_giant" })).globe.zones).toBe(1);
    expect(planetAppearance(input({ slug: "earth", source: "sol" })).globe.zones).toBe(1);
  });

  it("lets the temperature shape a world within its climate class", () => {
    const at = (climateClass: AppearanceInput["climateClass"], eqTempK: number | null) =>
      planetAppearance(input({ climateClass, eqTempK })).globe;

    // A mild world near freezing has more ice, fewer clouds and lower seas than one near boiling.
    const chilly = at("temperate", 255);
    const balmy = at("temperate", 345);
    expect(chilly.ice).toBeGreaterThan(balmy.ice * 2);
    expect(chilly.clouds?.cover).toBeLessThan(balmy.clouds?.cover ?? 0);
    expect(chilly.ocean?.level).toBeLessThan(balmy.ocean?.level ?? 0);
    // Without a temperature, the world is placed in the middle of its class.
    const unknown = at("temperate", null);
    expect(unknown.ice).toBeGreaterThan(balmy.ice);
    expect(unknown.ice).toBeLessThan(chilly.ice);
    expect(unknown).toEqual(at("temperate", 300));
    // Everything seeded from the name must not depend on the temperature.
    expect(chilly.maps).toEqual(balmy.maps);
    expect(chilly.turn).toEqual(balmy.turn);
    expect(chilly.tiltDeg).toBe(balmy.tiltDeg);

    const warm = at("scorching", 1100);
    const blazing = at("scorching", 2400);
    expect(blazing.terrain[0]).toBeGreaterThan(warm.terrain[0]);
    expect(blazing.glow?.strength).toBeGreaterThan(warm.glow?.strength ?? 0);

    // A hot desert only begins to glow near the melting point of rock.
    expect(at("hot", 450).glow).toBeNull();
    expect(at("hot", 950).glow?.strength).toBeGreaterThan(0);

    // Temperatures outside the class range are clamped, so they do not overshoot.
    expect(at("temperate", 900)).toEqual(at("temperate", 350));
    expect(at("cold", 10)).toEqual(at("cold", 150));

    const giant = (eqTempK: number) =>
      planetAppearance(input({ planetClass: "gas_giant", climateClass: "scorching", eqTempK })).globe;
    expect(giant(2400).glow?.strength).toBeGreaterThan(giant(1100).glow?.strength ?? 0);
  });

  it("gives planets the storms that suit them", () => {
    const names = Array.from({ length: 30 }, (_, index) => `weather-${index}-b`);
    // Cyclones need a sea, and the warmer the sea, the livelier they are.
    for (const slug of names) {
      const mild = planetAppearance(input({ slug })).globe;
      expect(mild.storms.cyclones, slug).toBeGreaterThan(0);
      expect(mild.storms.dust, slug).toBe(0);
    }
    const chilly = planetAppearance(input({ eqTempK: 255 })).globe;
    const balmy = planetAppearance(input({ eqTempK: 345 })).globe;
    expect(balmy.storms.cyclones).toBeGreaterThan(chilly.storms.cyclones);

    // Dust storms need air and dry ground, so a cold dusty world has them and a bare rock does not.
    const dusty = names.map((slug) => planetAppearance(input({ slug, climateClass: "cold" })).globe);
    expect(dusty.some((globe) => globe.storms.dust > 0)).toBe(true);
    for (const globe of dusty) expect(globe.storms.cyclones).toBe(0);
    const bare = planetAppearance(input({ climateClass: null })).globe;
    expect(bare.storms).toEqual({ cyclones: 0, dust: 0, spin: 0, outbreaks: 0 });

    // The storms and the turbulence of a gas giant keep moving.
    const giants = names.map((slug) => planetAppearance(input({ slug, planetClass: "gas_giant", eqTempK: 140 })).globe);
    for (const globe of giants) {
      expect(globe.storms.spin).toBeGreaterThanOrEqual(0.7);
      expect(globe.storms.spin).toBeLessThanOrEqual(1);
    }
    expect(giants.some((globe) => globe.storms.outbreaks > 0)).toBe(true);
    expect(giants.some((globe) => globe.storms.outbreaks === 0)).toBe(true);
    // The hottest giants have no water clouds that could break out.
    for (const slug of names) {
      const hot = planetAppearance(input({ slug, planetClass: "gas_giant", climateClass: "scorching", eqTempK: 2000 })).globe;
      expect(hot.storms.outbreaks).toBe(0);
    }

    const mars = planetAppearance(input({ slug: "mars", source: "sol", planetClass: null, climateClass: null })).globe;
    expect(mars.storms.dust).toBe(1);
  });

  it("draws the clouds of a world with seas from a weather preset that follows its latitudes", () => {
    const names = Array.from({ length: 40 }, (_, index) => `planet-${index}-b`);
    const mild = names.map((slug) => planetAppearance(input({ slug })).globe);
    for (const globe of mild) {
      expect(PRESETS.weather).toContain(globe.weather?.map);
      // The preset only turns about the axis, and it is never mirrored east to west: that would
      // make the lows turn against the planet's spin.
      const turn = globe.weather?.turn ?? NO_TURN;
      expect([turn[1], turn[3], turn[5], turn[7]]).toEqual([0, 0, 0, 0]);
      expect(Math.abs(turn[4])).toBe(1);
      expect(turn[0] * turn[8] - turn[2] * turn[6]).toBeCloseTo(1, 3);
    }
    expect(new Set(mild.map((globe) => globe.weather?.map)).size).toBe(PRESETS.weather.length);
    expect(mild.some((globe) => globe.weather?.turn[4] === -1)).toBe(true);
    // A planet without seas has no weather of this kind, and on a locked one the clouds gather under the star.
    expect(planetAppearance(input({ climateClass: "cold" })).globe.weather).toBeNull();
    expect(planetAppearance(input({ orbitalPeriodDays: 5 })).globe.weather).toBeNull();
    expect(planetAppearance(input({ slug: "earth", source: "sol" })).globe.weather).toBeNull();
  });

  it("gives heavier planets lower mountains", () => {
    const small = planetAppearance(input({ radiusEarth: 0.8 })).globe;
    const large = planetAppearance(input({ radiusEarth: 1.9 })).globe;
    expect(large.terrain[2]).toBeLessThan(small.terrain[2]);
    // The radius must change nothing else about the planet.
    expect(large.maps).toEqual(small.maps);
    expect(large.turn).toEqual(small.turn);
  });

  it("fills the basins of the hottest planets with lava and leaves temperate ones their rivers", () => {
    const lava = planetAppearance(input({ climateClass: "scorching" })).globe;
    expect(lava.glow).not.toBeNull();
    expect(lava.terrain[0]).toBeGreaterThan(0);
    expect(lava.ocean).toBeNull();
    const mild = planetAppearance(input()).globe;
    expect(mild.terrain[0]).toBe(0);
    expect(mild.terrain[1]).toBe(1);
  });

  it("runs lava in rivers on a small planet and floods the plains of a large one", () => {
    const at = (radiusEarth: number, slug = "lab-b") =>
      planetAppearance(input({ slug, climateClass: "scorching", eqTempK: 1600, radiusEarth })).globe;
    const small = at(0.8);
    const large = at(2.8);
    expect(small.terrain[1]).toBeGreaterThan(large.terrain[1]);
    expect(large.terrain[1]).toBeGreaterThan(0);
    expect(large.terrain[0]).toBeGreaterThan(small.terrain[0]);
    // A large planet holds more of the smoke, but the air stays thin enough to show the dark ground.
    expect(large.atmosphere?.density).toBeGreaterThan(small.atmosphere?.density ?? 1);
    for (let index = 0; index < 30; index++) {
      for (const radius of [0.8, 1.5, 2.8]) {
        const globe = at(radius, `lava-${index}-b`);
        expect(globe.terrain[1]).toBeGreaterThan(0);
        expect(globe.terrain[1]).toBeLessThanOrEqual(1);
        expect(globe.atmosphere?.density).toBeGreaterThanOrEqual(0.1);
        expect(globe.atmosphere?.density).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it("draws bands on gaseous planets and patches on solid ones", () => {
    expect(planetAppearance(input({ planetClass: "gas_giant" })).banded).toBe(true);
    expect(planetAppearance(input({ planetClass: "neptune_like" })).banded).toBe(true);
    expect(planetAppearance(input({ planetClass: "super_earth" })).banded).toBe(false);
    expect(planetAppearance(input({ planetClass: "rocky" })).banded).toBe(false);
  });

  it("changes the colours with the climate", () => {
    const frozen = planetAppearance(input({ climateClass: "frozen" }));
    const scorching = planetAppearance(input({ climateClass: "scorching" }));
    expect(frozen.base).not.toBe(scorching.base);
  });

  it("still returns a look when class and climate are unknown", () => {
    const look = planetAppearance(input({ planetClass: null, climateClass: null }));
    expect(look.base).toMatch(/^#[0-9a-f]{6}$/);
    expect(look.layers.length).toBeGreaterThan(0);
    expect(look.atmosphere).toBeNull();
  });

  it("tints the planet by the colour of its star", () => {
    expect(planetAppearance(input({ starTeffK: 3000 })).starTint).toBe("#ff6a3a");
    expect(planetAppearance(input({ starTeffK: 4500 })).starTint).toBe("#ffa25e");
    expect(planetAppearance(input({ starTeffK: 5800 })).starTint).toBeNull();
    expect(planetAppearance(input({ starTeffK: 9000 })).starTint).toBe("#9cc0ff");
    expect(planetAppearance(input({ starTeffK: null })).starTint).toBeNull();
  });

  it("uses the real colours for the solar system", () => {
    const saturn = planetAppearance(
      input({ slug: "saturn", source: "sol", planetClass: "gas_giant", climateClass: "frozen" }),
    );
    expect(saturn.rings).toBe(true);
    expect(saturn.banded).toBe(true);

    const earth = planetAppearance(input({ slug: "earth", source: "sol" }));
    expect(earth.base).toBe("#1f4f8f");
    expect(earth.rings).toBe(false);
  });

  it("applies the general rules to an exoplanet that happens to share a slug", () => {
    const look = planetAppearance(
      input({ slug: "saturn", source: "nasa", planetClass: "gas_giant" }),
    );
    expect(look.rings).toBe(false);
  });
});
