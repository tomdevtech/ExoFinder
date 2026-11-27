import type { FactRow } from "@/shared/facts";
import { formatCount, formatNumber, formatPeriod } from "@/shared/format";
import { AU_KM } from "@/shared/units";
import { massEarth, parentName, radiusEarth, surfaceGravity, type SolarBody } from "./bodies";
import { isRetrograde, type SmallMoon } from "./smallMoons";

/** Small moons weigh billions of times less than Earth, so their mass reads better in kilograms. */
function massText(earths: number | null): string | null {
  if (earths === null) return null;
  return earths < 1e-6 ? `${formatNumber((earths * 5.9722e24) / 1e15)} × 10¹⁵ kg` : `${formatNumber(earths)} × Earth`;
}

/** The pull on the surface of a small moon is a few thousandths of a metre per second squared. */
function gravityText(gravity: number | null): string | null {
  if (gravity === null) return null;
  return gravity < 0.01 ? `${formatNumber(gravity * 1000)} mm/s²` : `${formatNumber(gravity)} m/s²`;
}

/** Size, mass, density and surface gravity of a moon, a dwarf planet or Vesta. */
export function bodyFacts(body: SolarBody): FactRow[] {
  return [
    { label: "Radius", value: `${formatNumber(body.radiusKm)} km (${formatNumber(radiusEarth(body))} × Earth)` },
    { label: "Mass", value: massText(massEarth(body)) },
    { label: "Density", value: body.density === null ? null : `${formatNumber(body.density)} g/cm³` },
    { label: "Surface gravity", value: gravityText(surfaceGravity(body)) },
  ];
}

export function bodyOrbitFacts(body: SolarBody): FactRow[] {
  return [
    { label: "Orbits", value: parentName(body) },
    { label: "Orbital period", value: formatPeriod(body.orbitalPeriodDays) },
    {
      label: body.parent === "sun" ? "Distance from the Sun" : "Distance from the planet",
      value:
        body.parent === "sun"
          ? `${formatNumber(body.semiMajorAxisKm / AU_KM)} AU`
          : `${formatNumber(body.semiMajorAxisKm)} km`,
    },
    { label: "Eccentricity", value: formatNumber(body.eccentricity) },
    { label: "Inclination", value: `${formatNumber(body.inclinationDeg)}°` },
  ];
}

/** The discovery of a body, or null for one known since antiquity, which has no discoverer to name. */
export function bodyDiscoveryFacts(body: SolarBody): FactRow[] | null {
  if (body.discoveryYear === null) return null;
  return [
    { label: "Year", value: String(body.discoveryYear) },
    { label: "Discovered by", value: body.discoverer },
  ];
}

export function smallMoonFacts(moon: SmallMoon): FactRow[] {
  return [
    {
      label: "Radius",
      value: moon.radius === null ? null : `${moon.measured ? "" : "≈ "}${formatNumber(moon.radius)} km`,
      note: moon.measured ? null : "estimated",
    },
    { label: "Group", value: moon.group },
  ];
}

export function smallMoonOrbitFacts(moon: SmallMoon): FactRow[] {
  const planet = parentName(moon);
  return [
    { label: "Orbits", value: planet },
    { label: "Orbital period", value: formatPeriod(moon.period) },
    { label: `Distance from ${planet}`, value: `${formatCount(Math.round(moon.a))} km` },
    { label: "Eccentricity", value: formatNumber(moon.e) },
    { label: "Inclination", value: `${formatNumber(moon.i)}°` },
    { label: "Direction", value: isRetrograde(moon) ? "backwards" : `with the spin of ${planet}` },
  ];
}

export function smallMoonDiscoveryFacts(moon: SmallMoon): FactRow[] {
  return [
    { label: "Year", value: moon.year === null ? null : String(moon.year) },
    { label: "Discovered by", value: moon.discoverer },
  ];
}
