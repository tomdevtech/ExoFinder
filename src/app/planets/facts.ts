import type { Planet, Star } from "@/db/schema";
import type { Messages } from "@/i18n/messages";
import type { FactRow } from "@/shared/facts";
import { kelvinToCelsius } from "@/shared/format";

/** Size, mass, density and temperature of a planet, each marked where NASA only calculated it. */
export function planetFacts(planet: Planet, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  const timesEarth = (value: number | null) => (value !== null ? facts.timesEarth(fmt.number(value)) : null);
  return [
    { label: facts.radius, value: timesEarth(planet.radiusEarth), note: planet.radiusCalculated ? facts.calculated : null },
    {
      label: facts.mass,
      value: timesEarth(planet.massEarth),
      note: planet.massIsMinimum ? facts.minimumMass : planet.massCalculated ? facts.calculated : null,
    },
    {
      label: facts.density,
      value: planet.density !== null ? `${fmt.number(planet.density)} g/cm³` : null,
      note: planet.densityCalculated ? facts.calculated : null,
    },
    {
      label: facts.equilibriumTemperature,
      value:
        planet.eqTempK !== null ? `${fmt.number(planet.eqTempK)} K (${fmt.number(kelvinToCelsius(planet.eqTempK))} °C)` : null,
      note: planet.eqTempCalculated ? facts.calculated : null,
    },
    {
      label: facts.starlight,
      value: timesEarth(planet.insolation),
      note: planet.insolationCalculated ? facts.calculated : null,
    },
  ];
}

export function orbitFacts(planet: Planet, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  return [
    { label: facts.orbitalPeriod, value: planet.orbitalPeriodDays !== null ? fmt.period(planet.orbitalPeriodDays) : null },
    {
      label: facts.distanceFromStar,
      value: planet.semiMajorAxisAu !== null ? `${fmt.number(planet.semiMajorAxisAu)} ${facts.au}` : null,
    },
    { label: facts.eccentricity, value: planet.eccentricity !== null ? fmt.number(planet.eccentricity) : null },
  ];
}

export function discoveryFacts(planet: Planet, m: Messages): FactRow[] {
  const { facts } = m;
  return [
    // NASA names the method in English; a language shows its own word where it has one.
    { label: facts.method, value: planet.discoveryMethod && (facts.methods[planet.discoveryMethod] ?? planet.discoveryMethod) },
    { label: facts.year, value: planet.discoveryYear !== null ? String(planet.discoveryYear) : null },
    { label: facts.facility, value: planet.discoveryFacility },
  ];
}

/** The host star in short, as the page of a planet shows it. */
export function hostStarFacts(star: Star, m: Messages): FactRow[] {
  const { facts, fmt } = m;
  const timesSun = (value: number | null) => (value !== null ? facts.timesSun(fmt.number(value)) : null);
  return [
    { label: facts.spectralType, value: star.spectralType },
    { label: facts.temperature, value: star.teffK !== null ? `${fmt.number(star.teffK)} K` : null },
    { label: facts.radius, value: timesSun(star.radiusSun) },
    { label: facts.mass, value: timesSun(star.massSun) },
  ];
}
