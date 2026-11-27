import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import { formatters } from "@/shared/format";
import { INTL_LOCALES } from "../locales";
import type { ClientMessages, Messages } from "./en";

interface Kind {
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
}

const client: ClientMessages = {
  units: { days: "{n} Tage", years: "{n} Jahre" },
  search: { placeholder: "Planeten und Sterne suchen", suggestions: "Vorschläge" },
  filter: { placeholder: "Planeten nach Namen filtern" },
  language: "Sprache",
  viewer: {
    label: "3D-Modell: {name}. Die Pfeiltasten drehen es, Plus und Minus zoomen, Null setzt es zurück.",
    zoomOut: "Verkleinern",
    zoomIn: "Vergrößern",
    reset: "Zurücksetzen",
    spin: "Drehen",
    pause: "Anhalten",
    close: "Schließen",
    fullScreen: "Vollbild",
    shapeFailed: "Dieser Browser kann das 3D-Modell ({name}) nicht zeichnen.",
    shapeLoading: "Form wird geladen: {name} …",
  },
  error: {
    title: "Diese Seite konnte nicht geladen werden",
    text: "Beim Lesen des Katalogs ist etwas schiefgegangen. Meist ist das nur vorübergehend, etwa wenn die Datenbank gerade neu startet.",
    retry: "Erneut versuchen",
  },
  map: {
    loading: "Die Karte wird geladen …",
    needsWebgl: "Die Karte braucht WebGL 2",
    needsWebglText: [
      "Dieser Browser kann keine 3D-Grafik zeichnen, oder sie ist abgeschaltet. Jeder Stern und jeder Planet hat auch eine eigene Seite: über die Suche oben, oder zum Einstieg ",
      "das Sonnensystem",
      ".",
    ],
    viewSystem: "3D-Ansicht des Systems {name} mit seinen Planeten. Ziehen dreht die Ansicht, Scrollen zoomt.",
    viewGalaxy: "3D-Karte der Milchstraße. Ziehen zum Umsehen, Fliegen mit W, A, S und D.",
    showPanel: "» Leiste zeigen",
    loadingStars: "Die Sterne werden geladen …",
    starsFailed: "Die Sterne konnten nicht geladen werden. Läuft die Datenbank?",
    sun: "Sonne",
    wholeGalaxy: "Ganze Galaxie",
    flyFreely: "Frei fliegen",
    orbitCentre: "Um das Zentrum",
    flyFreelyTitle: "Wieder frei fliegen",
    orbitCentreTitle: "Um das Zentrum der Milchstraße drehen",
    credits: "Quellen",
    legalNotice: "Impressum",
    privacy: "Datenschutz",
    find: "Einen Stern auf der Karte finden",
    noStar: "Kein Stern mit diesem Namen.",
    galacticCentre: "Galaktisches Zentrum",
    planetsOne: "1 bekannter Planet",
    planetsOther: "{n} bekannte Planeten",
    sunPlanets: "{n} Planeten",
    distance: "{n} Lichtjahre von der Sonne",
    ownStar: "Unser eigener Stern",
    unknownDistance: "In unbekannter Entfernung",
    clear: "Auswahl aufheben",
    entering: "Wird geladen …",
    enter: "System betreten",
    fly: "Hinfliegen",
    starPage: "Seite des Sterns",
    systemFailed: "Dieses System konnte nicht geladen werden.",
    specialWhere: "Mitten im Herzen der Milchstraße",
    specialWhat: "Der hellste Stern der ganzen Galaxie",
    specialOpen: "Infoseite öffnen",
    specialName: "Mein besonderer Stern",
    galaxy: "Galaxie",
    play: "Abspielen",
    pause: "Anhalten",
    trueScale: "Maßstabsgetreu",
    compressed: "Gestaucht",
    toCompressed: "Zum gestauchten Maßstab wechseln: Abstände zusammengerückt, Planeten vergrößert",
    toTrueScale: "Zum wahren Maßstab wechseln: Abstände und Größen, wie sie sind",
    zone: "Habitable Zone",
    zoneUnknown:
      "Die Temperatur oder der Radius dieses Sterns ist nicht bekannt, deshalb lässt sich seine habitable Zone nicht berechnen",
    zoneTitle: "Zeigen, wo ein Planet flüssiges Wasser an seiner Oberfläche halten könnte",
    zoneRange: "Habitable Zone: {inner} bis {outer} AE",
    zoneEmpty: "Kein bekannter Planet kreist darin.",
    inZone: "In der habitablen Zone",
    atZoneEdge: "Am Rand der habitablen Zone",
    hidePanel: "Leiste ausblenden",
    hidePanelTitle: "Die Leiste ausblenden, um das ganze Bild zu sehen",
    wholeSystem: "Ganzes System",
    page: "Seite",
    hideMoons: "Monde ausblenden",
    showMoons: "Monde zeigen",
    moonsOf: "Monde: {name}",
    smallerOne: "1 kleinerer Mond",
    smallerOther: "{n} kleinere Monde",
    illustration: "Es gibt keine Nahaufnahmen: Form und Oberfläche sind eine Illustration.",
    noPlanets: "Für diesen Stern ist kein bestätigter Planet verzeichnet.",
    landmarks: {
      "Orion Nebula": "Orionnebel",
      "Rosette Nebula": "Rosettennebel",
      "North America Nebula": "Nordamerikanebel",
      "Lagoon Nebula": "Lagunennebel",
      "Eagle Nebula": "Adlernebel",
      "Carina Nebula": "Carinanebel",
      "Trifid Nebula": "Trifidnebel",
      "Omega Nebula": "Omeganebel",
      "Heart Nebula": "Herznebel",
      "Crab Nebula": "Krebsnebel",
      "Veil Nebula": "Cirrusnebel",
      "Ring Nebula": "Ringnebel",
      "Helix Nebula": "Helixnebel",
      Pleiades: "Plejaden",
      Hyades: "Hyaden",
      "Beehive Cluster": "Krippe (Praesepe)",
      "Double Cluster": "Doppelhaufen im Perseus",
      "Hercules Cluster (M13)": "Herkuleshaufen (M13)",
      "Large Magellanic Cloud": "Große Magellansche Wolke",
      "Small Magellanic Cloud": "Kleine Magellansche Wolke",
    },
  },
};

const CLASS_LABELS: Record<PlanetClass, string> = {
  rocky: "Gesteinsplanet",
  super_earth: "Supererde",
  neptune_like: "Neptunähnlicher Planet",
  gas_giant: "Gasriese",
};

const CLIMATE_LABELS: Record<ClimateClass, string> = {
  frozen: "eisig",
  cold: "kalt",
  temperate: "gemäßigt",
  hot: "heiß",
  scorching: "glutheiß",
};

/** A class within a sentence: its noun for one and for several, its gender, and an adjective it brings along. */
interface ClassNoun {
  one: string;
  several: string;
  feminine: boolean;
  adjective: string | null;
}

const PLAIN_NOUN: ClassNoun = { one: "Planet", several: "Planeten", feminine: false, adjective: null };

const CLASS_NOUNS: Record<PlanetClass, ClassNoun> = {
  rocky: { one: "Gesteinsplanet", several: "Gesteinsplaneten", feminine: false, adjective: null },
  super_earth: { one: "Supererde", several: "Supererden", feminine: true, adjective: null },
  neptune_like: { ...PLAIN_NOUN, adjective: "neptunähnlich" },
  gas_giant: { one: "Gasriese", several: "Gasriesen", feminine: false, adjective: null },
};

/**
 * A kind of planet within a sentence. German adjectives take their ending from what stands in front:
 * "1 heißer Gasriese" and "kein heißer Gasriese" for one, "7 heiße Gasriesen" for several, and
 * "keine heißen Gasriesen" after a word that already shows the case.
 */
function kindNoun({ planetClass, climateClass }: Kind, form: "one" | "several" | "afterArticle"): string {
  const noun = planetClass ? CLASS_NOUNS[planetClass] : PLAIN_NOUN;
  const ending = form === "one" ? (noun.feminine ? "e" : "er") : form === "several" ? "e" : "en";
  const adjectives = [climateClass && CLIMATE_LABELS[climateClass], noun.adjective].filter((word) => word !== null);
  return [...adjectives.map((word) => word + ending), form === "one" ? noun.one : noun.several].join(" ");
}

/** "Kein" in front of a kind of planet, in the gender of its noun. */
const none = ({ planetClass }: Kind) => (planetClass && CLASS_NOUNS[planetClass].feminine ? "Keine" : "Kein");

const FEMININE = new Set(["Erde", "Venus", "Sonne"]);
const MASCULINE = new Set(["Merkur", "Mars", "Jupiter", "Saturn", "Uranus", "Neptun", "Pluto", "Mond"]);

/** "des Saturn" or "der Erde": whose something is, for the bodies that take an article in German. */
function ofBody(name: string): string {
  return FEMININE.has(name) ? `der ${name}` : MASCULINE.has(name) ? `des ${name}` : `von ${name}`;
}

/** "zum Saturn" or "zur Erde": where something leads. */
function toBody(name: string): string {
  return FEMININE.has(name) ? `zur ${name}` : MASCULINE.has(name) ? `zum ${name}` : `zu ${name}`;
}

const knownPlanets = (count: number) => (count === 1 ? "einem bekannten Planeten" : `${count} bekannten Planeten`);

const fmt = formatters(INTL_LOCALES.de, client.units);

const VOYAGER_URANUS =
  "Voyager 2 sah beim Vorbeiflug 1986 nur die Südhälfte; der Norden ist mit einer weichen Fortsetzung der benachbarten Töne gefüllt";

export const de: Messages = {
  locale: "de",
  fmt,
  client,
  names: {
    sun: "Sonne",
    mercury: "Merkur",
    earth: "Erde",
    neptune: "Neptun",
    moon: "Mond",
    ganymede: "Ganymed",
    callisto: "Kallisto",
  },

  site: {
    description:
      "Alle bekannten Exoplaneten: durchsuchbar, mit einer Seite für jeden Planeten und seinen Stern, und zum Vergleich unser eigenes Sonnensystem.",
    nav: { planets: "Planeten", map: "Karte", solarSystem: "Sonnensystem" },
    footer: [
      "Exoplaneten-Daten aus dem ",
      ". Bilder von Exoplaneten sind aus den Daten berechnete Illustrationen, keine Fotos. Woher jedes Bild, jede Karte und jeder Wert stammt, steht unter ",
      ".",
    ],
    legal: "Rechtliches",
    credits: "Quellen",
    legalNotice: "Impressum",
    privacy: "Datenschutz",
  },

  notFound: {
    title: "Hier ist nichts",
    text: "Unter dieser Adresse gibt es keine Seite. Vielleicht wird der Planet oder der Stern im Katalog anders geschrieben: Das Suchfeld oben hilft weiter.",
    back: "Zurück zur Startseite",
  },

  home: {
    intro:
      "Alle bekannten Exoplaneten an einem Ort. Nach einem Namen suchen oder mit einem der Planeten unten beginnen. Jeder Planet und jeder Stern hat eine eigene Seite.",
    featured: "Zum Einstieg",
    loadingPlanets: "Planeten werden geladen",
    loadingFigures: "Die Zahlen des Katalogs werden geladen",
    figures: "Der Katalog in Zahlen",
    exoplanets: "Exoplaneten",
    hostStars: "Sterne mit Planeten",
    atKnownDistance: "davon in bekannter Entfernung",
    unclassified: (count) => `${count} Planeten lassen sich nicht einordnen, weil weder Radius noch Masse bekannt sind. `,
    solarPlanets: (count) => `Hinzu kommen die ${count} Planeten unseres Sonnensystems. `,
    lastSync: (when) => `Zuletzt mit der NASA abgeglichen: ${when}.`,
    emptyDatabase: "Die Datenbank ist noch leer. „npm run sync“ füllt sie.",
    databaseDown: "Die Datenbank ist gerade nicht erreichbar.",
    bookTitle: "Der Katalog als Buch",
    bookText:
      "Jeder Planet, jeder Mond und jeder Zwergplanet auf einer eigenen Seite, mit Bild und Werten, dazu Inhaltsverzeichnis, Register und alle Quellen, in einer PDF-Datei. Das Buch gibt es bisher nur auf Englisch.",
    bookButton: "Gesamten Katalog herunterladen",
  },

  classes: {
    planet: "Planet",
    label: CLASS_LABELS,
    plural: {
      rocky: "Gesteinsplaneten",
      super_earth: "Supererden",
      neptune_like: "Neptunähnliche Planeten",
      gas_giant: "Gasriesen",
    },
    climate: CLIMATE_LABELS,
    describe: (planetClass, climateClass) => {
      const label = planetClass ? CLASS_LABELS[planetClass] : "Planet";
      return climateClass ? `${label}, ${CLIMATE_LABELS[climateClass]}` : label;
    },
  },

  list: {
    title: "Alle Planeten",
    description:
      "Alle bekannten Exoplaneten und die Planeten des Sonnensystems in einer Liste, sortiert nach Name oder Entdeckungsjahr und eingrenzbar auf eine Art wie gemäßigte Gesteinsplaneten oder heiße Gasriesen.",
    planet: "Planet",
    star: "Stern",
    discovered: "Entdeckt",
    antiquity: "Seit dem Altertum bekannt",
    sortOrder: "Reihenfolge",
    sortBy: "Sortieren nach",
    byName: "Name",
    byDiscovery: "Entdeckungsjahr",
    pagesTop: "Seiten, oben",
    pagesBottom: "Seiten, unten",
    pages: "Seiten",
    previousPage: "Vorherige Seite",
    nextPage: "Nächste Seite",
    page: (page) => `Seite ${page}`,
    loading: "Die Liste wird geladen",
    filterNav: "Nach Art des Planeten filtern",
    type: "Typ",
    climate: "Klima",
    removeFilter: "Diesen Filter entfernen",
    noMatch: (query) =>
      `Kein Planet passt zu „${query}“. Ein kürzerer Teil des Namens hilft oft, zum Beispiel „Kepler-22“ oder „TRAPPIST“.`,
    count: (kind, total, query) => {
      const count = `${fmt.count(total)} ${kindNoun(kind, total === 1 ? "one" : "several")}`;
      return query === "" ? count : `${count} ${total === 1 ? "passt" : "passen"} zu „${query}“`;
    },
    range: (first, last) => ` · angezeigt: ${fmt.count(first)}–${fmt.count(last)}`,
    empty: (kind, query) =>
      query === ""
        ? `Der Katalog führt keine ${kindNoun(kind, "afterArticle")}. Ohne einen der beiden Filter gibt es mehr zu sehen.`
        : `${none(kind)} ${kindNoun(kind, "one")} passt zu „${query}“. Ein kürzerer Teil des Namens oder ein Filter weniger hilft weiter.`,
  },

  search: {
    title: "Suche",
    description:
      "Alle bekannten Exoplaneten, ihre Sterne und die Monde und Zwergplaneten des Sonnensystems nach Namen durchsuchen, oder die Planeten einer Art auflisten, etwa gemäßigte Gesteinsplaneten oder heiße Gasriesen.",
    hint: "Den Namen eines Planeten, eines Mondes oder eines Sterns ins Suchfeld eingeben. Oder oben eine Art von Planeten wählen, um alle Planeten dieser Art aufzulisten.",
    noMatch: (query) => `Kein Planet oder Stern passt zu „${query}“.`,
    tooShort: (min) => ` Mindestens ${min} Zeichen eingeben.`,
    tryShorter: " Ein kürzerer Teil des Namens hilft oft, zum Beispiel „Kepler-22“ oder „TRAPPIST“.",
    similar: (query) => `Kein Name enthält „${query}“. Diese Namen sind ähnlich:`,
    firstMatches: (count, query) =>
      `Die ersten ${count} Treffer für „${query}“. Mehr vom Namen eingeben, um sie einzugrenzen.`,
    matches: (count, query) => `${count} Treffer für „${query}“.`,
    kindTooShort: (min, kind) =>
      `Mindestens ${min} Zeichen eingeben oder das Suchfeld leeren, um alle ${kindNoun(kind, "afterArticle")} aufzulisten.`,
    kindSimilar: (kind, query) =>
      `${none(kind)} ${kindNoun(kind, "one")} hat „${query}“ im Namen. Diese Namen sind ähnlich:`,
    searching: "Suche läuft",
  },

  card: {
    noLongerListed: "nicht mehr geführt",
    star: (planets) => (planets === 1 ? "Stern · 1 bekannter Planet" : `Stern · ${planets} bekannte Planeten`),
    across: (kilometres) => `${kilometres} km Durchmesser`,
  },

  facts: {
    unknown: "unbekannt",
    radius: "Radius",
    mass: "Masse",
    density: "Dichte",
    equilibriumTemperature: "Gleichgewichtstemperatur",
    starlight: "Empfangenes Sternenlicht",
    calculated: "berechnet",
    minimumMass: "Mindestmasse",
    orbitalPeriod: "Umlaufzeit",
    distanceFromStar: "Abstand vom Stern",
    eccentricity: "Exzentrizität",
    inclination: "Bahnneigung",
    method: "Methode",
    year: "Jahr",
    facility: "Einrichtung",
    spectralType: "Spektraltyp",
    temperature: "Temperatur",
    brightness: "Helligkeit von der Erde aus",
    distance: "Entfernung",
    surfaceGravity: "Schwerkraft an der Oberfläche",
    orbits: "Umkreist",
    distanceFromSun: "Abstand von der Sonne",
    distanceFromPlanet: "Abstand vom Planeten",
    distanceFrom: (body) => `Abstand ${toBody(body)}`,
    discoveredBy: "Entdeckt von",
    knownSince: "Bekannt seit",
    antiquity: "dem Altertum",
    knownMoons: "Bekannte Monde",
    none: "keine",
    group: "Gruppe",
    estimated: "geschätzt",
    direction: "Umlaufrichtung",
    backwards: "rückläufig",
    withSpin: (body) => `mit der Drehung ${ofBody(body)}`,
    timesEarth: (value) => `${value} × Erde`,
    timesSun: (value) => `${value} × Sonne`,
    au: "AE",
    mag: "mag",
    methods: {
      Transit: "Transitmethode",
      "Radial Velocity": "Radialgeschwindigkeit",
      Microlensing: "Mikrolinseneffekt",
      Imaging: "Direkte Abbildung",
      "Transit Timing Variations": "Schwankungen der Transitzeiten",
      "Eclipse Timing Variations": "Schwankungen der Bedeckungszeiten",
      "Orbital Brightness Modulation": "Helligkeitsschwankung im Umlauf",
      "Pulsar Timing": "Pulsar-Zeitmessung",
      Astrometry: "Astrometrie",
      "Pulsation Timing Variations": "Schwankungen der Pulsationszeiten",
      "Disk Kinematics": "Scheibenkinematik",
    },
    groups: {
      Norse: "Nordische Gruppe",
      "Norse (Skathi subgroup)": "Nordische Gruppe (Skathi-Untergruppe)",
      "Norse (Narvi subgroup)": "Nordische Gruppe (Narvi-Untergruppe)",
      Inuit: "Inuit-Gruppe",
      Gallic: "Gallische Gruppe",
      "Carme group": "Carme-Gruppe",
      "Ananke group": "Ananke-Gruppe",
      "Pasiphae group": "Pasiphae-Gruppe",
      "Himalia group": "Himalia-Gruppe",
      "Carpo group": "Carpo-Gruppe",
      "Themisto group": "Themisto-Gruppe",
      "Valetudo group": "Valetudo-Gruppe",
      "Caliban group": "Caliban-Gruppe",
      "Sao group": "Sao-Gruppe",
      "Neso group": "Neso-Gruppe",
      "Halimede group": "Halimede-Gruppe",
      "Inner (Amalthea) group": "Innere Gruppe (Amalthea-Gruppe)",
      "inner regular": "innerer regulärer Mond",
      "inner regular (ring moonlet)": "innerer regulärer Mond (Ringmöndchen)",
      "retrograde irregular (Sycorax-like, ungrouped)": "rückläufig, irregulär (Sycorax-ähnlich, ohne Gruppe)",
      "prograde irregular (Margaret)": "rechtläufig, irregulär (Margaret)",
      "Nereid (prograde irregular)": "Nereid (rechtläufig, irregulär)",
    },
  },

  fields: {
    name: "Name",
    status: "Status",
    star: "Zentralstern",
    discoveryMethod: "Entdeckungsmethode",
    discoveryYear: "Entdeckungsjahr",
    discoveryFacility: "Entdeckende Einrichtung",
    orbitalPeriodDays: "Umlaufzeit (Tage)",
    semiMajorAxisAu: "Große Halbachse (AE)",
    eccentricity: "Exzentrizität",
    radiusEarth: "Radius (Erdradien)",
    radiusCalculated: "Radius ist berechnet",
    massEarth: "Masse (Erdmassen)",
    massCalculated: "Masse ist berechnet",
    massIsMinimum: "Masse ist eine Mindestmasse",
    density: "Dichte (g/cm³)",
    densityCalculated: "Dichte ist berechnet",
    eqTempK: "Gleichgewichtstemperatur (K)",
    eqTempCalculated: "Gleichgewichtstemperatur ist berechnet",
    insolation: "Einstrahlung (Erde = 1)",
    insolationCalculated: "Einstrahlung ist berechnet",
  },

  planet: {
    notFound: "Planet nicht gefunden",
    description: (kind, star) => `${kind} (Stern: ${star}): Messwerte, Entdeckung und Änderungsverlauf.`,
    removed: (since) =>
      `Die NASA führt diesen Planeten nicht mehr unter den bestätigten Exoplaneten${since ? ` (bemerkt am ${since})` : ""}. Die Werte unten sind die zuletzt bekannten.`,
    illustration: (name) => `Illustration: ${name}`,
    headline: (kind, isSun) => [`${kind}, umkreist ${isSun ? "die " : ""}`, ""],
    distance: (lightYears) => `, ${lightYears} Lichtjahre von der Sonne`,
    formerly: (names) => `Früher geführt als ${names}.`,
    onOrbit: "In 3D auf seiner Bahn ansehen",
    modelReal: "Das Modell zeigt eine echte Karte des Planeten, zusammengesetzt aus Aufnahmen von Raumsonden.",
    modelComputed:
      "Niemand hat diesen Planeten aus der Nähe gesehen. Das Modell ist aus den Werten unten berechnet: Es zeigt, wie ein Planet dieser Größe und Temperatur aussehen könnte.",
    modelHowTo:
      "Ziehen dreht es zu jeder Seite, gezoomt wird mit den Schaltflächen, mit zwei Fingern oder mit Strg und dem Mausrad.",
    mapCredit: "Karte: ",
    section: "Planet",
    calculatedNote:
      "„Berechnet“ kennzeichnet Werte, die aus anderen Messungen abgeleitet statt gemessen wurden. „Mindestmasse“ heißt, dass nur eine Untergrenze bekannt ist; die wahre Masse kann höher liegen. Die Gleichgewichtstemperatur lässt eine Atmosphäre außer Acht, die Oberfläche kann also deutlich wärmer sein.",
    orbit: "Umlaufbahn",
    orbitNote: "1 AE ist der Abstand zwischen Erde und Sonne. Eine Exzentrizität von 0 ist ein perfekter Kreis.",
    discovery: "Entdeckung",
    moon: "Mond",
    moons: "Monde",
    hostStar: (star) => `Zentralstern: ${star}`,
    moreAbout: (star) => `Mehr über ${FEMININE.has(star) ? `die ${star}` : star}`,
    others: (count) =>
      count === 1 ? "Ein weiterer bekannter Planet in diesem System" : `${count} weitere bekannte Planeten in diesem System`,
    history: "Änderungsverlauf",
    historyIntro: "Bei jedem Abgleich des Katalogs mit der NASA werden geänderte Werte hier festgehalten.",
    date: "Datum",
    value: "Wert",
    before: "Vorher",
    after: "Nachher",
    valuesFrom: "Werte aus dem ",
    factSheet: "NASA Planetary Fact Sheet",
    archiveSource: (when) => `Werte aus dem NASA Exoplanet Archive, hier zuletzt geändert am ${when}. `,
    allData: (name) => `Alle Daten zu ${name} im Archiv`,
    size: (name, times) => `${name} ist ${times}-mal so breit wie die Erde.`,
    earth: "Erde",
  },

  star: {
    notFound: "Stern nicht gefunden",
    description: (name, planets) => `${name} mit ${knownPlanets(planets)}.`,
    headline: (isSun, lightYears, planets) =>
      `${isSun ? "Unser eigener Stern" : lightYears !== null ? `Stern, ${lightYears} Lichtjahre von der Sonne entfernt,` : "Stern in unbekannter Entfernung"} mit ${knownPlanets(planets)}`,
    formerly: (names) => `Früher geführt als ${names}.`,
    viewSystem: "Das System in 3D ansehen",
    openMap: "Die Karte der Milchstraße öffnen",
    findOnMap: "Auf der Karte finden",
    noPosition: "Ohne Entfernung lässt sich dieser Stern nicht auf der Karte einordnen.",
    planets: (count) => (count === 1 ? "Planet" : "Planeten"),
    noneListed: "Die NASA führt für diesen Stern derzeit keinen bestätigten Planeten.",
    noLongerListed: "Von der NASA nicht mehr geführt",
    dwarfs: "Zwergplaneten und Vesta",
    section: "Stern",
    distanceValue: (lightYears, parsecs) => `${lightYears} Lj (${parsecs} pc)`,
    magnitudeNote:
      "Die Helligkeit ist in Magnituden angegeben: Je kleiner die Zahl, desto heller der Stern. Die schwächsten Sterne, die das bloße Auge noch sieht, liegen bei etwa 6 mag.",
    position: "Position",
    rightAscension: "Rektaszension",
    declination: "Deklination",
    catalogueNames: "Katalognamen",
  },

  body: {
    notFound: "Nicht gefunden",
    moon: "Mond",
    dwarfPlanet: "Zwergplanet",
    asteroid: "Asteroid",
    moons: "Monde",
    moonOf: (parent) => `Mond ${ofBody(parent)}`,
    headline: (kind, parent) => {
      if (kind === "moon") return [FEMININE.has(parent) ? "Mond der " : MASCULINE.has(parent) ? "Mond des " : "Mond von ", ""];
      return [kind === "dwarf_planet" ? "Zwergplanet, umkreist die " : "Asteroid, umkreist die ", ""];
    },
    onOrbit: "In 3D auf seiner Bahn ansehen",
    modelShapeAndMap:
      "Das Modell zeigt die echte, von Raumsonden vermessene Form mit einer Karte, die aus ihren Aufnahmen zusammengesetzt ist",
    modelShape:
      "Das Modell zeigt die echte, von Raumsonden vermessene Form. Keine Raumsonde hat die ganze Oberfläche kartiert, deshalb ist sie allein in ihrer Farbe gezeichnet",
    modelMap: "Das Modell zeigt eine echte Karte, zusammengesetzt aus Aufnahmen von Raumsonden",
    modelHowTo:
      ". Ziehen dreht es zu jeder Seite, gezoomt wird mit den Schaltflächen, mit zwei Fingern oder mit Strg und dem Mausrad.",
    shapeCredit: "Form: ",
    mapCredit: "Karte: ",
    radiusNote: (longest) =>
      `Der Radius ist der mittlere Radius, also der Radius einer Kugel mit gleichem Volumen${
        longest ? `; ${longest.name} ist alles andere als rund, die längste Achse misst ${longest.kilometres} km` : ""
      }. Die Masse ist aus der Anziehungskraft abgeleitet, die Raumsonden gemessen haben, oder aus den Bahnen der Nachbarn.`,
    orbitNoteSun:
      "1 AE ist der Abstand zwischen Erde und Sonne. Die Bahnneigung wird gegen die Ebene der Erdbahn gemessen.",
    orbitNoteEcliptic:
      "Der Abstand ist der mittlere Abstand zwischen den Mittelpunkten. Die Bahnneigung wird gegen die Ebene der Erdbahn gemessen, um die die Mondbahn pendelt.",
    orbitNoteEquator:
      "Der Abstand ist der mittlere Abstand zwischen den Mittelpunkten. Die Bahnneigung wird gegen die Ebene gemessen, um die die Bahn pendelt, nahe am Äquator des Planeten; über 90° läuft der Mond rückwärts um.",
    antiquity: "Seit dem Altertum bekannt: Er ist am Nachthimmel nicht zu übersehen.",
    otherLargeMoons: (parent) => `Weitere große Monde ${ofBody(parent)}`,
    valuesFrom: "Werte von ",
    jpl: "JPL Solar System Dynamics",
    andThe: " und aus dem ",
    plutoFactSheet: "NASA Pluto Fact Sheet",
    massKilograms: (value) => `${value} × 10¹⁵ kg`,
    summaries: {
      phobos:
        "Der größere der beiden Marsmonde, ein unförmiger Körper von 26 km Länge. Er umrundet den Mars dreimal am Tag, näher als jeder andere Mond an seinem Planeten, und sinkt langsam nach innen: In etwa 50 Millionen Jahren werden ihn die Gezeiten zerreißen.",
      deimos:
        "Der kleinere, äußere Mond des Mars, 16 km lang. Eine dicke Staubdecke hat die meisten Krater gefüllt und die Oberfläche geglättet.",
      moon: "Der einzige natürliche Begleiter der Erde. Die dunklen Ebenen sind uralte Lavafluten; die hellen Hochländer sind ältere Kruste, von Einschlägen zerschlagen.",
      io: "Der vulkanisch aktivste bekannte Körper. Jupiters Gezeiten kneten sein Inneres und speisen Hunderte Vulkane, deren Schwefel die Oberfläche gelb, orange und weiß färbt.",
      europa:
        "Eine Schale aus Eis, kreuz und quer von langen Rissen durchzogen, bedeckt einen salzigen Ozean. Europa ist einer der aussichtsreichsten Orte im Sonnensystem für die Suche nach Leben.",
      ganymede:
        "Der größte Mond des Sonnensystems, breiter als Merkur, und der einzige mit einem eigenen Magnetfeld. Dunkles, altes Gelände wechselt mit jüngerem, gefurchtem Eis.",
      callisto:
        "Eine der am dichtesten verkraterten Oberflächen, die man kennt. Die dunkle Eiskruste hat sich in vier Milliarden Jahren kaum verändert.",
      pan: "Ein walnussförmiger Mond, der in der Encke-Teilung von Saturns A-Ring kreist und sie offen hält. Um seinen Äquator läuft ein Wulst aus Ringmaterial, das er aufgesammelt hat.",
      daphnis:
        "Ein winziger Mond in der Keeler-Lücke des A-Rings. Seine Anziehung wirft an den Rändern der Lücke Wellen auf, die lange Schatten werfen, wenn die Sonne tief über den Ringen steht.",
      atlas:
        "Ein Mond knapp außerhalb des A-Rings. Ein Wulst aus Ringteilchen um seinen Äquator gibt ihm die Form einer fliegenden Untertasse.",
      prometheus:
        "Der innere Hirtenmond des schmalen F-Rings. Bei jedem Vorbeiflug zieht er Schlieren und Rinnen aus dem Ring.",
      pandora: "Der äußere Hirtenmond des F-Rings: ein länglicher, verkraterter Mond unter einer Decke aus feinem Staub.",
      epimetheus:
        "Er teilt sich seine Bahn mit Janus. Alle vier Jahre tauschen die beiden die Plätze: Der innere wandert nach außen und der äußere nach innen.",
      janus:
        "Der größere der beiden Monde, die sich eine Bahn teilen: ein verkraterter, kartoffelförmiger Körper, der alle vier Jahre mit Epimetheus die Plätze tauscht.",
      telesto:
        "Ein kleiner, glatter Mond, der Tethys auf derselben Bahn um 60 Grad vorausläuft, an einem ihrer Lagrange-Punkte.",
      calypso:
        "Ein kleiner, heller Mond, der Tethys auf derselben Bahn um 60 Grad nachläuft, an einem ihrer Lagrange-Punkte.",
      helene:
        "Sie läuft Dione auf derselben Bahn um 60 Grad voraus. Lange Streifen zeigen, wo feines Material hangabwärts über ihre Oberfläche gerutscht ist.",
      mimas:
        "Der Krater Herschel misst ein Drittel seiner Breite und lässt den kleinen Mond wie ein starrendes Auge aussehen.",
      enceladus:
        "Geysire an seinem Südpol sprühen Wasser aus einem Ozean unter dem Eis ins All und speisen Saturns E-Ring. Sein frisches Eis wirft fast das ganze Sonnenlicht zurück.",
      tethys:
        "Fast ganz aus Wassereis. Der riesige Krater Odysseus und die Schlucht Ithaca Chasma, die über drei Viertel des Umfangs läuft, zeichnen die Oberfläche.",
      dione:
        "Helle Eisklippen, Hunderte Meter hoch, durchziehen die Seite, die auf der Bahn hinten liegt; die vordere Seite ist von Kratern bedeckt.",
      rhea: "Saturns zweitgrößter Mond: eine kalte, dicht verkraterte Kugel aus Eis und etwas Gestein.",
      titan:
        "Der einzige Mond mit einer dichten Atmosphäre, dichter als die der Erde. Unter dem orangefarbenen Dunst formen Flüsse, Seen und Meere aus flüssigem Methan und Ethan das Land.",
      hyperion:
        "Ein Mond wie ein Schwamm, so porös, dass fast die Hälfte von ihm leerer Raum ist, übersät mit tiefen, scharfkantigen Kratern. Titans Anziehung lässt ihn nicht zur Ruhe kommen: Er taumelt chaotisch, statt sich um eine feste Achse zu drehen.",
      phoebe:
        "Ein dunkler Körper, der Saturn rückwärts umläuft, weit außerhalb der großen Monde: ein eingefangenes Überbleibsel aus dem äußeren Sonnensystem. Staub, der von ihm abgeschlagen wird, bildet einen riesigen, schwachen Ring.",
      iapetus:
        "Eine Seite ist dunkel wie Kohle und die andere hell wie Schnee, und entlang eines großen Teils des Äquators läuft ein bis zu 20 km hoher Bergrücken.",
      miranda:
        "Ein Flickwerk aus gefurchtem Gelände und Klippen, die etwa 20 km tief abfallen. Der kleine Mond muss in seiner Vergangenheit zerrissen und neu geformt worden sein.",
      ariel: "Der hellste der großen Uranusmonde, mit einer jungen Oberfläche, die lange Grabenbrüche durchschneiden.",
      umbriel:
        "Der dunkelste der großen Uranusmonde: alt und dicht verkratert, bis auf einen rätselhaften hellen Ring nahe dem Äquator, den Krater Wunda.",
      titania:
        "Der größte Mond des Uranus. Riesige Schluchten spalten die Eiskruste, die wohl aufriss, als das Innere gefror und sich ausdehnte.",
      oberon:
        "Der äußerste große Mond des Uranus: alt und verkratert, mit dunklem Material auf dem Boden vieler Krater.",
      triton:
        "Er umläuft Neptun rückwärts, wurde also wahrscheinlich aus dem Kuipergürtel eingefangen. Aus seiner gefrorenen Oberfläche steigen Geysire aus Stickstoff auf.",
      vesta:
        "Der zweitgrößte Körper des Asteroidengürtels und sein hellster. Ein gewaltiger Einschlag nahe dem Südpol schlug das Becken Rheasilvia, 500 km breit mit einem über 20 km hohen Zentralberg, und Stücke von Vesta fallen noch heute als Meteorite auf die Erde.",
      ceres:
        "Das größte Objekt im Asteroidengürtel und der einzige Zwergplanet im inneren Sonnensystem. Auf dem Boden des Kraters Occator leuchten helle Salzablagerungen.",
      pluto:
        "Der bekannteste Zwergplanet des Kuipergürtels. Eine weite Ebene aus Stickstoffeis, Sputnik Planitia, bildet das helle Herz auf seinem Gesicht.",
      charon:
        "Halb so breit wie Pluto, deshalb kreisen die beiden um einen Punkt zwischen ihnen. Eine rötliche Kappe aus Material, das Plutos Atmosphäre verloren hat, bedeckt den Nordpol.",
    },
    mapNotes: {
      io: "die überhöhten Farben des Originals sind auf das zurückgenommen, was ein Auge sähe",
      europa:
        "die grauen Aufnahmen sind in Europas Farben getönt, und das kleine Gebiet um den Südpol, das keine Raumsonde gesehen hat, ist mit den benachbarten Tönen gefüllt",
      ganymede: "die überhöhten Farben des Originals sind zurückgenommen",
      callisto:
        "die grauen Aufnahmen sind in Kallistos Farben getönt, und die Gebiete nahe den Polen, die keine Raumsonde gesehen hat, sind mit den benachbarten Tönen gefüllt",
      mimas: "die grauen Aufnahmen sind in den Farben von Mimas getönt",
      dione: "südlich von etwa 63° S gibt es nur die groben Aufnahmen von Voyager",
      titan:
        "im sichtbaren Licht verbirgt der orangefarbene Dunst den Boden; das schwache Muster ist die Oberfläche, wie Cassini sie im nahen Infrarot gesehen hat",
      phoebe:
        "Cassini hat den hohen Norden nur zum Teil gesehen, der Rest ist mit den benachbarten Tönen gefüllt; die grauen Aufnahmen sind in Phoebes Farben getönt",
      iapetus: "die Farben des Originals, die bis ins Ultraviolette und Infrarote reichen, sind zurückgenommen",
      miranda: VOYAGER_URANUS,
      ariel: VOYAGER_URANUS,
      umbriel: VOYAGER_URANUS,
      titania: VOYAGER_URANUS,
      oberon: VOYAGER_URANUS,
      triton:
        "Voyager 2 sah 1989 nur einen Teil der Südhälfte; der Rest ist mit einer weichen Fortsetzung der benachbarten Töne gefüllt, und die Farben sind zurückgenommen",
      vesta:
        "der hohe Norden lag im Winterdunkel, als Dawn Vesta kartierte, und ist mit den benachbarten Tönen gefüllt, und die grauen Aufnahmen sind in Vestas Farben getönt",
      phobos: "die grauen Aufnahmen sind in den Farben von Phobos getönt",
      ceres: "die grauen Aufnahmen sind in den Farben von Ceres getönt",
      pluto:
        "New Horizons flog 2015 vorbei und sah eine Seite aus der Nähe; die Rückseite ist grob, und der Süden, der im Dunkeln lag, ist eine Illustration: Seine Farben setzen die benachbarten fort, und Krater und Relief sind von den Teilen geliehen, die New Horizons aus der Nähe sah. Die grauen Aufnahmen sind in Plutos Farben getönt",
      charon:
        "New Horizons sah eine Seite aus der Nähe; die Rückseite ist grob, und der Süden, der im Dunkeln lag, ist eine Illustration: Seine Farben setzen die benachbarten fort, und Krater und Relief sind von den Teilen geliehen, die New Horizons aus der Nähe sah. Die grauen Aufnahmen sind in Charons Farben getönt",
    },
  },

  smallMoon: {
    description: (parent) =>
      `Mond ${ofBody(parent)}: seine Bahn, seine Größe und seine Entdeckung, mit einem Modell, wie er aussehen könnte.`,
    model: (name) =>
      `ExoFinder hat kein Formmodell und keine Karte von ${name}, deshalb ist das Modell eine Illustration: Form und Oberfläche sind erfunden, echt sind nur die Werte unten. Ziehen dreht es zu jeder Seite, gezoomt wird mit den Schaltflächen, mit zwei Fingern oder mit Strg und dem Mausrad.`,
    radiusMeasured: "Der Radius ist der mittlere Radius. ",
    radiusEstimated:
      "Die meisten kleinen Monde wurden nur als Lichtpunkte gesehen, deshalb ist der Radius aus der Helligkeit des Mondes geschätzt. ",
    noMass: "Keine Raumsonde hat die Anziehung der meisten kleinen Monde gemessen, deshalb ist keine Masse angegeben.",
    groupNote:
      " Die Monde einer Gruppe kreisen auf ähnlichen Bahnen; die fernen Gruppen gelten als Bruchstücke von Körpern, die zerbrochen sind.",
    orbitNote: (ecliptic, parent) =>
      `Der Abstand ist der mittlere Abstand zwischen den Mittelpunkten. Die Bahnneigung wird gegen ${
        ecliptic
          ? "die Ebene der Erdbahn gemessen, wie bei den meisten fernen Monden, die ein Planet eingefangen hat"
          : `die Ebene gemessen, um die die Bahn pendelt, nahe am Äquator ${ofBody(parent)}`
      }; über 90° läuft der Mond rückwärts um.`,
    source: ["Bahn und Entdeckung von ", ", geschätzte Größen und Gruppen außerdem von ", "."],
    allMoons: (parent) => `Alle Monde ${ofBody(parent)}`,
  },

  moonTable: {
    summary: (count, parent, backwards) =>
      `Alle ${count} bekannten Monde ${ofBody(parent)}${backwards ? `, ${backwards} davon rückläufig` : ""}`,
    moon: "Mond",
    diameter: "Durchmesser",
    distance: "Abstand",
    orbit: "Umlauf",
    found: "Entdeckt",
    unknown: "unbekannt",
    backwards: "rückläufig",
    antiquity: "Altertum",
    note: (parent) => [
      `„≈“ kennzeichnet Größen, die aus der Helligkeit eines Mondes geschätzt sind, denn die meisten kleinen Monde wurden nur als Lichtpunkte gesehen. Der Abstand ist der mittlere Abstand vom Mittelpunkt ${ofBody(parent)}. Bahnen und Entdeckungen von `,
      ", geschätzte Größen außerdem von ",
      ".",
    ],
  },

  browse: {
    label: "Im Katalog blättern",
    number: (position, total) => `Nr. ${position}${total ? ` von ${total}` : ""}`,
    skip: "Monde überspringen:",
    backTo: (name) => `zurück ${toBody(name)}`,
    onTo: (name) => `weiter ${toBody(name)}`,
    previous: "Zurück",
    next: "Weiter",
    solarSystem: "Sonnensystem",
    system: (star, lightYears) => (lightYears ? `${star} · ${lightYears} Lichtjahre` : star),
  },

  credits: {
    title: "Quellen",
    description: "Woher die Bilder, Karten, Formen und Werte in ExoFinder stammen und unter welchen Lizenzen sie stehen.",
    intro:
      "ExoFinder baut auf der Arbeit von Raumfahrtbehörden, Observatorien und Forschenden auf. Hier steht, woher jedes Bild, jede Karte, jede Form und jeder Wert stammt und unter welcher Lizenz es genutzt wird. Alle Bilder wurden für das Web verkleinert und komprimiert; weitere Änderungen sind unten genannt.",
    publicDomain: "gemeinfrei",
    sky: "Der Himmel und die Milchstraße",
    skyPanorama: "Himmelspanorama",
    galaxyPicture: "Bild der Galaxie",
    galaxyNote: "Die Karte baut die Galaxie aus Wolken und Sternen auf, die nach diesem Bild gesetzt sind.",
    planetMaps: "Karten der Sonne und der Planeten",
    planetMapsSubject: "Die Sonne, die acht Planeten und Saturns Ringe",
    planetMapsNote: "Die Karte der Venus zeigt die Obergrenze ihrer Wolken.",
    moonMaps: "Karten der Monde, der Zwergplaneten und von Vesta",
    moonMapsIntro:
      "Mosaike aus Aufnahmen von Raumsonden, die NASA und USGS als gemeinfreie Werke veröffentlichen, genannt so, wie es die Missionsteams erbitten. Sie wurden so gedreht, dass der Längengrad 0 in der Mitte liegt; graue Mosaike wurden in den Farben des Körpers getönt, überhöhte Farben zurückgenommen, die Helligkeit nach der Albedo des Körpers eingestellt und Gebiete, die keine Raumsonde gesehen hat, mit einer weichen Fortsetzung der benachbarten Töne gefüllt. Der Süden von Pluto und von Charon, je ein Drittel der Kugel, leiht sich außerdem Krater und Relief von den Teilen, die New Horizons aus der Nähe sah, damit er nicht abgeschnitten wirkt; er ist eine Illustration.",
    shapes: "Formen der unregelmäßigen Körper",
    shapesIntro:
      "Formmodelle aus dem NASA Planetary Data System und dem Small Body Mapping Tool des Johns Hopkins University Applied Physics Laboratory, abgetastet zu einem Raster aus Radien.",
    values: "Werte",
    exoplanetValues: "Exoplaneten und ihre Sterne",
    exoplanetValuesNote: "Wird jeden Tag abgeglichen.",
    planetValues: "Die Planeten des Sonnensystems",
    moonValues: "Monde, Ceres und Vesta",
    charonDensity: "Die Dichte von Charon",
    smallMoonSizes: "Größen und Gruppen kleiner Monde, wo das JPL keine nennt",
    methods: "Methoden",
    methodsIntro: "Was ExoFinder selbst berechnet, folgt veröffentlichten Arbeiten.",
    classMethod: "Die Klasse eines Planeten ohne gemessenen Radius",
    cloudMethod: "Die Wolkenfarben von Gasriesen nach Temperatur",
    zoneMethod: "Die habitable Zone eines Sterns",
    exoplanetPictures: "Bilder von Exoplaneten",
    exoplanetPicturesIntro:
      "Kein Teleskop hat die Oberfläche eines Exoplaneten gesehen. Ihre Bilder sind aus den Messwerten berechnet, auf Grundkarten, die ExoFinder selbst simuliert; sie enthalten kein Material Dritter.",
  },

  legal: {
    incomplete: (missing) =>
      `Diese Seite ist nicht vollständig. Wer diese Kopie von ExoFinder betreibt, hat seine Angaben noch nicht eingetragen. Es fehlen: ${missing}. Sie werden als Umgebungsvariablen gesetzt, siehe .env.example.`,
    email: "E-Mail: ",
    phone: "Telefon: ",
    notice: {
      title: "Impressum",
      subtitle: "Impressum",
      description: "Wer diese Website betreibt und wie er zu erreichen ist.",
      who: "Wer diese Website betreibt",
      basis: "Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV",
      contact: "Kontakt",
      about: "Über diese Website",
      aboutText:
        "ExoFinder ist ein privates Projekt ohne Werbung und ohne kommerziellen Zweck. Der Quellcode ist unter der MIT-Lizenz öffentlich.",
      data: "Daten und Bilder",
      dataText: [
        "Die Daten über Exoplaneten stammen aus dem ",
        ", die Daten über die Planeten des Sonnensystems aus den ",
        ". Die Werte werden automatisch übernommen und nicht von Hand geprüft, sie können also Fehler enthalten oder veraltet sein. Für wissenschaftliche Arbeit sind sie nicht gedacht: Dafür ist das Archiv selbst die richtige Quelle.",
      ],
      factSheets: "NASA Planetary Fact Sheets",
      illustrations: "Bilder von Exoplaneten sind aus den Daten berechnete Illustrationen, keine Fotos.",
      mapsText: [
        "Die Karten der Planeten des Sonnensystems stammen von ",
        " und beruhen auf Bildmaterial der NASA. Das Panorama des Himmels ist „The Milky Way panorama“ von ",
        ". Die Galaxie auf der Karte ist nach dem „Artist’s impression of the Milky Way“ von ",
        " gezeichnet. Alle stehen unter der Lizenz ",
        ". Sie wurden für diese Website verkleinert und komprimiert; die Karte der Venus zeigt die Wolkenobergrenze, nicht die Oberfläche, und das Bild der Galaxie hat eine Dicke bekommen, damit es von jeder Seite zu sehen ist.",
      ],
      links: "Links zu anderen Websites",
      linksText:
        "Diese Website verlinkt auf Websites anderer. Für das, was dort gezeigt wird, sind allein deren Betreiber verantwortlich. Die verlinkten Seiten waren frei von erkennbar rechtswidrigen Inhalten, als die Links gesetzt wurden. Sollte sich eine von ihnen geändert haben, genügt ein Hinweis per E-Mail, und der Link wird entfernt.",
    },
    privacy: {
      title: "Datenschutzerklärung",
      subtitle: "Datenschutzerklärung",
      description: "Was diese Website über ihre Besucher erfährt und was nicht.",
      short: "Kurz gesagt",
      shortList: [
        "Keine Cookies, und in Ihrem Browser wird nichts gespeichert.",
        "Keine Statistik, kein Tracking, keine Werbung.",
        "Keine Konten, keine Formulare, kein Newsletter.",
        "Nichts wird von anderen Unternehmen geladen: Schriften, Bilder und Karten kommen von diesem Server.",
      ],
      shortText:
        "Die einzigen personenbezogenen Daten, mit denen diese Website umgeht, sind die, die jeder Webserver braucht, um eine Anfrage zu beantworten, vor allem Ihre IP-Adresse.",
      responsible: "Wer verantwortlich ist",
      responsibleText:
        "Verantwortlich für die Verarbeitung von Daten auf dieser Website (Verantwortlicher im Sinne der DSGVO):",
      open: "Wenn Sie eine Seite öffnen",
      openText:
        "Ihr Browser schickt eine Anfrage an den Server, und der Server braucht Ihre IP-Adresse, um die Antwort zurückzuschicken. Der Server schreibt zu der Anfrage einen Protokolleintrag mit:",
      logList: [
        "der IP-Adresse,",
        "Datum und Uhrzeit,",
        "der Adresse der angefragten Seite oder Datei,",
        "der Seite, von der die Anfrage kam, falls Ihr Browser sie nennt,",
        "Name und Version Ihres Browsers und Ihres Betriebssystems, wie Ihr Browser sie nennt.",
      ],
      logPurpose:
        "Das Protokoll wird gebraucht, um die Website am Laufen zu halten und Angriffe und Fehler zu bemerken. Das ist ein berechtigtes Interesse, Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. f DSGVO. Die Einträge werden nicht mit anderen Daten zusammengeführt und nicht genutzt, um herauszufinden, wer Sie sind. ",
      logKept: "Sie werden nur so lange aufbewahrt, wie dieser Zweck es erfordert, und danach gelöscht.",
      logDeleted: (days) => `Sie werden nach ${days === 1 ? "einem Tag" : `${days} Tagen`} gelöscht.`,
      encrypted: "Die Verbindung ist verschlüsselt (HTTPS), unterwegs kann also niemand mitlesen, was gesendet wird.",
      hostContract: (host) =>
        `Die Website läuft auf Servern von ${host}. Das Unternehmen verarbeitet die oben genannten Daten im Auftrag des Betreibers und nur nach dessen Weisung, auf Grundlage eines Vertrags nach Art. 28 DSGVO.`,
      hostOwn: (host) =>
        `Die Website läuft auf Servern von ${host}. Das Unternehmen erhält die oben genannten Daten, weil es die Seiten ausliefert, und geht damit nach seiner eigenen Datenschutzerklärung um. Die Weitergabe beruht auf demselben berechtigten Interesse: Ohne einen Hoster ist die Website nicht erreichbar.`,
      hostTransfer: (basis) => `Die Daten können auch außerhalb der Europäischen Union verarbeitet werden. ${basis}`,
      notRequired:
        "Sie sind weder gesetzlich noch vertraglich verpflichtet, diese Daten bereitzustellen. Ohne die IP-Adresse kann der Server Ihnen die Seite jedoch nicht schicken.",
      search: "Wenn Sie suchen",
      searchText: [
        "Was Sie in ein Such- oder Filterfeld eingeben, wird an den Server geschickt, der es im Katalog der Planeten und Sterne nachschlägt. Das Suchfeld tut das schon während der Eingabe, um Vorschläge zu zeigen. Der Text ist Teil der Adresse der Anfrage, zum Beispiel ",
        ", und steht deshalb in dem oben beschriebenen Protokolleintrag. Er wird nirgends sonst gespeichert und nicht mit Ihnen verknüpft.",
      ],
      language: "Die Sprache der Seiten",
      languageText:
        "Wenn Sie eine Adresse ohne Sprache öffnen, liest der Server, welche Sprachen Ihr Browser wünscht, und leitet Sie zu den Seiten in der ersten davon, die es gibt. Darüber wird nichts aufbewahrt: Die Sprache ist von da an Teil der Adresse, und es wird kein Cookie gesetzt.",
      models: "Die 3D-Modelle und die Karte",
      modelsText:
        "Die sich drehenden Planeten, die 3D-Modelle und die Karte der Milchstraße zeichnet Ihr eigenes Gerät. Dafür fragt die Website Ihren Browser, ob er 3D-Grafik zeichnen kann. Über Ihr Gerät wird nichts an den Server gesendet.",
      links: "Links zu anderen Websites",
      linksText:
        "Diese Website verlinkt auf andere Websites, zum Beispiel das NASA Exoplanet Archive. Daten gelangen erst dorthin, wenn Sie einem solchen Link folgen. Von da an gelten deren eigene Datenschutzerklärungen.",
      catalogueText:
        "Auch der Katalog als PDF-Datei ist ein solcher Link: Die Datei liegt bei GitHub, Ihr Browser fragt sie also beim Herunterladen bei GitHub an, und GitHub erfährt Ihre IP-Adresse so, wie dieser Server sie erfährt, wenn Sie eine Seite öffnen.",
      mail: "Wenn Sie eine E-Mail schreiben",
      mailText:
        "Wenn Sie an die oben genannte Adresse schreiben, werden Ihre E-Mail-Adresse und Ihre Nachricht genutzt, um Ihnen zu antworten, auf Grundlage von Art. 6 Abs. 1 Buchst. f DSGVO: Das berechtigte Interesse besteht darin, Ihre Anfrage zu beantworten. Sie werden gelöscht, sobald die Sache erledigt ist, sofern das Gesetz keine Aufbewahrung verlangt.",
      mailProvider: (provider) => `E-Mails an diese Adresse werden von ${provider} empfangen und gespeichert.`,
      automated: "Keine automatisierten Entscheidungen",
      automatedText:
        "Diese Website trifft keine automatisierten Entscheidungen über Sie und bildet keine Profile (Art. 22 DSGVO).",
      rights: "Ihre Rechte",
      rightsIntro: "In Bezug auf Ihre personenbezogenen Daten haben Sie das Recht,",
      rightsList: [
        "zu erfahren, welche Daten verarbeitet werden (Art. 15 DSGVO),",
        "falsche Daten berichtigen zu lassen (Art. 16 DSGVO),",
        "Daten löschen zu lassen (Art. 17 DSGVO),",
        "die Verarbeitung einschränken zu lassen (Art. 18 DSGVO),",
        "Daten, die Sie bereitgestellt haben, in einem gängigen, maschinenlesbaren Format zu erhalten, soweit die Verarbeitung auf einer Einwilligung oder einem Vertrag beruht (Art. 20 DSGVO; auf dieser Website ist das nicht der Fall),",
        "der Verarbeitung zu widersprechen, siehe den nächsten Abschnitt (Art. 21 DSGVO),",
        "sich bei einer Datenschutzaufsichtsbehörde zu beschweren, zum Beispiel bei der an Ihrem Wohnort (Art. 77 DSGVO).",
      ],
      rightsHow: "Um diese Rechte auszuüben, genügt eine E-Mail an die oben genannte Adresse.",
      object: "Ihr Widerspruchsrecht",
      objectText:
        "Alle hier beschriebenen Verarbeitungen beruhen auf einem berechtigten Interesse (Art. 6 Abs. 1 Buchst. f DSGVO). Sie können ihnen jederzeit aus Gründen widersprechen, die sich aus Ihrer besonderen Situation ergeben (Art. 21 Abs. 1 DSGVO). Die Daten werden dann nicht mehr verarbeitet, es sei denn, es liegen zwingende schutzwürdige Gründe vor, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen. Eine E-Mail an die oben genannte Adresse genügt.",
      changes: "Änderungen",
      changesText:
        "Diese Erklärung beschreibt die Website, wie sie jetzt ist. Ändert sich die Website, ändert sich die Erklärung mit ihr. Zuletzt geändert im November 2026.",
    },
  },

  special: {
    description: "Der hellste Stern der ganzen Galaxie.",
    where: "Mitten im Herzen der Milchstraße",
    letter: [
      "Vor dir war mein Himmel dunkel. Dann bist du in mein Leben gekommen und hast alles auf die schönste Weise auf den Kopf gestellt. Unter all den Hunderten Milliarden Sternen dieser Galaxie bist du der eine, der heller leuchtet als jeder andere, mein besonderer Stern und das Licht, das ich Zuhause nenne.",
      "Deine Augen sind die funkelnden Sterne meines Himmels, und dein Lächeln lässt mein Herz heller und wärmer strahlen als jede Sonne. Du bringst mich immer zum Lachen und schenkst jedem meiner Tage so viel Liebe und Glück. Du bedeutest mir die ganze Welt, und ich bin so stolz, dich an meiner Seite zu haben.",
      "Du bist die Liebe meines Lebens und das größte Geschenk, das ich je hätte bekommen können. Danke, dass du mich immer unterstützt, mich bedingungslos liebst und ein so wundervoller Mensch bist. Ich liebe dich über alles, und mein Herz schlägt nur für dich.",
      "Ich verspreche, an den hellen wie an den dunklen Tagen zu dir zu stehen, dich so oft zum Lachen zu bringen, wie du mich zum Lachen bringst, und dich jeden einzelnen Tag ein bisschen mehr zu lieben. Vor uns liegt eine wundervolle Zukunft, und ich möchte den Rest meines Lebens mit dir verbringen, solange die Sterne leuchten.",
    ],
    foreverYours: "Für immer dein,",
    facts: [
      ["Helligkeit", "jenseits jeder Skala"],
      ["Wärme", "unendlich"],
      ["Position", "Mittelpunkt meines Universums"],
      ["Bekannte Planeten", "einer, der sie für immer umkreist"],
    ],
    back: "Zurück zur Karte",
  },

  map: {
    title: "Karte",
    description:
      "Flug durch die Milchstraße: jeder Stern mit bekannten Planeten an seiner wirklichen Position, und jedes System mit seinen Planeten in 3D.",
    heading: "Karte der Milchstraße",
    noScript: "Die Karte braucht JavaScript. Jeder Stern und jeder Planet hat auch eine eigene Seite.",
  },
};
