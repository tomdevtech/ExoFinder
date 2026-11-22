import { describe, expect, it } from "vitest";
import { approach, clamp, hashText, mixLog, seededRandom, smoothstep, wrapAngle } from "@/shared/math";

describe("seededRandom", () => {
  it("gives the same sequence for the same seed, so what is drawn by lot never changes", () => {
    const random = seededRandom(42);
    // Belts, galaxy clouds, star fields and base maps were all drawn with this sequence.
    expect([random(), random(), random()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    const again = seededRandom(42);
    expect(again()).toBe(0.6011037519201636);
  });

  it("gives another sequence for another seed", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it("stays from 0 up to, but not including, 1", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 10000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads its numbers evenly", () => {
    const random = seededRandom(2026);
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += random();
    expect(sum / 20000).toBeCloseTo(0.5, 2);
  });

  it("takes any number as a seed", () => {
    expect(seededRandom(-1)()).toBe(seededRandom(4294967295)());
    expect(seededRandom(3.9)()).toBe(seededRandom(3)());
  });
});

describe("hashText", () => {
  it("is the 32-bit FNV-1a hash", () => {
    expect(hashText("")).toBe(0x811c9dc5);
    expect(hashText("a")).toBe(0xe40c292c);
  });

  it("gives a planet the same number on every visit", () => {
    // The look of every planet is drawn from this number, so it must never change.
    expect(hashText("kepler-22-b")).toBe(2681254814);
  });

  it("tells similar texts apart", () => {
    expect(hashText("kepler-22-b")).not.toBe(hashText("kepler-22-c"));
    expect(hashText("earth/tilt")).not.toBe(hashText("earth/rings"));
  });

  it("is a whole number that fits 32 bits", () => {
    for (const text of ["", "sun", "TRAPPIST-1 e", "ü"]) {
      const hash = hashText(text);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("clamp", () => {
  it("keeps a value within its limits", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
  });
});

describe("smoothstep", () => {
  it("is 0 up to the lower edge and 1 from the upper edge on", () => {
    expect(smoothstep(2, 4, 1)).toBe(0);
    expect(smoothstep(2, 4, 2)).toBe(0);
    expect(smoothstep(2, 4, 4)).toBe(1);
    expect(smoothstep(2, 4, 9)).toBe(1);
  });

  it("rises smoothly in between", () => {
    expect(smoothstep(2, 4, 3)).toBe(0.5);
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(0.15625, 10);
    expect(smoothstep(0, 1, 0.1)).toBeLessThan(0.1);
    expect(smoothstep(0, 1, 0.9)).toBeGreaterThan(0.9);
  });

  it("falls when the edges are given the other way round", () => {
    expect(smoothstep(4, 2, 1)).toBe(1);
    expect(smoothstep(4, 2, 5)).toBe(0);
  });
});

describe("approach", () => {
  it("moves towards the goal by the step, from either side", () => {
    expect(approach(0, 1, 0.25)).toBe(0.25);
    expect(approach(1, 0, 0.25)).toBe(0.75);
  });

  it("stops at the goal instead of passing it", () => {
    expect(approach(0.9, 1, 0.25)).toBe(1);
    expect(approach(0.1, 0, 0.25)).toBe(0);
    expect(approach(1, 1, 0.25)).toBe(1);
  });
});

describe("wrapAngle", () => {
  it("leaves an angle within half a turn as it is", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(1)).toBeCloseTo(1, 12);
    expect(wrapAngle(-2)).toBeCloseTo(-2, 12);
  });

  it("takes the short way round for a larger one", () => {
    expect(wrapAngle(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 12);
    expect(wrapAngle(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5, 12);
    expect(wrapAngle(7 * 2 * Math.PI + 0.25)).toBeCloseTo(0.25, 10);
    expect(wrapAngle(-7 * 2 * Math.PI - 0.25)).toBeCloseTo(-0.25, 10);
  });

  it("stays from -π up to π", () => {
    for (let angle = -20; angle <= 20; angle += 0.37) {
      const wrapped = wrapAngle(angle);
      expect(wrapped).toBeGreaterThanOrEqual(-Math.PI);
      expect(wrapped).toBeLessThan(Math.PI);
      expect(Math.sin(wrapped)).toBeCloseTo(Math.sin(angle), 10);
    }
  });
});

describe("mixLog", () => {
  it("is the first value at 0 and the second at 1", () => {
    expect(mixLog(3, 3000, 0)).toBe(3);
    expect(mixLog(3, 3000, 1)).toBeCloseTo(3000, 9);
  });

  it("is the geometric mean half-way, so a change across powers of ten looks even", () => {
    expect(mixLog(1, 100, 0.5)).toBeCloseTo(10, 12);
    expect(mixLog(0.001, 1000, 0.5)).toBeCloseTo(1, 12);
  });

  it("works downwards as well", () => {
    expect(mixLog(100, 1, 0.5)).toBeCloseTo(10, 12);
  });
});
