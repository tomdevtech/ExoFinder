import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import { formatters } from "@/shared/format";
import { INTL_LOCALES, type Locale } from "../locales";

/** A kind of planet as the lists narrow to it: a class, a climate, both or neither. */
interface Kind {
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
}

/**
 * The texts that run in the browser. They are plain text with `{places}` for what is filled in, because
 * they travel from the server to the components that show them, and a function cannot make that trip.
 */
const client = {
  units: { days: "{n} days", years: "{n} years" },
  search: { placeholder: "Search planets and stars", suggestions: "Suggestions" },
  filter: { placeholder: "Filter planets by name" },
  language: "Language",
  viewer: {
    label: "3D model of {name}. Arrow keys turn it, plus and minus zoom, zero resets.",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    reset: "Reset",
    spin: "Spin",
    pause: "Pause",
    close: "Close",
    fullScreen: "Full screen",
    shapeFailed: "This browser cannot draw the 3D model of {name}.",
    shapeLoading: "Loading the shape of {name}…",
  },
  error: {
    title: "This page could not be loaded",
    text: "Something went wrong while reading the catalogue. This is usually temporary, for example when the database is restarting.",
    retry: "Try again",
  },
  map: {
    loading: "Loading the map…",
    needsWebgl: "The map needs WebGL 2",
    /** The text around the link to the solar system. */
    needsWebglText: [
      "This browser cannot draw 3D graphics, or they are switched off. Every star and planet also has its own page: use the search above, or start with ",
      "the solar system",
      ".",
    ],
    viewSystem: "3D view of {name} and its planets. Drag to turn, scroll to zoom.",
    viewGalaxy: "3D map of the Milky Way. Drag to look around, fly with W, A, S and D.",
    showPanel: "» Show panel",
    loadingStars: "Loading the stars…",
    starsFailed: "The stars could not be loaded. Is the database running?",
    sun: "Sun",
    wholeGalaxy: "Whole galaxy",
    flyFreely: "Fly freely",
    orbitCentre: "Orbit centre",
    flyFreelyTitle: "Fly freely again",
    orbitCentreTitle: "Turn round the centre of the Milky Way",
    credits: "Credits",
    legalNotice: "Legal notice",
    privacy: "Privacy",
    find: "Find a star on the map",
    noStar: "No star with this name.",
    galacticCentre: "Galactic centre",
    planetsOne: "1 known planet",
    planetsOther: "{n} known planets",
    sunPlanets: "{n} planets",
    distance: "{n} light-years from the Sun",
    ownStar: "Our own star",
    unknownDistance: "At an unknown distance",
    clear: "Clear the selection",
    entering: "Loading…",
    enter: "Enter system",
    fly: "Fly there",
    starPage: "Star page",
    systemFailed: "This system could not be loaded.",
    specialWhere: "At the very heart of the Milky Way",
    specialWhat: "The brightest star in the whole galaxy",
    specialOpen: "Open the info page",
    specialName: "My Special Star",
    galaxy: "Galaxy",
    play: "Play",
    pause: "Pause",
    trueScale: "True scale",
    compressed: "Compressed",
    toCompressed: "Switch to the compressed scale: distances squeezed, planets enlarged",
    toTrueScale: "Switch to the true scale: distances and sizes as they are",
    zone: "Habitable zone",
    zoneUnknown: "The temperature or the radius of this star is not known, so its habitable zone cannot be worked out",
    zoneTitle: "Show where a planet could keep liquid water on its surface",
    zoneRange: "Habitable zone: {inner} to {outer} AU",
    zoneEmpty: "No known planet circles in it.",
    inZone: "In the habitable zone",
    atZoneEdge: "At the edge of the habitable zone",
    hidePanel: "Hide panel",
    hidePanelTitle: "Hide the panel to see the whole picture",
    wholeSystem: "Whole system",
    page: "Page",
    hideMoons: "Hide moons",
    showMoons: "Show moons",
    moonsOf: "Moons of {name}",
    smallerOne: "1 smaller moon",
    smallerOther: "{n} smaller moons",
    illustration: "No close-up images exist: its shape and surface are an illustration.",
    noPlanets: "No confirmed planet is listed for this star.",
    /** Other names for the sights of the map, by their English name. English needs none. */
    landmarks: {} as Record<string, string>,
  },
};

const CLASS_LABELS: Record<PlanetClass, string> = {
  rocky: "Rocky planet",
  super_earth: "Super-Earth",
  neptune_like: "Neptune-like planet",
  gas_giant: "Gas giant",
};

const CLIMATE_LABELS: Record<ClimateClass, string> = {
  frozen: "frozen",
  cold: "cold",
  temperate: "temperate",
  hot: "hot",
  scorching: "scorching",
};

/** The classes as they read in the middle of a sentence, for one planet and for several. */
const CLASS_NOUNS: Record<PlanetClass, [one: string, several: string]> = {
  rocky: ["rocky planet", "rocky planets"],
  super_earth: ["super-Earth", "super-Earths"],
  neptune_like: ["Neptune-like planet", "Neptune-like planets"],
  gas_giant: ["gas giant", "gas giants"],
};

/** A kind of planet within a sentence, such as "hot gas giants", or "planets" when nothing narrows it. */
function kindNoun({ planetClass, climateClass }: Kind, count: number): string {
  const [one, several] = planetClass ? CLASS_NOUNS[planetClass] : ["planet", "planets"];
  const noun = count === 1 ? one : several;
  return climateClass ? `${CLIMATE_LABELS[climateClass]} ${noun}` : noun;
}

const fmt = formatters(INTL_LOCALES.en, client.units);

export const en = {
  locale: "en" as Locale,
  fmt,
  client,
  /** The names of bodies that differ from their English ones, by slug. */
  names: {} as Record<string, string>,

  site: {
    description:
      "Every known exoplanet: searchable, with a page for each planet and its star, and our own solar system for comparison.",
    nav: { planets: "Planets", map: "Map", solarSystem: "Solar system" },
    /** The footer text around its two links: the NASA Exoplanet Archive and the credits. */
    footer: [
      "Exoplanet data from the ",
      ". Images of exoplanets are illustrations computed from the data, not photographs. Where every picture, map and value comes from is listed under ",
      ".",
    ],
    legal: "Legal",
    credits: "Credits",
    legalNotice: "Legal notice",
    privacy: "Privacy",
  },

  notFound: {
    title: "Nothing here",
    text: "There is no page at this address. The planet or star may be spelled differently in the catalogue: try the search field above.",
    back: "Back to the start page",
  },

  home: {
    intro:
      "Every known exoplanet in one place. Search by name, or start with one of the planets below. Each planet and each star has its own page.",
    featured: "Places to start",
    loadingPlanets: "Loading planets",
    loadingFigures: "Loading the catalogue figures",
    figures: "The catalogue in numbers",
    exoplanets: "Exoplanets",
    hostStars: "Stars with planets",
    atKnownDistance: "of them at a known distance",
    unclassified: (count: string) => `${count} planets cannot be classified because neither radius nor mass is known. `,
    solarPlanets: (count: number) => `On top come the ${count} planets of our solar system. `,
    lastSync: (when: string) => `Last compared with NASA on ${when}.`,
    emptyDatabase: "The database is still empty. Run “npm run sync” to fill it.",
    databaseDown: "The database cannot be reached right now.",
    bookTitle: "The catalogue as a book",
    bookText:
      "Every planet, moon and dwarf planet on a page of its own, with its picture and its values, a table of contents, an index and all sources, in one PDF file.",
    bookButton: "Download full catalogue",
  },

  classes: {
    planet: "Planet",
    label: CLASS_LABELS,
    plural: {
      rocky: "Rocky planets",
      super_earth: "Super-Earths",
      neptune_like: "Neptune-like planets",
      gas_giant: "Gas giants",
    } as Record<PlanetClass, string>,
    climate: CLIMATE_LABELS,
    /** A short description such as "Super-Earth, temperate". Unknown parts are left out. */
    describe: (planetClass: PlanetClass | null, climateClass: ClimateClass | null) => {
      const label = planetClass ? CLASS_LABELS[planetClass] : "Planet";
      return climateClass ? `${label}, ${CLIMATE_LABELS[climateClass]}` : label;
    },
  },

  list: {
    title: "All planets",
    description:
      "Every known exoplanet and the planets of the solar system in one list, sorted by name or by year of discovery, and narrowed to one kind such as temperate rocky planets or hot gas giants.",
    planet: "Planet",
    star: "Star",
    discovered: "Discovered",
    antiquity: "Known since antiquity",
    sortOrder: "Sort order",
    sortBy: "Sort by",
    byName: "Name",
    byDiscovery: "Discovery year",
    pagesTop: "Pages, top",
    pagesBottom: "Pages, bottom",
    pages: "Pages",
    previousPage: "Previous page",
    nextPage: "Next page",
    page: (page: number) => `Page ${page}`,
    loading: "Loading the list",
    filterNav: "Filter by kind of planet",
    type: "Type",
    climate: "Climate",
    removeFilter: "Remove this filter",
    /** What a list without a kind says when no name matches. */
    noMatch: (query: string) =>
      `No planet matches “${query}”. Try a shorter part of the name, for example “Kepler-22” or “TRAPPIST”.`,
    /** How many planets a list holds and what they match, such as "2,220 gas giants" or "7 planets match “trapp”". */
    count: (kind: Kind, total: number, query: string) => {
      const count = `${fmt.count(total)} ${kindNoun(kind, total)}`;
      return query === "" ? count : `${count} ${total === 1 ? "matches" : "match"} “${query}”`;
    },
    /** Which planets of a list its page shows, such as " · showing 201–400". */
    range: (first: number, last: number) => ` · showing ${fmt.count(first)}–${fmt.count(last)}`,
    /** What a list narrowed to a kind of planet says when it holds nothing. */
    empty: (kind: Kind, query: string) =>
      query === ""
        ? `The catalogue lists no ${kindNoun(kind, 0)}. Remove one of the two filters to see more.`
        : `No ${kindNoun(kind, 1)} matches “${query}”. Try a shorter part of the name, or remove a filter.`,
  },

  search: {
    title: "Search",
    description:
      "Search all known exoplanets, their host stars and the moons and dwarf planets of the solar system by name, or list the planets of one kind, such as temperate rocky planets or hot gas giants.",
    hint: "Type the name of a planet, a moon or a star into the search field. Or choose a kind of planet above to list all planets of that kind.",
    noMatch: (query: string) => `No planet or star matches “${query}”.`,
    tooShort: (min: number) => ` Type at least ${min} characters.`,
    tryShorter: " Try a shorter part of the name, for example “Kepler-22” or “TRAPPIST”.",
    similar: (query: string) => `No name contains “${query}”. These names are similar:`,
    firstMatches: (count: number, query: string) =>
      `The first ${count} matches for “${query}”. Type more of the name to narrow it down.`,
    matches: (count: number, query: string) => `${count === 1 ? "1 match" : `${count} matches`} for “${query}”.`,
    kindTooShort: (min: number, kind: Kind) =>
      `Type at least ${min} characters, or clear the search field to list all ${kindNoun(kind, 0)}.`,
    kindSimilar: (kind: Kind, query: string) => `No ${kindNoun(kind, 1)} has “${query}” in its name. These names are similar:`,
    searching: "Searching",
  },

  card: {
    noLongerListed: "no longer listed",
    /** A star by its planet count, for example "Star · 3 known planets". */
    star: (planets: number) => (planets === 1 ? "Star · 1 known planet" : `Star · ${planets} known planets`),
    across: (kilometres: string) => `${kilometres} km across`,
  },

  facts: {
    unknown: "unknown",
    radius: "Radius",
    mass: "Mass",
    density: "Density",
    equilibriumTemperature: "Equilibrium temperature",
    starlight: "Starlight received",
    calculated: "calculated",
    minimumMass: "minimum mass",
    orbitalPeriod: "Orbital period",
    distanceFromStar: "Distance from the star",
    eccentricity: "Eccentricity",
    inclination: "Inclination",
    method: "Method",
    year: "Year",
    facility: "Facility",
    spectralType: "Spectral type",
    temperature: "Temperature",
    brightness: "Brightness seen from Earth",
    distance: "Distance",
    surfaceGravity: "Surface gravity",
    orbits: "Orbits",
    distanceFromSun: "Distance from the Sun",
    distanceFromPlanet: "Distance from the planet",
    distanceFrom: (body: string) => `Distance from ${body}`,
    discoveredBy: "Discovered by",
    knownSince: "Known since",
    antiquity: "antiquity",
    knownMoons: "Known moons",
    none: "none",
    group: "Group",
    estimated: "estimated",
    direction: "Direction",
    backwards: "backwards",
    withSpin: (body: string) => `with the spin of ${body}`,
    timesEarth: (value: string) => `${value} × Earth`,
    timesSun: (value: string) => `${value} × Sun`,
    /** The unit of distances within a system, the astronomical unit. */
    au: "AU",
    /** The unit of the brightness of a star. */
    mag: "mag",
    /** The discovery methods as NASA names them. One that is missing here is shown as NASA writes it. */
    methods: {} as Record<string, string>,
    /** The groups of small moons as the sources name them, in other languages. */
    groups: {} as Record<string, string>,
  },

  /** The names of the tracked values as they appear in the change history. */
  fields: {
    name: "Name",
    status: "Status",
    star: "Host star",
    discoveryMethod: "Discovery method",
    discoveryYear: "Discovery year",
    discoveryFacility: "Discovery facility",
    orbitalPeriodDays: "Orbital period (days)",
    semiMajorAxisAu: "Semi-major axis (AU)",
    eccentricity: "Eccentricity",
    radiusEarth: "Radius (Earth radii)",
    radiusCalculated: "Radius is calculated",
    massEarth: "Mass (Earth masses)",
    massCalculated: "Mass is calculated",
    massIsMinimum: "Mass is a minimum mass",
    density: "Density (g/cm³)",
    densityCalculated: "Density is calculated",
    eqTempK: "Equilibrium temperature (K)",
    eqTempCalculated: "Equilibrium temperature is calculated",
    insolation: "Insolation (Earth = 1)",
    insolationCalculated: "Insolation is calculated",
  } as Record<string, string>,

  planet: {
    notFound: "Planet not found",
    description: (kind: string, star: string) => `${kind} orbiting ${star}: measured values, discovery and change history.`,
    removed: (since: string | null) =>
      `NASA no longer lists this planet among the confirmed exoplanets${since ? ` (noticed on ${since})` : ""}. The values below are the last ones known.`,
    illustration: (name: string) => `Illustration of ${name}`,
    /** The line below the name, around the link to the star: "Rocky planet, cold orbiting [Proxima Cen]". */
    headline: (kind: string, isSun: boolean): [before: string, after: string] => [
      `${kind} orbiting ${isSun ? "the " : ""}`,
      "",
    ],
    distance: (lightYears: string) => `, ${lightYears} light-years from the Sun`,
    formerly: (names: string) => `Formerly listed as ${names}.`,
    onOrbit: "See it on its orbit in 3D",
    modelReal: "The model shows a real map of the planet, put together from spacecraft images.",
    modelComputed:
      "Nobody has seen this planet up close. The model is computed from the values below: it shows what a planet of this size and temperature could look like.",
    modelHowTo: "Drag it to look at every side, zoom with the buttons, with two fingers or with Ctrl and the mouse wheel.",
    mapCredit: "Map: ",
    section: "Planet",
    calculatedNote:
      "“Calculated” marks values that were derived from other measurements instead of being measured. “Minimum mass” means that only a lower limit is known, the true mass may be higher. The equilibrium temperature ignores any atmosphere, so the surface can be much warmer.",
    orbit: "Orbit",
    orbitNote: "1 AU is the distance between Earth and the Sun. An eccentricity of 0 is a perfect circle.",
    discovery: "Discovery",
    moon: "Moon",
    moons: "Moons",
    hostStar: (star: string) => `Host star: ${star}`,
    moreAbout: (star: string) => `More about ${star}`,
    others: (count: number) =>
      count === 1 ? "One other known planet in this system" : `${count} other known planets in this system`,
    history: "Change history",
    historyIntro: "Every time the catalogue is compared with NASA, changed values are recorded here.",
    date: "Date",
    value: "Value",
    before: "Before",
    after: "After",
    valuesFrom: "Values from the ",
    factSheet: "NASA Planetary Fact Sheet",
    archiveSource: (when: string) => `Values from the NASA Exoplanet Archive, last changed here on ${when}. `,
    allData: (name: string) => `All data for ${name} in the archive`,
    /** "Earth is 2 times as wide as Earth" never appears: the comparison is left out for Earth itself. */
    size: (name: string, times: string) => `${name} is ${times} times as wide as Earth.`,
    earth: "Earth",
  },

  star: {
    notFound: "Star not found",
    description: (name: string, planets: number) =>
      `${name} and its ${planets === 1 ? "known planet" : `${planets} known planets`}.`,
    headline: (isSun: boolean, lightYears: string | null, planets: number) =>
      `${isSun ? "Our own star" : lightYears !== null ? `Star ${lightYears} light-years from the Sun` : "Star at an unknown distance"} with ${
        planets === 1 ? "one known planet" : `${planets} known planets`
      }`,
    formerly: (names: string) => `Formerly listed as ${names}.`,
    viewSystem: "View the system in 3D",
    openMap: "Open the map of the Milky Way",
    findOnMap: "Find it on the map",
    noPosition: "Without a distance this star cannot be placed on the map.",
    planets: (count: number): string => (count === 1 ? "Planet" : "Planets"),
    noneListed: "NASA currently lists no confirmed planet for this star.",
    noLongerListed: "No longer listed by NASA",
    dwarfs: "Dwarf planets and Vesta",
    section: "Star",
    distanceValue: (lightYears: string, parsecs: string) => `${lightYears} ly (${parsecs} pc)`,
    magnitudeNote:
      "Brightness is given in magnitudes: the smaller the number, the brighter the star. The faintest stars visible to the naked eye are around 6 mag.",
    position: "Position",
    rightAscension: "Right ascension",
    declination: "Declination",
    catalogueNames: "Catalogue names",
  },

  body: {
    notFound: "Not found",
    moon: "Moon",
    dwarfPlanet: "Dwarf planet",
    asteroid: "Asteroid",
    moons: "Moons",
    moonOf: (parent: string) => `Moon of ${parent}`,
    /** The line below the name, around the link to what the body orbits: "Moon of [Jupiter]". */
    headline: (kind: "moon" | "dwarf_planet" | "asteroid", parent: string): [before: string, after: string] => {
      void parent;
      if (kind === "moon") return ["Moon of ", ""];
      return [kind === "dwarf_planet" ? "Dwarf planet orbiting the " : "Asteroid orbiting the ", ""];
    },
    onOrbit: "See it on its orbit in 3D",
    modelShapeAndMap: "The model shows its real shape, measured by spacecraft, with a map put together from their images",
    modelShape:
      "The model shows its real shape, measured by spacecraft. No spacecraft has mapped its whole surface, so it is drawn in its colour alone",
    modelMap: "The model shows a real map put together from spacecraft images",
    modelHowTo: ". Drag it to look at every side, zoom with the buttons, with two fingers or with Ctrl and the mouse wheel.",
    shapeCredit: "Shape: ",
    mapCredit: "Map: ",
    radiusNote: (longest: { name: string; kilometres: string } | null) =>
      `The radius is the mean radius, the radius of a sphere with the same volume${
        longest ? `; ${longest.name} is far from round, its longest axis ${longest.kilometres} km across` : ""
      }. The mass is derived from the gravitational pull measured by spacecraft or from the orbits of neighbours.`,
    orbitNoteSun: "1 AU is the distance between Earth and the Sun. The inclination is measured against the plane of Earth's orbit.",
    orbitNoteEcliptic:
      "The distance is the mean distance between the centres. The inclination is measured against the plane of Earth's orbit, which the Moon's orbit circles about.",
    orbitNoteEquator:
      "The distance is the mean distance between the centres. The inclination is measured against the plane the orbit circles about, close to the planet's equator; above 90° the moon orbits backwards.",
    antiquity: "Known since antiquity: it is plain to see in the night sky.",
    otherLargeMoons: (parent: string) => `Other large moons of ${parent}`,
    valuesFrom: "Values from ",
    jpl: "JPL Solar System Dynamics",
    andThe: " and the ",
    plutoFactSheet: "NASA Pluto Fact Sheet",
    /** The mass of a small moon, in units of 10¹⁵ kilograms. */
    massKilograms: (value: string) => `${value} × 10¹⁵ kg`,
    /** The texts about the bodies in other languages, by slug. English reads them from bodies.ts. */
    summaries: {} as Record<string, string>,
    /** What a map does not show as it is, by slug, in other languages. English reads it from maps.ts. */
    mapNotes: {} as Record<string, string>,
  },

  smallMoon: {
    description: (parent: string) =>
      `Moon of ${parent}: its orbit, its size and its discovery, with a model of what it could look like.`,
    model: (name: string) =>
      `ExoFinder has no shape model and no map of ${name}, so the model is an illustration: its shape and its surface are made up, and only the values below are real. Drag it to look at every side, zoom with the buttons, with two fingers or with Ctrl and the mouse wheel.`,
    radiusMeasured: "The radius is the mean radius. ",
    radiusEstimated:
      "Most small moons have only been seen as points of light, so the radius is estimated from how bright the moon looks. ",
    noMass: "No spacecraft has measured the pull of most small moons, so no mass is given.",
    groupNote:
      " The moons of a group circle on similar orbits; the far groups are thought to be the pieces of bodies that broke apart.",
    orbitNote: (ecliptic: boolean, parent: string) =>
      `The distance is the mean distance between the centres. The inclination is measured against ${
        ecliptic
          ? "the plane of Earth's orbit, as for most of the far moons that a planet captured"
          : `the plane the orbit circles about, close to the equator of ${parent}`
      }; above 90° the moon orbits backwards.`,
    /** The source line around its two links, and the text of the link back to the planet. */
    source: ["Orbit and discovery from ", ", estimated sizes and groups also from ", "."],
    allMoons: (parent: string) => `All moons of ${parent}`,
  },

  moonTable: {
    summary: (count: string, parent: string, backwards: string | null) =>
      `All ${count} known moons of ${parent}${backwards ? `, ${backwards} of them orbiting backwards` : ""}`,
    moon: "Moon",
    diameter: "Diameter",
    distance: "Distance",
    orbit: "Orbit",
    found: "Found",
    unknown: "unknown",
    backwards: "backwards",
    antiquity: "antiquity",
    /** The note below the table around its two links: JPL and Scott Sheppard. */
    note: (parent: string) => [
      `“≈” marks sizes estimated from how bright a moon looks, as most small moons have only been seen as points of light. The distance is the mean distance from the centre of ${parent}. Orbits and discoveries from `,
      ", estimated sizes also from ",
      ".",
    ],
  },

  browse: {
    label: "Browse the catalogue",
    number: (position: string, total: string | null) => `No. ${position}${total ? ` of ${total}` : ""}`,
    skip: "Skip the moons:",
    backTo: (name: string) => `back to ${name}`,
    onTo: (name: string) => `on to ${name}`,
    previous: "Previous",
    next: "Next",
    solarSystem: "Solar system",
    /** The system a link leads to, with its distance where that is known. */
    system: (star: string, lightYears: string | null) => (lightYears ? `${star} · ${lightYears} light-years` : star),
  },

  credits: {
    title: "Credits",
    description: "Where the pictures, maps, shapes and values in ExoFinder come from, and under which licences.",
    intro:
      "ExoFinder is built on the work of space agencies, observatories and researchers. Here is where every picture, map, shape and value comes from, and under which licence it is used. All pictures were scaled down and compressed for the web; other changes are named below.",
    publicDomain: "public domain",
    sky: "The sky and the Milky Way",
    skyPanorama: "Sky panorama",
    galaxyPicture: "Picture of the galaxy",
    galaxyNote: "The map builds the galaxy from clouds and stars placed after this picture.",
    planetMaps: "Maps of the Sun and the planets",
    planetMapsSubject: "The Sun, the eight planets and Saturn’s rings",
    planetMapsNote: "The map of Venus shows the tops of its clouds.",
    moonMaps: "Maps of the moons, the dwarf planets and Vesta",
    moonMapsIntro:
      "Mosaics of spacecraft images, which NASA and the USGS publish as public-domain works, credited as the mission teams ask. They were turned so that longitude 0 lies in the middle; grey mosaics were tinted with the body’s colours, exaggerated colours toned down, the brightness set after the body’s albedo, and parts no spacecraft saw filled with a smooth continuation of the nearby tones. The south of Pluto and of Charon, a third of each globe, also borrows craters and relief from the parts New Horizons saw closely, so that it does not look cut off; it is an illustration.",
    shapes: "Shapes of the irregular bodies",
    shapesIntro:
      "Shape models from the NASA Planetary Data System and the Small Body Mapping Tool of the Johns Hopkins University Applied Physics Laboratory, sampled into a grid of radii.",
    values: "Values",
    exoplanetValues: "Exoplanets and their stars",
    exoplanetValuesNote: "Compared every day.",
    planetValues: "The planets of the solar system",
    moonValues: "Moons, Ceres and Vesta",
    charonDensity: "The density of Charon",
    smallMoonSizes: "Sizes and groups of small moons where JPL lists none",
    methods: "Methods",
    methodsIntro: "What ExoFinder works out itself follows published work.",
    classMethod: "The class of a planet without a measured radius",
    cloudMethod: "The cloud colours of gas giants by temperature",
    zoneMethod: "The habitable zone of a star",
    exoplanetPictures: "Pictures of exoplanets",
    exoplanetPicturesIntro:
      "No telescope has seen the surface of an exoplanet. Their pictures are computed from the measured values, on base maps that ExoFinder simulates itself; they contain no third-party material.",
  },

  legal: {
    incomplete: (missing: string) =>
      `This page is not complete. Whoever runs this copy of ExoFinder has not entered their details yet. Missing: ${missing}. They are set as environment variables, see .env.example.`,
    email: "E-mail: ",
    phone: "Phone: ",
    notice: {
      title: "Legal notice",
      /** The German name of the page, for visitors who look for that word. */
      subtitle: "Impressum",
      description: "Who runs this website and how to reach them.",
      who: "Who runs this website",
      basis: "Information according to § 5 DDG and § 18 (1) MStV",
      contact: "Contact",
      about: "About this website",
      aboutText:
        "ExoFinder is a private project without advertising and without commercial purpose. Its source code is public under the MIT licence.",
      data: "Data and images",
      /** Around the links to the NASA Exoplanet Archive and the NASA Planetary Fact Sheets. */
      dataText: [
        "The data about exoplanets comes from the ",
        ", the data about the planets of the solar system from the ",
        ". The values are copied automatically and are not checked by hand, so they can contain errors or be out of date. They are not meant for scientific work: use the archive itself for that.",
      ],
      factSheets: "NASA Planetary Fact Sheets",
      illustrations: "Images of exoplanets are illustrations computed from the data, not photographs.",
      /** Around the links to Solar System Scope, ESO/S. Brunier, NASA/JPL-Caltech/ESO/R. Hurt and the licence. */
      mapsText: [
        "The maps of the planets of the solar system are by ",
        ", based on NASA imagery. The panorama of the sky is “The Milky Way panorama” by ",
        ". The galaxy on the map is drawn from the “Artist’s impression of the Milky Way” by ",
        ". All are licensed under ",
        ". They were scaled down and compressed for this website; the map of Venus shows the cloud tops, not the surface, and the picture of the galaxy was given a thickness so that it can be seen from every side.",
      ],
      links: "Links to other websites",
      linksText:
        "This website links to websites of others. Their operators alone are responsible for what is shown there. The linked pages were free of visibly unlawful content when the links were set. Should one of them have changed, a note by e-mail is enough and the link is removed.",
    },
    privacy: {
      title: "Privacy policy",
      subtitle: "Datenschutzerklärung",
      description: "What this website learns about its visitors, and what it does not.",
      short: "In short",
      shortList: [
        "No cookies, and nothing is stored in your browser.",
        "No statistics, no tracking, no advertising.",
        "No accounts, no forms, no newsletter.",
        "Nothing is loaded from other companies: fonts, images and maps come from this server.",
      ],
      shortText:
        "The only personal data this website handles is what every web server needs in order to answer a request, above all your IP address.",
      responsible: "Who is responsible",
      responsibleText: "Responsible for the processing of data on this website (the controller under the GDPR):",
      open: "When you open a page",
      openText:
        "Your browser sends a request to the server, and the server needs your IP address to send the answer back. The server writes a log entry for the request with:",
      logList: [
        "the IP address,",
        "date and time,",
        "the address of the page or file that was asked for,",
        "the page the request came from, if your browser tells,",
        "the name and version of your browser and operating system, as your browser tells them.",
      ],
      logPurpose:
        "The log is needed to keep the website running and to notice attacks and errors. That is a legitimate interest, and the legal basis is Art. 6 (1) (f) GDPR. The entries are not combined with other data and are not used to find out who you are. ",
      logKept: "They are kept only as long as this purpose needs them and are deleted after that.",
      logDeleted: (days: number) => `They are deleted after ${days} ${days === 1 ? "day" : "days"}.`,
      encrypted: "The connection is encrypted (HTTPS), so nobody on the way can read what is sent.",
      hostContract: (host: string) =>
        `The website runs on servers of ${host}. The company processes the data named above on behalf of the operator and only as instructed, under a contract according to Art. 28 GDPR.`,
      hostOwn: (host: string) =>
        `The website runs on servers of ${host}. The company receives the data named above because it delivers the pages, and handles it under its own privacy policy. Passing the data on rests on the same legitimate interest: without a host, the website cannot be reached.`,
      hostTransfer: (basis: string) => `The data may also be processed outside the European Union. ${basis}`,
      notRequired:
        "You do not have to provide this data by law or by contract. Without the IP address, however, the server cannot send you the page.",
      search: "When you search",
      /** Around the example address. */
      searchText: [
        "What you type into a search or filter field is sent to the server, which looks it up in the catalogue of planets and stars. The search field does this already while you type, to show suggestions. The text is part of the address of the request, for example ",
        ", so it appears in the log entry described above. It is not stored anywhere else and is not linked to you.",
      ],
      language: "The language of the pages",
      languageText:
        "When you open an address without a language, the server reads which languages your browser asks for and sends you to the pages in the first one it has. It keeps nothing about that: the language is part of the address from then on, and no cookie is set.",
      models: "The 3D models and the map",
      modelsText:
        "The turning planets, the 3D models and the map of the Milky Way are drawn by your own device. For that the website asks your browser whether it can draw 3D graphics. Nothing about your device is sent to the server.",
      links: "Links to other websites",
      linksText:
        "This website links to other websites, for example the NASA Exoplanet Archive. Data reaches them only when you follow such a link. From then on their own privacy policies apply.",
      catalogueText:
        "The catalogue as a PDF file is such a link too: the file is kept at GitHub, so your browser asks GitHub for it when you download it, and GitHub learns your IP address the way this server does when you open a page.",
      mail: "When you write an e-mail",
      mailText:
        "If you write to the address above, your e-mail address and your message are used to answer you, on the basis of Art. 6 (1) (f) GDPR: the legitimate interest is to answer what you asked. They are deleted once the matter is settled, unless the law requires them to be kept.",
      mailProvider: (provider: string) => `E-mails to this address are received and stored by ${provider}.`,
      automated: "No automated decisions",
      automatedText: "This website makes no decisions about you by automated means and creates no profiles (Art. 22 GDPR).",
      rights: "Your rights",
      rightsIntro: "Regarding your personal data you have the right to",
      rightsList: [
        "learn which data is processed (Art. 15 GDPR),",
        "have wrong data corrected (Art. 16 GDPR),",
        "have data deleted (Art. 17 GDPR),",
        "have the processing restricted (Art. 18 GDPR),",
        "receive data that you provided in a common, machine-readable format, where the processing rests on consent or a contract (Art. 20 GDPR; on this website that is not the case),",
        "object to the processing, see the next section (Art. 21 GDPR),",
        "complain to a data protection authority, for example the one where you live (Art. 77 GDPR).",
      ],
      rightsHow: "To use these rights, an e-mail to the address above is enough.",
      object: "Your right to object",
      objectText:
        "All processing described here rests on a legitimate interest (Art. 6 (1) (f) GDPR). You may object to it at any time, for reasons that arise from your particular situation (Art. 21 (1) GDPR). The data is then no longer processed, unless there are compelling legitimate grounds that override your interests, rights and freedoms, or the processing serves to establish, exercise or defend legal claims. An e-mail to the address above is enough.",
      changes: "Changes",
      changesText:
        "This policy describes the website as it is now. When the website changes, the policy changes with it. Last changed in November 2026.",
    },
  },

  special: {
    description: "The brightest star in the whole galaxy.",
    where: "At the very heart of the Milky Way",
    letter: [
      "Before you, my sky was dark. Then you came into my life and turned everything upside down in the most beautiful way. Out of all the hundreds of billions of stars in this galaxy, you are the one that shines brighter than every other, my special star and the light that I call home.",
      "Your eyes are the sparkling stars of my sky, and your smile makes my heart shine brighter and warmer than any sun. You always make me laugh, and you bring so much love and happiness into every one of my days. You mean the whole world to me, and I am so proud to have you by my side.",
      "You are the love of my life and the greatest gift I could ever have been given. Thank you for always supporting me, for loving me unconditionally, and for being such a wonderful person. I love you more than anything, and my heart beats only for you.",
      "I promise to stand by you on the bright days and the dark ones, to make you laugh as often as you make me laugh, and to love you a little more every single day. A wonderful future lies ahead of us, and I want to spend the rest of my life with you, for as long as the stars keep shining.",
    ],
    foreverYours: "Forever yours,",
    facts: [
      ["Brightness", "beyond any scale"],
      ["Warmth", "infinite"],
      ["Position", "centre of my universe"],
      ["Known planets", "one, orbiting her forever"],
    ],
    back: "Back to the map",
  },

  map: {
    title: "Map",
    description:
      "Fly through the Milky Way: every star with known planets at its real position, and each system with its planets in 3D.",
    heading: "Map of the Milky Way",
    noScript: "The map needs JavaScript. Every star and planet also has its own page.",
  },
};

export type Messages = typeof en;
export type ClientMessages = typeof client;
