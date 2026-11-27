import Link from "next/link";
import type { ReactNode } from "react";
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
export function SmallMoonArticle({ moon, children }: { moon: SmallMoon; children?: ReactNode }) {
  const planet = parentName(moon);
  return (
    <article className="flex flex-col gap-12">
      {children}
      <header className="flex flex-col items-center gap-8 sm:flex-row">
        {/* The map makes its model of the moon from the same seed, so both show the same body. */}
        <ShapeViewer name={moon.name} shape={{ seed: hashText(moon.name) }} />
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{moon.name}</h1>
          <p className="text-lg text-muted">
            Moon of{" "}
            <Link href={parentHref(moon)} className={LINK}>
              {planet}
            </Link>
          </p>
          <p className="text-sm">
            <Link href={`/map?system=sun&planet=${moon.parent}&moon=${moon.slug}`} className={LINK}>
              See it on its orbit in 3D
            </Link>
          </p>
          <p className="text-sm leading-6 text-muted">
            ExoFinder has no shape model and no map of {moon.name}, so the model is an illustration: its
            shape and its surface are made up, and only the values below are real. Drag it to look at every
            side, zoom with the buttons, with two fingers or with Ctrl and the mouse wheel.
          </p>
        </div>
      </header>

      <Section title="Moon">
        <FactRows rows={smallMoonFacts(moon)} />
        <p className="text-sm leading-6 text-muted">
          {moon.measured
            ? "The radius is the mean radius. "
            : "Most small moons have only been seen as points of light, so the radius is estimated from how bright the moon looks. "}
          No spacecraft has measured the pull of most small moons, so no mass is given.
          {moon.group &&
            " The moons of a group circle on similar orbits; the far groups are thought to be the pieces of bodies that broke apart."}
        </p>
      </Section>

      <Section title="Orbit">
        <FactRows rows={smallMoonOrbitFacts(moon)} />
        <p className="text-sm leading-6 text-muted">
          The distance is the mean distance between the centres. The inclination is measured against{" "}
          {moon.plane === "ecliptic"
            ? "the plane of Earth's orbit, as for most of the far moons that a planet captured"
            : `the plane the orbit circles about, close to the equator of ${planet}`}
          ; above 90° the moon orbits backwards.
        </p>
      </Section>

      <Section title="Discovery">
        <FactRows rows={smallMoonDiscoveryFacts(moon)} />
      </Section>

      <footer className="text-sm leading-6 text-muted">
        Orbit and discovery from{" "}
        <a className={LINK} href="https://ssd.jpl.nasa.gov/sats/">
          JPL Solar System Dynamics
        </a>
        , estimated sizes and groups also from{" "}
        <a className={LINK} href="https://sites.google.com/carnegiescience.edu/sheppard/moons">
          Scott Sheppard
        </a>
        .{" "}
        <Link className={LINK} href={parentHref(moon)}>
          All moons of {planet}
        </Link>
      </footer>
    </article>
  );
}
