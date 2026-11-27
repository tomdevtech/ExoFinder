import type { Planet, Star } from "@/db/schema";
import type { FactRow } from "@/shared/facts";
import { formatNumber, formatPeriod, kelvinToCelsius } from "@/shared/format";

const timesEarth = (value: number | null) => (value !== null ? `${formatNumber(value)} × Earth` : null);
const timesSun = (value: number | null) => (value !== null ? `${formatNumber(value)} × Sun` : null);

/** Size, mass, density and temperature of a planet, each marked where NASA only calculated it. */
export function planetFacts(planet: Planet): FactRow[] {
  return [
    { label: "Radius", value: timesEarth(planet.radiusEarth), note: planet.radiusCalculated ? "calculated" : null },
    {
      label: "Mass",
      value: timesEarth(planet.massEarth),
      note: planet.massIsMinimum ? "minimum mass" : planet.massCalculated ? "calculated" : null,
    },
    {
      label: "Density",
      value: planet.density !== null ? `${formatNumber(planet.density)} g/cm³` : null,
      note: planet.densityCalculated ? "calculated" : null,
    },
    {
      label: "Equilibrium temperature",
      value:
        planet.eqTempK !== null
          ? `${formatNumber(planet.eqTempK)} K (${formatNumber(kelvinToCelsius(planet.eqTempK))} °C)`
          : null,
      note: planet.eqTempCalculated ? "calculated" : null,
    },
    {
      label: "Starlight received",
      value: timesEarth(planet.insolation),
      note: planet.insolationCalculated ? "calculated" : null,
    },
  ];
}

export function orbitFacts(planet: Planet): FactRow[] {
  return [
    { label: "Orbital period", value: planet.orbitalPeriodDays !== null ? formatPeriod(planet.orbitalPeriodDays) : null },
    {
      label: "Distance from the star",
      value: planet.semiMajorAxisAu !== null ? `${formatNumber(planet.semiMajorAxisAu)} AU` : null,
    },
    { label: "Eccentricity", value: planet.eccentricity !== null ? formatNumber(planet.eccentricity) : null },
  ];
}

export function discoveryFacts(planet: Planet): FactRow[] {
  return [
    { label: "Method", value: planet.discoveryMethod },
    { label: "Year", value: planet.discoveryYear !== null ? String(planet.discoveryYear) : null },
    { label: "Facility", value: planet.discoveryFacility },
  ];
}

/** The host star in short, as the page of a planet shows it. */
export function hostStarFacts(star: Star): FactRow[] {
  return [
    { label: "Spectral type", value: star.spectralType },
    { label: "Temperature", value: star.teffK !== null ? `${formatNumber(star.teffK)} K` : null },
    { label: "Radius", value: timesSun(star.radiusSun) },
    { label: "Mass", value: timesSun(star.massSun) },
  ];
}
