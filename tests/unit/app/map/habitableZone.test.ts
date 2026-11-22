import { describe, expect, it } from "vitest";
import { habitableZone, zonePlace } from "@/app/map/habitableZone";

describe("habitableZone", () => {
  it("puts the Sun's zone where Kopparapu et al. found it", () => {
    const zone = habitableZone({ teffK: 5772, radiusSun: 1 })!;
    expect(zone.optimisticInner).toBeCloseTo(0.75, 2);
    expect(zone.inner).toBeCloseTo(0.95, 2);
    expect(zone.outer).toBeCloseTo(1.68, 2);
    expect(zone.optimisticOuter).toBeCloseTo(1.77, 2);
  });

  it("takes in Earth and Mars, Venus not even at its most optimistic", () => {
    const zone = habitableZone({ teffK: 5772, radiusSun: 1 })!;
    expect(zonePlace(zone, 0.723)).toBeNull();
    expect(zonePlace(zone, 1)).toBe("conservative");
    expect(zonePlace(zone, 1.524)).toBe("conservative");
    expect(zonePlace(zone, 1.72)).toBe("optimistic");
    expect(zonePlace(zone, 5.2)).toBeNull();
  });

  it("finds TRAPPIST-1 e, f and g in the zone and d at its edge", () => {
    const zone = habitableZone({ teffK: 2566, radiusSun: 0.1192 })!;
    const places = [0.0115, 0.0158, 0.0223, 0.0293, 0.0385, 0.0469, 0.0619].map((axis) => zonePlace(zone, axis));
    expect(places).toEqual([null, null, "optimistic", "conservative", "conservative", "conservative", null]);
  });

  it("lies farther out the brighter the star is", () => {
    const dwarf = habitableZone({ teffK: 3500, radiusSun: 0.4 })!;
    const sun = habitableZone({ teffK: 5772, radiusSun: 1 })!;
    const giant = habitableZone({ teffK: 4800, radiusSun: 10 })!;
    expect(dwarf.outer).toBeLessThan(sun.inner);
    expect(sun.optimisticOuter).toBeLessThan(giant.optimisticInner);
  });

  it("keeps its edges in order, also for stars beyond the fitted temperatures", () => {
    for (const teffK of [1800, 2600, 4000, 5772, 7200, 10000, 30000]) {
      const zone = habitableZone({ teffK, radiusSun: 1.3 })!;
      expect(zone.optimisticInner).toBeLessThan(zone.inner);
      expect(zone.inner).toBeLessThan(zone.outer);
      expect(zone.outer).toBeLessThan(zone.optimisticOuter);
    }
  });

  it("treats a star hotter than the fit as one at its end, apart from the luminosity", () => {
    const fitted = habitableZone({ teffK: 7200, radiusSun: 1 })!;
    const hotter = habitableZone({ teffK: 14400, radiusSun: 1 })!;
    // Twice the temperature is sixteen times the luminosity, which moves every edge out fourfold.
    expect(hotter.inner / fitted.inner).toBeCloseTo(4, 9);
  });

  it("is unknown without the star's temperature or radius", () => {
    expect(habitableZone({ teffK: null, radiusSun: 1 })).toBeNull();
    expect(habitableZone({ teffK: 5772, radiusSun: null })).toBeNull();
    expect(habitableZone({ teffK: 0, radiusSun: 1 })).toBeNull();
    expect(habitableZone({ teffK: 5772, radiusSun: -1 })).toBeNull();
  });
});
