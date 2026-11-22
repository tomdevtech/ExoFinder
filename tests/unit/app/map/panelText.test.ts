import { describe, expect, it } from "vitest";
import { distanceText, planetsText } from "@/app/map/panelText";

describe("distanceText", () => {
  it("gives the distance from the Sun in light-years", () => {
    expect(distanceText(1)).toBe("3.26 light-years from the Sun");
    expect(distanceText(12.43)).toBe("40.5 light-years from the Sun");
    expect(distanceText(1000)).toBe("3,262 light-years from the Sun");
  });
});

describe("planetsText", () => {
  it("counts the known planets of a star, with the singular for one", () => {
    expect(planetsText(1)).toBe("1 known planet");
    expect(planetsText(7)).toBe("7 known planets");
    expect(planetsText(0)).toBe("0 known planets");
  });
});
