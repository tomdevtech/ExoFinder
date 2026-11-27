import { bodyName, SOLAR_BODIES } from "@/app/solar-system/bodies";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SHAPE_SOURCES } from "@/app/solar-system/shapes";
import type { Messages } from "@/i18n/messages";

/**
 * Every source of a picture, map, shape, value or method, as data: the credits page and the list of
 * sources in the printed catalogue both read it, so a new source shows up in both by itself.
 */
export interface Source {
  /** What the source is used for, or the body it belongs to. */
  subject: string;
  /** Who made it, as the publisher asks to be credited. That is never translated. */
  credit: string;
  url: string;
  /** The licence with its address, a licence without one such as "public domain", or null where none is stated. */
  licence: { name: string; url: string | null } | null;
  /** What was changed, or what the source is used for in particular. */
  note: string | null;
}

export interface SourceGroup {
  title: string;
  intro: string | null;
  sources: Source[];
}

const CC_BY = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };

/** The sources in a language: its words for what each is used for, around the credits as their makers give them. */
export function sourceGroups(m: Messages): SourceGroup[] {
  const text = m.credits;
  const body = (slug: string) => {
    const found = SOLAR_BODIES.find((candidate) => candidate.slug === slug);
    return found ? bodyName(found, m) : slug;
  };
  return [
    {
      title: text.sky,
      intro: null,
      sources: [
        {
          subject: text.skyPanorama,
          credit: "ESO/S. Brunier, “The Milky Way panorama”",
          url: "https://www.eso.org/public/images/eso0932a/",
          licence: CC_BY,
          note: null,
        },
        {
          subject: text.galaxyPicture,
          credit: "NASA/JPL-Caltech/ESO/R. Hurt, “Artist’s impression of the Milky Way”",
          url: "https://www.eso.org/public/images/eso1339g/",
          licence: CC_BY,
          note: text.galaxyNote,
        },
      ],
    },
    {
      title: text.planetMaps,
      intro: null,
      sources: [
        {
          subject: text.planetMapsSubject,
          credit: "Solar System Scope, based on NASA imagery",
          url: "https://www.solarsystemscope.com/textures/",
          licence: CC_BY,
          note: text.planetMapsNote,
        },
      ],
    },
    {
      title: text.moonMaps,
      intro: text.moonMapsIntro,
      sources: Object.entries(MAP_SOURCES).map(([slug, source]) => ({
        subject: body(slug),
        credit: source.credit,
        url: source.url,
        licence: { name: source.licence === "public domain" ? text.publicDomain : source.licence, url: null },
        note: null,
      })),
    },
    {
      title: text.shapes,
      intro: text.shapesIntro,
      sources: Object.entries(SHAPE_SOURCES).map(([slug, source]) => ({
        subject: body(slug),
        credit: source.credit,
        url: source.url,
        licence: null,
        note: null,
      })),
    },
    {
      title: text.values,
      intro: null,
      sources: [
        {
          subject: text.exoplanetValues,
          credit: "NASA Exoplanet Archive",
          url: "https://exoplanetarchive.ipac.caltech.edu/",
          licence: null,
          note: text.exoplanetValuesNote,
        },
        {
          subject: text.planetValues,
          credit: "NASA Planetary Fact Sheet",
          url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
          licence: null,
          note: null,
        },
        {
          subject: text.moonValues,
          credit: "JPL Solar System Dynamics",
          url: "https://ssd.jpl.nasa.gov/",
          licence: null,
          note: null,
        },
        {
          subject: text.charonDensity,
          credit: "F. Nimmo et al. 2017, Mean radius and shape of Pluto and Charon from New Horizons images, Icarus 287, 12",
          url: "https://doi.org/10.1016/j.icarus.2016.06.027",
          licence: null,
          note: null,
        },
        {
          subject: text.smallMoonSizes,
          credit: "Scott S. Sheppard, Carnegie Science",
          url: "https://sites.google.com/carnegiescience.edu/sheppard/moons",
          licence: null,
          note: null,
        },
      ],
    },
    {
      title: text.methods,
      intro: text.methodsIntro,
      sources: [
        {
          subject: text.classMethod,
          credit: "J. Chen and D. Kipping 2017, Probabilistic Forecasting of the Masses and Radii of Other Worlds, ApJ 834, 17",
          url: "https://doi.org/10.3847/1538-4357/834/1/17",
          licence: null,
          note: null,
        },
        {
          subject: text.cloudMethod,
          credit: "D. Sudarsky, A. Burrows and P. Pinto 2000, Albedo and Reflection Spectra of Extrasolar Giant Planets, ApJ 538, 885",
          url: "https://doi.org/10.1086/309160",
          licence: null,
          note: null,
        },
        {
          subject: text.zoneMethod,
          credit: "R. K. Kopparapu et al. 2013, Habitable Zones around Main-sequence Stars: New Estimates, ApJ 765, 131",
          url: "https://doi.org/10.1088/0004-637X/765/2/131",
          licence: null,
          note: null,
        },
      ],
    },
    { title: text.exoplanetPictures, intro: text.exoplanetPicturesIntro, sources: [] },
  ];
}
