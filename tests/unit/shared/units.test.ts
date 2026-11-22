import { describe, expect, it } from "vitest";
import { AU_KM, EARTH_RADIUS_KM, SUN_RADIUS_KM } from "@/shared/units";

describe("units", () => {
  it("holds the published lengths in kilometres", () => {
    expect(AU_KM).toBe(149597870.7);
    expect(EARTH_RADIUS_KM).toBe(6371);
    expect(SUN_RADIUS_KM).toBe(695700);
  });

  it("puts the Sun at 109 Earth radii and the Earth 215 solar radii out", () => {
    expect(SUN_RADIUS_KM / EARTH_RADIUS_KM).toBeCloseTo(109.2, 1);
    expect(AU_KM / SUN_RADIUS_KM).toBeCloseTo(215.03, 2);
  });
});
