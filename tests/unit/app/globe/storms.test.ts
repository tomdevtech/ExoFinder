import { describe, expect, it } from "vitest";
import { planetAppearance } from "@/app/planets/appearance";
import type { GlobeSpec } from "@/app/globe/spec";
import { CYCLONE_SLOTS, DUST_SLOTS, stormUniforms } from "@/app/globe/storms";

const CALM: GlobeSpec["storms"] = { cyclones: 0, dust: 0, spin: 0, outbreaks: 0 };

function globe(kind: "rocky" | "gas_giant", storms: Partial<GlobeSpec["storms"]>, slug = "some-b"): GlobeSpec {
  const spec = planetAppearance({
    slug,
    source: "nasa",
    planetClass: kind,
    climateClass: kind === "rocky" ? "temperate" : "cold",
    starTeffK: 5800,
    radiusEarth: null,
    eqTempK: null,
    densityEarth: null,
    orbitalPeriodDays: null,
  }).globe;
  return { ...spec, storms: { ...CALM, ...storms } };
}

/** Returns the living cyclones at a moment as objects. */
function cyclonesAt(spec: GlobeSpec, seconds: number) {
  const { uCyclones, uCycloneCount } = stormUniforms(spec, seconds);
  return Array.from({ length: uCycloneCount }, (_, index) => {
    const [x, y, z, size, strength, kind, mature, turn, stretch] = uCyclones.slice(index * 12, index * 12 + 9);
    return { centre: [x, y, z], size, strength, tropical: Math.abs(kind) === 2, north: kind > 0, mature, turn, stretch };
  });
}

/** These moments span half an hour at a step that is not in sync with the lifetime of any storm. */
const MOMENTS = Array.from({ length: 240 }, (_, index) => index * 7.3);

describe("stormUniforms", () => {
  it("has nothing for a planet without storms", () => {
    const none = stormUniforms(globe("rocky", {}), 123);
    expect(none.uCycloneCount).toBe(0);
    expect(none.uCyclones).toHaveLength(CYCLONE_SLOTS * 12);
    expect(none.uCyclones.every((value) => value === 0)).toBe(true);
    expect(none.uDusts).toHaveLength(DUST_SLOTS * 4);
    expect(none.uDustLives).toEqual([0, 0, 0]);
    expect(none.uOutbreak).toEqual([0, 0, 0, 0]);
  });

  it("gives the same weather for the same planet at the same moment", () => {
    const spec = globe("rocky", { cyclones: 0.9, dust: 0.8 });
    expect(stormUniforms(spec, 431.5)).toEqual(stormUniforms(spec, 431.5));
    const other = globe("rocky", { cyclones: 0.9, dust: 0.8 }, "other-c");
    expect(MOMENTS.some((t) => JSON.stringify(stormUniforms(other, t)) !== JSON.stringify(stormUniforms(spec, t)))).toBe(true);
  });

  it("puts the living cyclones first and leaves the rest empty", () => {
    const spec = globe("rocky", { cyclones: 0.9 });
    const counts = new Set<number>();
    for (const t of MOMENTS) {
      const { uCyclones, uCycloneCount } = stormUniforms(spec, t);
      counts.add(uCycloneCount);
      expect(Number.isInteger(uCycloneCount)).toBe(true);
      expect(uCycloneCount).toBeLessThanOrEqual(CYCLONE_SLOTS);
      expect(uCyclones).toHaveLength(CYCLONE_SLOTS * 12);
      expect(uCyclones.slice(uCycloneCount * 12).every((value) => value === 0)).toBe(true);
    }
    expect(counts.size).toBeGreaterThan(1);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
  });

  it("places cyclones on the ball, tropical ones nearer the equator than those of the middle latitudes", () => {
    const spec = globe("rocky", { cyclones: 0.95 });
    const all = MOMENTS.flatMap((t) => cyclonesAt(spec, t));
    expect(all.length).toBeGreaterThan(100);
    for (const storm of all) {
      expect(Math.hypot(...storm.centre)).toBeCloseTo(1, 6);
      expect(storm.size).toBeGreaterThan(0.03);
      expect(storm.size).toBeLessThan(0.3);
      expect(storm.strength).toBeGreaterThan(0);
      expect(storm.strength).toBeLessThanOrEqual(1);
      expect(storm.turn).toBeGreaterThan(1);
      expect(Math.abs(storm.stretch - 1)).toBeLessThanOrEqual(0.15);
      // A storm's sense of rotation must match its hemisphere.
      expect(storm.centre[1] > 0).toBe(storm.north);
      // Only tropical storms clear an eye.
      if (!storm.tropical) expect(storm.mature).toBe(0);
    }
    const tropical = all.filter((storm) => storm.tropical);
    const temperate = all.filter((storm) => !storm.tropical);
    expect(tropical.length).toBeGreaterThan(0);
    expect(temperate.length).toBeGreaterThan(0);
    // The values are sines of the latitude: tropical storms start near 0.12 and end below 0.65, and the others stay between 0.48 and 0.73.
    for (const storm of tropical) expect(Math.abs(storm.centre[1])).toBeLessThan(0.65);
    for (const storm of temperate) {
      expect(Math.abs(storm.centre[1])).toBeGreaterThanOrEqual(0.48 - 1e-9);
      expect(Math.abs(storm.centre[1])).toBeLessThanOrEqual(0.73 + 1e-9);
    }
    const mean = (list: typeof all) => list.reduce((sum, storm) => sum + Math.abs(storm.centre[1]), 0) / list.length;
    expect(mean(tropical)).toBeLessThan(mean(temperate));
  });

  it("lets a storm grow and fade instead of popping up", () => {
    const spec = globe("rocky", { cyclones: 0.95 });
    // Whenever a new storm appears between two steps of 0.1 s, it must start at almost no strength.
    let before = cyclonesAt(spec, 0).length;
    for (let t = 0.1; t < 400; t += 0.1) {
      const now = cyclonesAt(spec, t);
      if (now.length > before) expect(Math.min(...now.map((storm) => storm.strength))).toBeLessThan(0.05);
      before = now.length;
    }
  });

  it("has fewer cyclones on a calmer planet", () => {
    const count = (cyclones: number) =>
      MOMENTS.reduce((sum, t) => sum + stormUniforms(globe("rocky", { cyclones }), t).uCycloneCount, 0);
    expect(count(0.3)).toBeLessThan(count(0.95));
  });

  it("lets dust storms rise and settle, and now and then wrap the planet", () => {
    const spec = globe("rocky", { dust: 1 });
    let widest = 0;
    let alive = 0;
    // This span is long enough for dozens of storms.
    for (let t = 0; t < 6000; t += 9.7) {
      const { uDusts, uDustLives } = stormUniforms(spec, t);
      uDustLives.forEach((life, slot) => {
        expect(life).toBeGreaterThanOrEqual(0);
        expect(life).toBeLessThanOrEqual(1);
        if (life <= 0) return;
        alive++;
        const [x, y, z, radius] = uDusts.slice(slot * 4, slot * 4 + 4);
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
        expect(radius).toBeGreaterThanOrEqual(0.05);
        expect(radius).toBeLessThanOrEqual(3.3);
        widest = Math.max(widest, radius);
      });
    }
    expect(alive).toBeGreaterThan(100);
    // Half the way round the planet is a radius of pi, so a storm that reaches 3 covers nearly all of it.
    expect(widest).toBeGreaterThan(3);
  });

  it("breaks a plume out on a gas planet now and then, with a tail against the wind", () => {
    // At half strength, about every second cycle of the outbreak slot stays empty.
    const spec = globe("gas_giant", { outbreaks: 0.5 });
    const live = MOMENTS.map((t) => stormUniforms(spec, t)).filter((storms) => storms.uOutbreak[3] > 0);
    expect(live.length).toBeGreaterThan(10);
    expect(live.length).toBeLessThan(MOMENTS.length);
    for (const { uOutbreak, uOutbreakTail } of live) {
      const [, latitude, age, strength] = uOutbreak;
      expect(Math.abs(latitude)).toBeLessThan(Math.asin(0.6) + 1e-9);
      expect(age).toBeGreaterThan(0);
      expect(age).toBeLessThan(1);
      expect(strength).toBeLessThanOrEqual(1);
      expect(Math.abs(uOutbreakTail)).toBe(1);
    }
    expect(MOMENTS.every((t) => stormUniforms(globe("gas_giant", {}), t).uOutbreak[3] === 0)).toBe(true);
  });
});
