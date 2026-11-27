import type { ReactNode } from "react";
import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { hashText } from "@/shared/math";
import { FactRows, Section } from "@/shared/ui";
import { parentHref, parentName } from "./bodies";
import { smallMoonDiscoveryFacts, smallMoonFacts, smallMoonOrbitFacts } from "./facts";
import { ShapeViewer } from "./ShapeViewer";
import type { SmallMoon } from "./smallMoons";

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

/**
 * The page of a small moon: what is known of its size, its orbit and its discovery, with a made-up model.
 * `children` stand above it, which is where the page puts the links that browse the catalogue.
 */
export async function SmallMoonArticle({ moon, children }: { moon: SmallMoon; children?: ReactNode }) {
  const m = await getMessages();
  const text = m.smallMoon;
  const planet = parentName(moon, m);
  const [beforeParent, afterParent] = m.body.headline("moon", planet);
  const [beforeJpl, beforeSheppard, afterSheppard] = text.source;
  return (
    <article className="flex flex-col gap-12">
      {children}
      <header className="flex flex-col items-center gap-8 sm:flex-row">
        {/* The map makes its model of the moon from the same seed, so both show the same body. */}
        <ShapeViewer name={moon.name} shape={{ seed: hashText(moon.name) }} />
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{moon.name}</h1>
          <p className="text-lg text-muted">
            {beforeParent}
            <Link href={parentHref(moon)} className={LINK}>
              {planet}
            </Link>
            {afterParent}
          </p>
          <p className="text-sm">
            <Link href={`/map?system=sun&planet=${moon.parent}&moon=${moon.slug}`} className={LINK}>
              {m.body.onOrbit}
            </Link>
          </p>
          <p className="text-sm leading-6 text-muted">{text.model(moon.name)}</p>
        </div>
      </header>

      <Section title={m.body.moon}>
        <FactRows rows={smallMoonFacts(moon, m)} />
        <p className="text-sm leading-6 text-muted">
          {moon.measured ? text.radiusMeasured : text.radiusEstimated}
          {text.noMass}
          {moon.group && text.groupNote}
        </p>
      </Section>

      <Section title={m.planet.orbit}>
        <FactRows rows={smallMoonOrbitFacts(moon, m)} />
        <p className="text-sm leading-6 text-muted">{text.orbitNote(moon.plane === "ecliptic", planet)}</p>
      </Section>

      <Section title={m.planet.discovery}>
        <FactRows rows={smallMoonDiscoveryFacts(moon, m)} />
      </Section>

      <footer className="text-sm leading-6 text-muted">
        {beforeJpl}
        <a className={LINK} href="https://ssd.jpl.nasa.gov/sats/">
          JPL Solar System Dynamics
        </a>
        {beforeSheppard}
        <a className={LINK} href="https://sites.google.com/carnegiescience.edu/sheppard/moons">
          Scott Sheppard
        </a>
        {afterSheppard}{" "}
        <Link className={LINK} href={parentHref(moon)}>
          {text.allMoons(planet)}
        </Link>
      </footer>
    </article>
  );
}
