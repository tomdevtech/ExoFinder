import { SOLAR_BODIES } from "@/app/solar-system/bodies";
import { MAP_SOURCES } from "@/app/solar-system/maps";
import { SHAPE_SOURCES } from "@/app/solar-system/shapes";

/**
 * Every source of a picture, map, shape, value or method, as data: the credits page and the list of
 * sources in the printed catalogue both read it, so a new source shows up in both by itself.
 */
export interface Source {
  /** What the source is used for, or the body it belongs to. */
  subject: string;
  /** Who made it, as the publisher asks to be credited. */
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

const bodyName = (slug: string) => SOLAR_BODIES.find((body) => body.slug === slug)?.name ?? slug;

export const SOURCE_GROUPS: SourceGroup[] = [
  {
    title: "The sky and the Milky Way",
    intro: null,
    sources: [
      {
        subject: "Sky panorama",
        credit: "ESO/S. Brunier, “The Milky Way panorama”",
        url: "https://www.eso.org/public/images/eso0932a/",
        licence: CC_BY,
        note: null,
      },
      {
        subject: "Picture of the galaxy",
        credit: "NASA/JPL-Caltech/ESO/R. Hurt, “Artist’s impression of the Milky Way”",
        url: "https://www.eso.org/public/images/eso1339g/",
        licence: CC_BY,
        note: "The map builds the galaxy from clouds and stars placed after this picture.",
      },
    ],
  },
  {
    title: "Maps of the Sun and the planets",
    intro: null,
    sources: [
      {
        subject: "The Sun, the eight planets and Saturn’s rings",
        credit: "Solar System Scope, based on NASA imagery",
        url: "https://www.solarsystemscope.com/textures/",
        licence: CC_BY,
        note: "The map of Venus shows the tops of its clouds.",
      },
    ],
  },
  {
    title: "Maps of the moons, the dwarf planets and Vesta",
    intro:
      "Mosaics of spacecraft images, which NASA and the USGS publish as public-domain works, credited as the mission teams ask. They were turned so that longitude 0 lies in the middle; grey mosaics were tinted with the body’s colours, exaggerated colours toned down, the brightness set after the body’s albedo, and parts no spacecraft saw filled with a smooth continuation of the nearby tones. The south of Pluto and of Charon, a third of each globe, also borrows craters and relief from the parts New Horizons saw closely, so that it does not look cut off; it is an illustration.",
    sources: Object.entries(MAP_SOURCES).map(([slug, source]) => ({
      subject: bodyName(slug),
      credit: source.credit,
      url: source.url,
      licence: { name: source.licence, url: null },
      note: null,
    })),
  },
  {
    title: "Shapes of the irregular bodies",
    intro:
      "Shape models from the NASA Planetary Data System and the Small Body Mapping Tool of the Johns Hopkins University Applied Physics Laboratory, sampled into a grid of radii.",
    sources: Object.entries(SHAPE_SOURCES).map(([slug, source]) => ({
      subject: bodyName(slug),
      credit: source.credit,
      url: source.url,
      licence: null,
      note: null,
    })),
  },
  {
    title: "Values",
    intro: null,
    sources: [
      {
        subject: "Exoplanets and their stars",
        credit: "NASA Exoplanet Archive",
        url: "https://exoplanetarchive.ipac.caltech.edu/",
        licence: null,
        note: "Compared every day.",
      },
      {
        subject: "The planets of the solar system",
        credit: "NASA Planetary Fact Sheet",
        url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
        licence: null,
        note: null,
      },
      {
        subject: "Moons, Ceres and Vesta",
        credit: "JPL Solar System Dynamics",
        url: "https://ssd.jpl.nasa.gov/",
        licence: null,
        note: null,
      },
      {
        subject: "The density of Charon",
        credit: "F. Nimmo et al. 2017, Mean radius and shape of Pluto and Charon from New Horizons images, Icarus 287, 12",
        url: "https://doi.org/10.1016/j.icarus.2016.06.027",
        licence: null,
        note: null,
      },
      {
        subject: "Sizes and groups of small moons where JPL lists none",
        credit: "Scott S. Sheppard, Carnegie Science",
        url: "https://sites.google.com/carnegiescience.edu/sheppard/moons",
        licence: null,
        note: null,
      },
    ],
  },
  {
    title: "Methods",
    intro: "What ExoFinder works out itself follows published work.",
    sources: [
      {
        subject: "The class of a planet without a measured radius",
        credit: "J. Chen and D. Kipping 2017, Probabilistic Forecasting of the Masses and Radii of Other Worlds, ApJ 834, 17",
        url: "https://doi.org/10.3847/1538-4357/834/1/17",
        licence: null,
        note: null,
      },
      {
        subject: "The cloud colours of gas giants by temperature",
        credit: "D. Sudarsky, A. Burrows and P. Pinto 2000, Albedo and Reflection Spectra of Extrasolar Giant Planets, ApJ 538, 885",
        url: "https://doi.org/10.1086/309160",
        licence: null,
        note: null,
      },
      {
        subject: "The habitable zone of a star",
        credit: "R. K. Kopparapu et al. 2013, Habitable Zones around Main-sequence Stars: New Estimates, ApJ 765, 131",
        url: "https://doi.org/10.1088/0004-637X/765/2/131",
        licence: null,
        note: null,
      },
    ],
  },
  {
    title: "Pictures of exoplanets",
    intro:
      "No telescope has seen the surface of an exoplanet. Their pictures are computed from the measured values, on base maps that ExoFinder simulates itself; they contain no third-party material.",
    sources: [],
  },
];
