import type { Messages } from "@/i18n/messages";
import type { FactRow } from "@/shared/facts";
import { AU_KM } from "@/shared/units";
import { massEarth, parentName, radiusEarth, surfaceGravity, type SolarBody } from "./bodies";
import { isRetrograde, type SmallMoon } from "./smallMoons";

/** Size, mass, density and surface gravity of a moon, a dwarf planet or Vesta. */
export function bodyFacts(body: SolarBody, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  const mass = massEarth(body);
  const gravity = surfaceGravity(body);
  return [
    { label: facts.radius, value: `${fmt.number(body.radiusKm)} km (${facts.timesEarth(fmt.number(radiusEarth(body)))})` },
    {
      label: facts.mass,
      // Small moons weigh billions of times less than Earth, so their mass reads better in kilograms.
      value:
        mass === null
          ? null
          : mass < 1e-6
            ? m.body.massKilograms(fmt.number((mass * 5.9722e24) / 1e15))
            : facts.timesEarth(fmt.number(mass)),
    },
    { label: facts.density, value: body.density === null ? null : `${fmt.number(body.density)} g/cm³` },
    {
      label: facts.surfaceGravity,
      // The pull on the surface of a small moon is a few thousandths of a metre per second squared.
      value: gravity === null ? null : gravity < 0.01 ? `${fmt.number(gravity * 1000)} mm/s²` : `${fmt.number(gravity)} m/s²`,
    },
  ];
}

export function bodyOrbitFacts(body: SolarBody, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  return [
    { label: facts.orbits, value: parentName(body, m) },
    { label: facts.orbitalPeriod, value: fmt.period(body.orbitalPeriodDays) },
    {
      label: body.parent === "sun" ? facts.distanceFromSun : facts.distanceFromPlanet,
      value:
        body.parent === "sun"
          ? `${fmt.number(body.semiMajorAxisKm / AU_KM)} ${facts.au}`
          : `${fmt.number(body.semiMajorAxisKm)} km`,
    },
    { label: facts.eccentricity, value: fmt.number(body.eccentricity) },
    { label: facts.inclination, value: `${fmt.number(body.inclinationDeg)}°` },
  ];
}

/** The discovery of a body, or null for one known since antiquity, which has no discoverer to name. */
export function bodyDiscoveryFacts(body: SolarBody, m: Messages): FactRow[] | null {
  if (body.discoveryYear === null) return null;
  return [
    { label: m.facts.year, value: String(body.discoveryYear) },
    { label: m.facts.discoveredBy, value: body.discoverer },
  ];
}

export function smallMoonFacts(moon: SmallMoon, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  return [
    {
      label: facts.radius,
      value: moon.radius === null ? null : `${moon.measured ? "" : "≈ "}${fmt.number(moon.radius)} km`,
      note: moon.measured ? null : facts.estimated,
    },
    { label: facts.group, value: moon.group && (facts.groups[moon.group] ?? moon.group) },
  ];
}

export function smallMoonOrbitFacts(moon: SmallMoon, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  const planet = parentName(moon, m);
  return [
    { label: facts.orbits, value: planet },
    { label: facts.orbitalPeriod, value: fmt.period(moon.period) },
    { label: facts.distanceFrom(planet), value: `${fmt.count(Math.round(moon.a))} km` },
    { label: facts.eccentricity, value: fmt.number(moon.e) },
    { label: facts.inclination, value: `${fmt.number(moon.i)}°` },
    { label: facts.direction, value: isRetrograde(moon) ? facts.backwards : facts.withSpin(planet) },
  ];
}

export function smallMoonDiscoveryFacts(moon: SmallMoon, m: Messages): FactRow[] {
  return [
    { label: m.facts.year, value: moon.year === null ? null : String(moon.year) },
    { label: m.facts.discoveredBy, value: moon.discoverer },
  ];
}
