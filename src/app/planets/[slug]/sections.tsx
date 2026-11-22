import Link from "next/link";
import type { Planet, Star } from "@/db/schema";
import {
  formatDate,
  formatNumber,
  formatPeriod,
  kelvinToCelsius,
  parsecToLightYears,
} from "@/shared/format";
import { Fact, Facts, Section } from "@/shared/ui";
import type { Appearance } from "../appearance";
import { PlanetViewer } from "@/app/globe/PlanetViewer";
import { describePlanet, fieldLabel } from "../labels";
import { PlanetCard } from "../PlanetCard";
import { PlanetImage } from "../PlanetImage";
import type { PlanetChange, PlanetSummary } from "../queries";
import { SizeComparison } from "../SizeComparison";

/** The 3D model next to the name, the host star and a short introduction. */
export function PlanetHeader({
  planet,
  star,
  appearance,
  formerNames,
}: {
  planet: Planet;
  star: Star;
  appearance: Appearance;
  formerNames: string[];
}) {
  const isSolarSystem = planet.source === "sol";
  return (
    <header className="flex flex-col items-center gap-8 sm:flex-row">
      <PlanetViewer spec={JSON.stringify(appearance.globe)} name={planet.name}>
        <PlanetImage
          appearance={appearance}
          size={280}
          label={`Illustration of ${planet.name}`}
          animated={false}
        />
      </PlanetViewer>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{planet.name}</h1>
        <p className="text-lg text-muted">
          {describePlanet(planet.planetClass, planet.climateClass)} orbiting{" "}
          <Link
            href={`/stars/${star.slug}`}
            className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
          >
            {star.name}
          </Link>
          {star.distPc !== null &&
            star.distPc > 0 &&
            `, ${formatNumber(parsecToLightYears(star.distPc))} light-years from the Sun`}
        </p>
        {formerNames.length > 0 && (
          <p className="text-sm text-muted">Formerly listed as {formerNames.join(", ")}.</p>
        )}
        {planet.status === "active" && (
          <p className="text-sm">
            <Link
              href={`/map?system=${star.slug}&planet=${planet.slug}`}
              className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
            >
              See it on its orbit in 3D
            </Link>
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          {isSolarSystem
            ? "The model shows a real map of the planet, put together from spacecraft images."
            : "Nobody has seen this planet up close. The model is computed from the values below: it shows what a planet of this size and temperature could look like."}{" "}
          Drag it to look at every side, zoom with the buttons, with two fingers or with Ctrl and
          the mouse wheel.
        </p>
        {isSolarSystem && (
          <p className="text-xs text-muted">
            Map:{" "}
            <a
              className="underline-offset-4 underline decoration-current/40 hover:decoration-current"
              href="https://www.solarsystemscope.com/textures/"
            >
              Solar System Scope
            </a>
            , CC BY 4.0.
          </p>
        )}
      </div>
    </header>
  );
}

/** Size, mass, density and temperature, with a size comparison against Earth. */
export function PlanetFacts({ planet, appearance }: { planet: Planet; appearance: Appearance }) {
  const isEarth = planet.source === "sol" && planet.slug === "earth";
  return (
    <Section title="Planet">
      <Facts>
        <Fact
          label="Radius"
          value={planet.radiusEarth !== null ? `${formatNumber(planet.radiusEarth)} × Earth` : null}
          note={planet.radiusCalculated ? "calculated" : null}
        />
        <Fact
          label="Mass"
          value={planet.massEarth !== null ? `${formatNumber(planet.massEarth)} × Earth` : null}
          note={
            planet.massIsMinimum
              ? "minimum mass"
              : planet.massCalculated
                ? "calculated"
                : null
          }
        />
        <Fact
          label="Density"
          value={planet.density !== null ? `${formatNumber(planet.density)} g/cm³` : null}
          note={planet.densityCalculated ? "calculated" : null}
        />
        <Fact
          label="Equilibrium temperature"
          value={
            planet.eqTempK !== null
              ? `${formatNumber(planet.eqTempK)} K (${formatNumber(kelvinToCelsius(planet.eqTempK))} °C)`
              : null
          }
          note={planet.eqTempCalculated ? "calculated" : null}
        />
        <Fact
          label="Starlight received"
          value={planet.insolation !== null ? `${formatNumber(planet.insolation)} × Earth` : null}
          note={planet.insolationCalculated ? "calculated" : null}
        />
      </Facts>
      <p className="text-sm leading-6 text-muted">
        “Calculated” marks values that were derived from other measurements instead of being
        measured. “Minimum mass” means that only a lower limit is known, the true mass may be
        higher. The equilibrium temperature ignores any atmosphere, so the surface can be much
        warmer.
      </p>
      {planet.radiusEarth !== null && !isEarth && (
        <SizeComparison
          name={planet.name}
          radiusEarth={planet.radiusEarth}
          color={appearance.base}
        />
      )}
    </Section>
  );
}

export function OrbitFacts({ planet }: { planet: Planet }) {
  return (
    <Section title="Orbit">
      <Facts>
        <Fact
          label="Orbital period"
          value={planet.orbitalPeriodDays !== null ? formatPeriod(planet.orbitalPeriodDays) : null}
        />
        <Fact
          label="Distance from the star"
          value={planet.semiMajorAxisAu !== null ? `${formatNumber(planet.semiMajorAxisAu)} AU` : null}
        />
        <Fact
          label="Eccentricity"
          value={planet.eccentricity !== null ? formatNumber(planet.eccentricity) : null}
        />
      </Facts>
      <p className="text-sm leading-6 text-muted">
        1 AU is the distance between Earth and the Sun. An eccentricity of 0 is a perfect circle.
      </p>
    </Section>
  );
}

export function DiscoveryFacts({ planet }: { planet: Planet }) {
  return (
    <Section title="Discovery">
      <Facts>
        <Fact label="Method" value={planet.discoveryMethod} />
        <Fact label="Year" value={planet.discoveryYear} />
        <Fact label="Facility" value={planet.discoveryFacility} />
      </Facts>
    </Section>
  );
}

/** The host star in short, and the other known planets of its system. */
export function HostStar({ star, siblings }: { star: Star; siblings: PlanetSummary[] }) {
  return (
    <Section title={`Host star: ${star.name}`}>
      <Facts>
        <Fact label="Spectral type" value={star.spectralType} />
        <Fact
          label="Temperature"
          value={star.teffK !== null ? `${formatNumber(star.teffK)} K` : null}
        />
        <Fact
          label="Radius"
          value={star.radiusSun !== null ? `${formatNumber(star.radiusSun)} × Sun` : null}
        />
        <Fact
          label="Mass"
          value={star.massSun !== null ? `${formatNumber(star.massSun)} × Sun` : null}
        />
      </Facts>
      <p className="text-sm">
        <Link
          href={`/stars/${star.slug}`}
          className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
        >
          More about {star.name}
        </Link>
      </p>
      {siblings.length > 0 && (
        <>
          <h3 className="mt-2 text-sm text-muted">
            {siblings.length === 1
              ? "One other known planet in this system"
              : `${siblings.length} other known planets in this system`}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <PlanetCard planet={sibling} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/** The values that changed when the catalogue was compared with NASA. */
export function ChangeHistory({ changes }: { changes: PlanetChange[] }) {
  return (
    <Section title="Change history">
      <p className="text-sm leading-6 text-muted">
        Every time the catalogue is compared with NASA, changed values are recorded here.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">Date</th>
              <th className="py-2 pr-4 font-normal">Value</th>
              <th className="py-2 pr-4 font-normal">Before</th>
              <th className="py-2 font-normal">After</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.id} className="border-b border-line">
                <td className="py-2 pr-4 whitespace-nowrap">{formatDate(change.changedAt)}</td>
                <td className="py-2 pr-4">{fieldLabel(change.field)}</td>
                <td className="py-2 pr-4 font-mono">{change.oldValue ?? "unknown"}</td>
                <td className="py-2 font-mono">{change.newValue ?? "unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** Where the values come from. */
export function PlanetSources({ planet }: { planet: Planet }) {
  return (
    <footer className="text-sm leading-6 text-muted">
      {planet.source === "sol" ? (
        <>
          Values from the{" "}
          <a
            className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
            href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
          >
            NASA Planetary Fact Sheet
          </a>
          .
        </>
      ) : (
        <>
          Values from the NASA Exoplanet Archive, last changed here on{" "}
          {formatDate(planet.updatedAt)}.{" "}
          <a
            className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
            href={`https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.name)}`}
          >
            All data for {planet.name} in the archive
          </a>
        </>
      )}
    </footer>
  );
}
