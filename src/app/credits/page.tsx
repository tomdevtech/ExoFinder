import type { Metadata } from "next";
import { SOLAR_BODIES } from "@/app/solar-system/bodies";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SHAPE_SOURCES } from "@/app/solar-system/shapes";
import { Section } from "@/shared/ui";

export const metadata: Metadata = {
  title: "Credits",
  description: "Where the pictures, maps, shapes and values in ExoFinder come from, and under which licences.",
};

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

/**
 * Every source of a picture, map, shape or value, in one place. The map links here instead of crediting
 * each source on screen, which CC BY 4.0 allows (section 3(a)(2): attribution through a link to a page that
 * holds the required information).
 */
export default function CreditsPage() {
  const name = (slug: string) => SOLAR_BODIES.find((body) => body.slug === slug)?.name ?? slug;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Credits</h1>
        <p className="max-w-2xl leading-7 text-muted">
          ExoFinder is built on the work of space agencies, observatories and researchers. Here is where every
          picture, map, shape and value comes from, and under which licence it is used. All pictures were
          scaled down and compressed for the web; other changes are named below.
        </p>
      </header>

      <Section title="The sky and the Milky Way">
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 leading-7">
          <li>
            Sky panorama:{" "}
            <a className={LINK} href="https://www.eso.org/public/images/eso0932a/">
              ESO/S. Brunier, “The Milky Way panorama”
            </a>
            ,{" "}
            <a className={LINK} href={CC_BY}>
              CC BY 4.0
            </a>
            .
          </li>
          <li>
            Picture of the galaxy:{" "}
            <a className={LINK} href="https://www.eso.org/public/images/eso1339g/">
              NASA/JPL-Caltech/ESO/R. Hurt, “Artist’s impression of the Milky Way”
            </a>
            ,{" "}
            <a className={LINK} href={CC_BY}>
              CC BY 4.0
            </a>
            . The map builds the galaxy from clouds and stars placed after this picture.
          </li>
        </ul>
      </Section>

      <Section title="Maps of the Sun and the planets">
        <p className="max-w-2xl leading-7">
          <a className={LINK} href="https://www.solarsystemscope.com/textures/">
            Solar System Scope
          </a>
          , based on NASA imagery,{" "}
          <a className={LINK} href={CC_BY}>
            CC BY 4.0
          </a>
          , also for Saturn’s rings. The map of Venus shows the tops of its clouds.
        </p>
      </Section>

      <Section title="Maps of the moons, the dwarf planets and Vesta">
        <p className="max-w-2xl leading-7 text-muted">
          Mosaics of spacecraft images, which NASA and the USGS publish as public-domain works, credited as the
          mission teams ask. They were turned so that longitude 0 lies in the middle; grey mosaics were tinted
          with the body’s colours, exaggerated colours toned down, the brightness set after the body’s albedo,
          and parts no spacecraft saw filled with a smooth continuation of the nearby tones. The south of Pluto
          and of Charon, a third of each globe, also borrows craters and relief from the parts New Horizons saw
          closely, so that it does not look cut off; it is an illustration.
        </p>
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 leading-7">
          {Object.entries(MAP_SOURCES).map(([slug, source]) => (
            <li key={slug}>
              {name(slug)}:{" "}
              <a className={LINK} href={source.url}>
                {source.credit}
              </a>
              , {source.licence}.
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Shapes of the irregular bodies">
        <p className="max-w-2xl leading-7 text-muted">
          Shape models from the NASA Planetary Data System and the Small Body Mapping Tool of the Johns Hopkins
          University Applied Physics Laboratory, sampled into a grid of radii.
        </p>
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 leading-7">
          {Object.entries(SHAPE_SOURCES).map(([slug, source]) => (
            <li key={slug}>
              {name(slug)}:{" "}
              <a className={LINK} href={source.url}>
                {source.credit}
              </a>
              .
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Values">
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 leading-7">
          <li>
            Exoplanets and their stars:{" "}
            <a className={LINK} href="https://exoplanetarchive.ipac.caltech.edu/">
              NASA Exoplanet Archive
            </a>
            , compared every day.
          </li>
          <li>
            The planets of the solar system:{" "}
            <a className={LINK} href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/">
              NASA Planetary Fact Sheet
            </a>
            .
          </li>
          <li>
            Moons, Ceres and Vesta:{" "}
            <a className={LINK} href="https://ssd.jpl.nasa.gov/">
              JPL Solar System Dynamics
            </a>
            ; the density of Charon from New Horizons (Nimmo et al. 2017).
          </li>
          <li>
            Sizes and groups of small moons where JPL lists none:{" "}
            <a className={LINK} href="https://sites.google.com/carnegiescience.edu/sheppard/moons">
              Scott S. Sheppard, Carnegie Science
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section title="Pictures of exoplanets">
        <p className="max-w-2xl leading-7">
          No telescope has seen the surface of an exoplanet. Their pictures are computed from the measured
          values, on base maps that ExoFinder simulates itself; they contain no third-party material.
        </p>
      </Section>
    </main>
  );
}
