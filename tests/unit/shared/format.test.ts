import { describe, expect, it } from "vitest";
import { fill, formatters, kelvinToCelsius, parsecToLightYears } from "@/shared/format";

const english = formatters("en-US", { days: "{n} days", years: "{n} years" });
const german = formatters("de-DE", { days: "{n} Tage", years: "{n} Jahre" });
const turkish = formatters("tr-TR", { days: "{n} gün", years: "{n} yıl" });

describe("number", () => {
  it("keeps about three significant digits", () => {
    expect(english.number(1234.5)).toBe("1,235");
    expect(english.number(317.8)).toBe("318");
    expect(english.number(12.345)).toBe("12.3");
    expect(english.number(1.2345)).toBe("1.23");
    expect(english.number(0.01234)).toBe("0.0123");
    expect(english.number(0)).toBe("0");
  });

  it("uses the separators of the language", () => {
    expect(german.number(1234.5)).toBe("1.235");
    expect(german.number(12.345)).toBe("12,3");
    expect(turkish.number(0.01234)).toBe("0,0123");
  });
});

describe("count", () => {
  it("adds thousands separators", () => {
    expect(english.count(6470)).toBe("6,470");
    expect(german.count(6470)).toBe("6.470");
    expect(turkish.count(6470)).toBe("6.470");
  });
});

describe("period", () => {
  it("uses days below two years and years above", () => {
    expect(english.period(3.5)).toBe("3.5 days");
    expect(english.period(365.2)).toBe("365 days");
    expect(english.period(4331)).toBe("11.9 years");
  });

  it("uses the words and the separators of the language", () => {
    expect(german.period(3.5)).toBe("3,5 Tage");
    expect(turkish.period(4331)).toBe("11,9 yıl");
  });
});

describe("dates", () => {
  const date = new Date("2026-11-14T19:53:00Z");

  it("prints dates in UTC", () => {
    expect(english.date(date)).toBe("November 14, 2026");
    expect(english.date(new Date("2026-11-14T23:30:00Z"))).toBe("November 14, 2026");
    expect(german.date(date)).toBe("14. November 2026");
    expect(turkish.date(date)).toBe("14 Kasım 2026");
  });

  it("prints date and time with the time zone", () => {
    expect(english.dateTime(date)).toMatch(/^November 14, 2026.*7:53.PM UTC$/);
    expect(german.dateTime(date)).toMatch(/^14\. November 2026.*19:53 UTC$/);
  });
});

describe("fill", () => {
  it("puts values into the places of a text and leaves a place it has no value for", () => {
    expect(fill("{n} known planets", { n: 7 })).toBe("7 known planets");
    expect(fill("Moons of {name}", { name: "Saturn" })).toBe("Moons of Saturn");
    expect(fill("{inner} to {outer} AU", { inner: "0.9" })).toBe("0.9 to {outer} AU");
  });
});

describe("unit conversion", () => {
  it("converts parsecs to light-years", () => {
    expect(parsecToLightYears(1)).toBeCloseTo(3.26156, 5);
    expect(parsecToLightYears(10)).toBeCloseTo(32.6156, 4);
  });

  it("converts kelvin to degrees Celsius", () => {
    expect(kelvinToCelsius(273.15)).toBeCloseTo(0, 10);
    expect(kelvinToCelsius(0)).toBeCloseTo(-273.15, 10);
  });
});
