import { describe, expect, it } from "vitest";
import { distanceText, planetsText } from "@/app/map/panelText";
import { de } from "@/i18n/messages/de";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";

describe("distanceText", () => {
  it("gives the distance from the Sun in light-years", () => {
    expect(distanceText(1, en.client.map, en.fmt)).toBe("3.26 light-years from the Sun");
    expect(distanceText(12.43, en.client.map, en.fmt)).toBe("40.5 light-years from the Sun");
    expect(distanceText(1000, en.client.map, en.fmt)).toBe("3,262 light-years from the Sun");
  });

  it("writes the number the way the language does", () => {
    expect(distanceText(12.43, de.client.map, de.fmt)).toBe("40,5 Lichtjahre von der Sonne");
    expect(distanceText(1000, tr.client.map, tr.fmt)).toBe("Güneş’ten 3.262 ışık yılı uzakta");
  });
});

describe("planetsText", () => {
  it("counts the known planets of a star, with the singular for one", () => {
    expect(planetsText(1, en.client.map)).toBe("1 known planet");
    expect(planetsText(7, en.client.map)).toBe("7 known planets");
    expect(planetsText(0, en.client.map)).toBe("0 known planets");
    expect(planetsText(1, de.client.map)).toBe("1 bekannter Planet");
    expect(planetsText(7, de.client.map)).toBe("7 bekannte Planeten");
    expect(planetsText(7, tr.client.map)).toBe("bilinen 7 gezegen");
  });
});
