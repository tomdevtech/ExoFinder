import type { Planet, Star } from "@/db/schema";
import { Link } from "@/i18n/client";
import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { parsecToLightYears } from "@/shared/format";
import { FactRows, Section } from "@/shared/ui";
import { PlanetViewer } from "@/app/globe/PlanetViewer";
import type { Appearance } from "./appearance";
import { discoveryFacts, hostStarFacts, orbitFacts, planetFacts } from "./facts";
import { PlanetCard } from "./PlanetCard";
import { PlanetImage } from "./PlanetImage";
import type { PlanetChange, PlanetSummary } from "./queries";
import { SizeComparison } from "./SizeComparison";

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

/** The 3D model next to the name, the host star and a short introduction. */
export async function PlanetHeader({
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
  const m = await getMessages();
  const text = m.planet;
  const isSolarSystem = planet.source === "sol";
  const name = nameOf(m, planet.slug, planet.name);
  const [beforeStar, afterStar] = text.headline(
    m.classes.describe(planet.planetClass, planet.climateClass),
    isSolarSystem,
  );
  return (
    <header className="flex flex-col items-center gap-8 sm:flex-row">
      <PlanetViewer spec={JSON.stringify(appearance.globe)} name={name}>
        <PlanetImage appearance={appearance} size={280} label={text.illustration(name)} animated={false} />
      </PlanetViewer>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{name}</h1>
        <p className="text-lg text-muted">
          {beforeStar}
          <Link href={`/stars/${star.slug}`} className={LINK}>
            {nameOf(m, star.slug, star.name)}
          </Link>
          {afterStar}
          {star.distPc !== null && star.distPc > 0 && text.distance(m.fmt.number(parsecToLightYears(star.distPc)))}
        </p>
        {formerNames.length > 0 && <p className="text-sm text-muted">{text.formerly(formerNames.join(", "))}</p>}
        {planet.status === "active" && (
          <p className="text-sm">
            <Link href={`/map?system=${star.slug}&planet=${planet.slug}`} className={LINK}>
              {text.onOrbit}
            </Link>
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          {isSolarSystem ? text.modelReal : text.modelComputed} {text.modelHowTo}
        </p>
        {isSolarSystem && (
          <p className="text-xs text-muted">
            {text.mapCredit}
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
export async function PlanetFacts({ planet, appearance }: { planet: Planet; appearance: Appearance }) {
  const m = await getMessages();
  const isEarth = planet.source === "sol" && planet.slug === "earth";
  return (
    <Section title={m.planet.section}>
      <FactRows rows={planetFacts(planet, m)} />
      <p className="text-sm leading-6 text-muted">{m.planet.calculatedNote}</p>
      {planet.radiusEarth !== null && !isEarth && (
        <SizeComparison name={nameOf(m, planet.slug, planet.name)} radiusEarth={planet.radiusEarth} color={appearance.base} />
      )}
    </Section>
  );
}

export async function OrbitFacts({ planet }: { planet: Planet }) {
  const m = await getMessages();
  return (
    <Section title={m.planet.orbit}>
      <FactRows rows={orbitFacts(planet, m)} />
      <p className="text-sm leading-6 text-muted">{m.planet.orbitNote}</p>
    </Section>
  );
}

export async function DiscoveryFacts({ planet }: { planet: Planet }) {
  const m = await getMessages();
  return (
    <Section title={m.planet.discovery}>
      <FactRows rows={discoveryFacts(planet, m)} />
    </Section>
  );
}

/** The host star in short, and the other known planets of its system. */
export async function HostStar({ star, siblings }: { star: Star; siblings: PlanetSummary[] }) {
  const m = await getMessages();
  const name = nameOf(m, star.slug, star.name);
  return (
    <Section title={m.planet.hostStar(name)}>
      <FactRows rows={hostStarFacts(star, m)} />
      <p className="text-sm">
        <Link href={`/stars/${star.slug}`} className={LINK}>
          {m.planet.moreAbout(name)}
        </Link>
      </p>
      {siblings.length > 0 && (
        <>
          <h3 className="mt-2 text-sm text-muted">{m.planet.others(siblings.length)}</h3>
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
export async function ChangeHistory({ changes }: { changes: PlanetChange[] }) {
  const m = await getMessages();
  const text = m.planet;
  return (
    <Section title={text.history}>
      <p className="text-sm leading-6 text-muted">{text.historyIntro}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-4 font-normal">{text.date}</th>
              <th className="py-2 pr-4 font-normal">{text.value}</th>
              <th className="py-2 pr-4 font-normal">{text.before}</th>
              <th className="py-2 font-normal">{text.after}</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.id} className="border-b border-line">
                <td className="py-2 pr-4 whitespace-nowrap">{m.fmt.date(change.changedAt)}</td>
                <td className="py-2 pr-4">{m.fields[change.field] ?? change.field}</td>
                <td className="py-2 pr-4 font-mono">{change.oldValue ?? m.facts.unknown}</td>
                <td className="py-2 font-mono">{change.newValue ?? m.facts.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** Where the values come from. */
export async function PlanetSources({ planet }: { planet: Planet }) {
  const m = await getMessages();
  const text = m.planet;
  return (
    <footer className="text-sm leading-6 text-muted">
      {planet.source === "sol" ? (
        <>
          {text.valuesFrom}
          <a className={LINK} href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/">
            {text.factSheet}
          </a>
          .
        </>
      ) : (
        <>
          {text.archiveSource(m.fmt.date(planet.updatedAt))}
          <a
            className={LINK}
            href={`https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.name)}`}
          >
            {text.allData(planet.name)}
          </a>
        </>
      )}
    </footer>
  );
}
