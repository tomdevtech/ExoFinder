import type { ClimateClass, PlanetClass } from "@/app/planets/classify";
import { formatters } from "@/shared/format";
import { INTL_LOCALES } from "../locales";
import type { ClientMessages, Messages } from "./en";

interface Kind {
  planetClass: PlanetClass | null;
  climateClass: ClimateClass | null;
}

const client: ClientMessages = {
  units: { days: "{n} gün", years: "{n} yıl" },
  search: { placeholder: "Gezegen ve yıldız ara", suggestions: "Öneriler" },
  filter: { placeholder: "Gezegenleri ada göre filtrele" },
  language: "Dil",
  viewer: {
    label: "{name} 3B modeli. Ok tuşları döndürür, artı ve eksi yakınlaştırıp uzaklaştırır, sıfır sıfırlar.",
    zoomOut: "Uzaklaştır",
    zoomIn: "Yakınlaştır",
    reset: "Sıfırla",
    spin: "Döndür",
    pause: "Duraklat",
    close: "Kapat",
    fullScreen: "Tam ekran",
    shapeFailed: "Bu tarayıcı {name} 3B modelini çizemiyor.",
    shapeLoading: "{name} şekli yükleniyor…",
  },
  error: {
    title: "Bu sayfa yüklenemedi",
    text: "Katalog okunurken bir sorun oluştu. Bu genellikle geçicidir, örneğin veritabanı yeniden başlatılırken.",
    retry: "Tekrar dene",
  },
  map: {
    loading: "Harita yükleniyor…",
    needsWebgl: "Harita için WebGL 2 gerekli",
    needsWebglText: [
      "Bu tarayıcı 3B grafik çizemiyor veya 3B grafikler kapalı. Her yıldızın ve gezegenin kendi sayfası da var: yukarıdaki aramayı kullanın veya şuradan başlayın: ",
      "Güneş sistemi",
      ".",
    ],
    viewSystem: "{name} ve gezegenlerinin 3B görünümü. Döndürmek için sürükleyin, yakınlaştırmak için kaydırın.",
    viewGalaxy: "Samanyolu’nun 3B haritası. Etrafa bakmak için sürükleyin, W, A, S ve D ile uçun.",
    showPanel: "» Paneli göster",
    loadingStars: "Yıldızlar yükleniyor…",
    starsFailed: "Yıldızlar yüklenemedi. Veritabanı çalışıyor mu?",
    sun: "Güneş",
    wholeGalaxy: "Tüm galaksi",
    flyFreely: "Serbest uç",
    orbitCentre: "Merkez çevresinde dön",
    flyFreelyTitle: "Yeniden serbest uç",
    orbitCentreTitle: "Samanyolu’nun merkezi çevresinde dön",
    credits: "Kaynaklar",
    legalNotice: "Künye",
    privacy: "Gizlilik",
    find: "Haritada bir yıldız bul",
    noStar: "Bu adda bir yıldız yok.",
    galacticCentre: "Galaksi merkezi",
    planetsOne: "bilinen 1 gezegen",
    planetsOther: "bilinen {n} gezegen",
    sunPlanets: "{n} gezegen",
    distance: "Güneş’ten {n} ışık yılı uzakta",
    ownStar: "Kendi yıldızımız",
    unknownDistance: "Uzaklığı bilinmiyor",
    clear: "Seçimi temizle",
    entering: "Yükleniyor…",
    enter: "Sisteme gir",
    fly: "Oraya uç",
    starPage: "Yıldız sayfası",
    systemFailed: "Bu sistem yüklenemedi.",
    specialWhere: "Samanyolu’nun tam kalbinde",
    specialWhat: "Tüm galaksinin en parlak yıldızı",
    specialOpen: "Bilgi sayfasını aç",
    specialName: "Benim Özel Yıldızım",
    galaxy: "Galaksi",
    play: "Oynat",
    pause: "Duraklat",
    trueScale: "Gerçek ölçek",
    compressed: "Sıkıştırılmış",
    toCompressed: "Sıkıştırılmış ölçeğe geç: uzaklıklar kısaltılmış, gezegenler büyütülmüş",
    toTrueScale: "Gerçek ölçeğe geç: uzaklıklar ve boyutlar olduğu gibi",
    zone: "Yaşanabilir bölge",
    zoneUnknown: "Bu yıldızın sıcaklığı veya yarıçapı bilinmediği için yaşanabilir bölgesi hesaplanamıyor",
    zoneTitle: "Bir gezegenin yüzeyinde sıvı su tutabileceği yeri göster",
    zoneRange: "Yaşanabilir bölge: {inner} – {outer} AB",
    zoneEmpty: "İçinde bilinen hiçbir gezegen dolanmıyor.",
    inZone: "Yaşanabilir bölgede",
    atZoneEdge: "Yaşanabilir bölgenin kenarında",
    hidePanel: "Paneli gizle",
    hidePanelTitle: "Resmin tamamını görmek için paneli gizle",
    wholeSystem: "Tüm sistem",
    page: "Sayfa",
    hideMoons: "Uyduları gizle",
    showMoons: "Uyduları göster",
    moonsOf: "{name} uyduları",
    smallerOne: "1 küçük uydu daha",
    smallerOther: "{n} küçük uydu daha",
    illustration: "Yakın çekim görüntüsü yok: şekli ve yüzeyi bir illüstrasyondur.",
    noPlanets: "Bu yıldız için doğrulanmış bir gezegen kayıtlı değil.",
    landmarks: {
      "Orion Nebula": "Orion Bulutsusu",
      "Rosette Nebula": "Rozet Bulutsusu",
      "North America Nebula": "Kuzey Amerika Bulutsusu",
      "Lagoon Nebula": "Lagün Bulutsusu",
      "Eagle Nebula": "Kartal Bulutsusu",
      "Carina Nebula": "Karina Bulutsusu",
      "Trifid Nebula": "Üç Boğumlu Bulutsu",
      "Omega Nebula": "Omega Bulutsusu",
      "Heart Nebula": "Kalp Bulutsusu",
      "Crab Nebula": "Yengeç Bulutsusu",
      "Veil Nebula": "Peçe Bulutsusu",
      "Ring Nebula": "Halka Bulutsusu",
      "Helix Nebula": "Helis Bulutsusu",
      Pleiades: "Ülker",
      "Beehive Cluster": "Arı Kovanı Kümesi",
      "Double Cluster": "Çift Küme",
      "Hercules Cluster (M13)": "Herkül Kümesi (M13)",
      "Large Magellanic Cloud": "Büyük Macellan Bulutu",
      "Small Magellanic Cloud": "Küçük Macellan Bulutu",
    },
  },
};

const CLASS_LABELS: Record<PlanetClass, string> = {
  rocky: "Kayalık gezegen",
  super_earth: "Süper Dünya",
  neptune_like: "Neptün benzeri gezegen",
  gas_giant: "Gaz devi",
};

const CLIMATE_LABELS: Record<ClimateClass, string> = {
  frozen: "donmuş",
  cold: "soğuk",
  temperate: "ılıman",
  hot: "sıcak",
  scorching: "kavurucu",
};

/**
 * The classes within a sentence. Turkish keeps the noun in the singular after a number, so one form serves
 * every count; the second is the plural as the object of a sentence, as in "list all gas giants".
 */
const CLASS_NOUNS: Record<PlanetClass, [noun: string, allOfThem: string]> = {
  rocky: ["kayalık gezegen", "kayalık gezegenleri"],
  super_earth: ["süper Dünya", "süper Dünyaları"],
  neptune_like: ["Neptün benzeri gezegen", "Neptün benzeri gezegenleri"],
  gas_giant: ["gaz devi", "gaz devlerini"],
};

function kindNoun({ planetClass, climateClass }: Kind, allOfThem = false): string {
  const [noun, plural] = planetClass ? CLASS_NOUNS[planetClass] : ["gezegen", "gezegenleri"];
  const word = allOfThem ? plural : noun;
  return climateClass ? `${CLIMATE_LABELS[climateClass]} ${word}` : word;
}

const VOWELS = "aeıioöuü";

/** The last vowel of a name, which decides the vowels of every ending the name takes. */
function lastVowel(name: string): string {
  return [...name.toLocaleLowerCase("tr")].findLast((letter) => VOWELS.includes(letter)) ?? "e";
}

const endsInVowel = (name: string) => VOWELS.includes(name.toLocaleLowerCase("tr").at(-1) ?? "");

/** The ending that says whose something is: "’ün" for Satürn, "’nın" for Dünya. */
function genitiveEnding(name: string): string {
  const last = lastVowel(name);
  const vowel = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  return `’${endsInVowel(name) ? "n" : ""}${vowel}n`;
}

/** "Satürn’ün" or "Dünya’nın": the name of a body of the solar system as the owner of what follows. */
const of = (name: string) => name + genitiveEnding(name);

/** "Satürn’e" or "Dünya’ya": the name of a body as where something leads. */
const to = (name: string) => `${name}’${endsInVowel(name) ? "y" : ""}${"aıou".includes(lastVowel(name)) ? "a" : "e"}`;

const fmt = formatters(INTL_LOCALES.tr, client.units);

const HOW_TO = "Her yanına bakmak için sürükleyin; düğmelerle, iki parmakla veya Ctrl ve fare tekerleğiyle yakınlaştırın.";

const VOYAGER_URANUS =
  "Voyager 2, 1986’daki geçişinde yalnızca güney yarıyı görmüştür; kuzey, yakındaki tonların yumuşak bir devamıyla doldurulmuştur";

export const tr: Messages = {
  locale: "tr",
  fmt,
  client,
  names: {
    sun: "Güneş",
    mercury: "Merkür",
    venus: "Venüs",
    earth: "Dünya",
    jupiter: "Jüpiter",
    saturn: "Satürn",
    uranus: "Uranüs",
    neptune: "Neptün",
    moon: "Ay",
    pluto: "Plüton",
  },

  site: {
    description:
      "Bilinen tüm ötegezegenler: aranabilir, her gezegen ve yıldızı için ayrı bir sayfa, karşılaştırma için de kendi Güneş sistemimiz.",
    nav: { planets: "Gezegenler", map: "Harita", solarSystem: "Güneş sistemi" },
    footer: [
      "Ötegezegen verileri: ",
      ". Ötegezegen görselleri fotoğraf değil, verilerden hesaplanmış illüstrasyonlardır. Her görselin, haritanın ve değerin nereden geldiği şurada listelenir: ",
      ".",
    ],
    legal: "Yasal",
    credits: "Kaynaklar",
    legalNotice: "Künye",
    privacy: "Gizlilik",
  },

  notFound: {
    title: "Burada bir şey yok",
    text: "Bu adreste bir sayfa yok. Gezegen veya yıldız katalogda farklı yazılıyor olabilir: yukarıdaki arama alanını deneyin.",
    back: "Ana sayfaya dön",
  },

  home: {
    intro:
      "Bilinen tüm ötegezegenler tek bir yerde. Ada göre arayın veya aşağıdaki gezegenlerden biriyle başlayın. Her gezegenin ve her yıldızın kendi sayfası var.",
    featured: "Başlangıç noktaları",
    loadingPlanets: "Gezegenler yükleniyor",
    loadingFigures: "Katalog sayıları yükleniyor",
    figures: "Sayılarla katalog",
    exoplanets: "Ötegezegenler",
    hostStars: "Gezegeni olan yıldızlar",
    atKnownDistance: "bunlardan uzaklığı bilinenler",
    unclassified: (count) => `${count} gezegen, ne yarıçapı ne de kütlesi bilindiği için sınıflandırılamıyor. `,
    solarPlanets: (count) => `Bunlara Güneş sistemimizin ${count} gezegeni ekleniyor. `,
    lastSync: (when) => `NASA ile son karşılaştırma: ${when}.`,
    emptyDatabase: "Veritabanı henüz boş. Doldurmak için “npm run sync” komutunu çalıştırın.",
    databaseDown: "Veritabanına şu anda ulaşılamıyor.",
    bookTitle: "Kitap olarak katalog",
    bookText:
      "Her gezegen, uydu ve cüce gezegen kendi sayfasında; görseli ve değerleriyle, içindekiler, dizin ve tüm kaynaklarla birlikte tek bir PDF dosyasında. Kitap şimdilik yalnızca İngilizce.",
    bookButton: "Kataloğun tamamını indir",
  },

  classes: {
    planet: "Gezegen",
    label: CLASS_LABELS,
    plural: {
      rocky: "Kayalık gezegenler",
      super_earth: "Süper Dünyalar",
      neptune_like: "Neptün benzeri gezegenler",
      gas_giant: "Gaz devleri",
    },
    climate: CLIMATE_LABELS,
    describe: (planetClass, climateClass) => {
      const label = planetClass ? CLASS_LABELS[planetClass] : "Gezegen";
      return climateClass ? `${label}, ${CLIMATE_LABELS[climateClass]}` : label;
    },
  },

  list: {
    title: "Tüm gezegenler",
    description:
      "Bilinen tüm ötegezegenler ve Güneş sistemindeki gezegenler tek listede; ada veya keşif yılına göre sıralanır, ılıman kayalık gezegenler ya da sıcak gaz devleri gibi tek bir türe daraltılabilir.",
    planet: "Gezegen",
    star: "Yıldız",
    discovered: "Keşif",
    antiquity: "Antik çağdan beri biliniyor",
    sortOrder: "Sıralama",
    sortBy: "Sırala",
    byName: "Ad",
    byDiscovery: "Keşif yılı",
    pagesTop: "Sayfalar, üst",
    pagesBottom: "Sayfalar, alt",
    pages: "Sayfalar",
    previousPage: "Önceki sayfa",
    nextPage: "Sonraki sayfa",
    page: (page) => `Sayfa ${page}`,
    loading: "Liste yükleniyor",
    filterNav: "Gezegen türüne göre filtrele",
    type: "Tür",
    climate: "İklim",
    removeFilter: "Bu filtreyi kaldır",
    noMatch: (query) =>
      `“${query}” ile eşleşen gezegen yok. Adın daha kısa bir bölümünü deneyin, örneğin “Kepler-22” veya “TRAPPIST”.`,
    count: (kind, total, query) => {
      const count = `${fmt.count(total)} ${kindNoun(kind)}`;
      return query === "" ? count : `“${query}” ile eşleşen ${count}`;
    },
    range: (first, last) => ` · gösterilen: ${fmt.count(first)}–${fmt.count(last)}`,
    empty: (kind, query) =>
      query === ""
        ? `Katalogda hiç ${kindNoun(kind)} yok. Daha fazlasını görmek için iki filtreden birini kaldırın.`
        : `“${query}” ile eşleşen ${kindNoun(kind)} yok. Adın daha kısa bir bölümünü deneyin veya bir filtreyi kaldırın.`,
  },

  search: {
    title: "Arama",
    description:
      "Bilinen tüm ötegezegenleri, yıldızlarını ve Güneş sistemindeki uyduları ve cüce gezegenleri ada göre arayın veya ılıman kayalık gezegenler ya da sıcak gaz devleri gibi tek bir türdeki gezegenleri listeleyin.",
    hint: "Arama alanına bir gezegenin, uydunun veya yıldızın adını yazın. Ya da o türdeki tüm gezegenleri listelemek için yukarıdan bir gezegen türü seçin.",
    noMatch: (query) => `“${query}” ile eşleşen gezegen veya yıldız yok.`,
    tooShort: (min) => ` En az ${min} karakter yazın.`,
    tryShorter: " Adın daha kısa bir bölümünü deneyin, örneğin “Kepler-22” veya “TRAPPIST”.",
    similar: (query) => `Hiçbir ad “${query}” içermiyor. Şu adlar benzer:`,
    firstMatches: (count, query) => `“${query}” için ilk ${count} sonuç. Daraltmak için adın devamını yazın.`,
    matches: (count, query) => `“${query}” için ${count} sonuç.`,
    kindTooShort: (min, kind) =>
      `En az ${min} karakter yazın veya tüm ${kindNoun(kind, true)} listelemek için arama alanını temizleyin.`,
    kindSimilar: (kind, query) => `Adında “${query}” geçen ${kindNoun(kind)} yok. Şu adlar benzer:`,
    searching: "Aranıyor",
  },

  card: {
    noLongerListed: "artık listelenmiyor",
    star: (planets) => `Yıldız · bilinen ${planets} gezegen`,
    across: (kilometres) => `${kilometres} km çapında`,
  },

  facts: {
    unknown: "bilinmiyor",
    radius: "Yarıçap",
    mass: "Kütle",
    density: "Yoğunluk",
    equilibriumTemperature: "Denge sıcaklığı",
    starlight: "Aldığı yıldız ışığı",
    calculated: "hesaplanmış",
    minimumMass: "en düşük kütle",
    orbitalPeriod: "Yörünge periyodu",
    distanceFromStar: "Yıldıza uzaklık",
    eccentricity: "Dış merkezlik",
    inclination: "Yörünge eğikliği",
    method: "Yöntem",
    year: "Yıl",
    facility: "Tesis",
    spectralType: "Tayf türü",
    temperature: "Sıcaklık",
    brightness: "Dünya’dan görülen parlaklık",
    distance: "Uzaklık",
    surfaceGravity: "Yüzey çekimi",
    orbits: "Çevresinde döndüğü cisim",
    distanceFromSun: "Güneş’e uzaklık",
    distanceFromPlanet: "Gezegene uzaklık",
    distanceFrom: (body) => `${to(body)} uzaklık`,
    discoveredBy: "Keşfeden",
    knownSince: "Biliniyor",
    antiquity: "antik çağdan beri",
    knownMoons: "Bilinen uydular",
    none: "yok",
    group: "Grup",
    estimated: "tahmini",
    direction: "Yön",
    backwards: "ters yönde",
    withSpin: (body) => `${of(body)} dönüş yönünde`,
    timesEarth: (value) => `${value} × Dünya`,
    timesSun: (value) => `${value} × Güneş`,
    au: "AB",
    mag: "kadir",
    methods: {
      Transit: "Geçiş (transit)",
      "Radial Velocity": "Dikine hız",
      Microlensing: "Mikromerceklenme",
      Imaging: "Doğrudan görüntüleme",
      "Transit Timing Variations": "Geçiş zamanlaması değişimleri",
      "Eclipse Timing Variations": "Tutulma zamanlaması değişimleri",
      "Orbital Brightness Modulation": "Yörüngesel parlaklık değişimi",
      "Pulsar Timing": "Pulsar zamanlaması",
      Astrometry: "Astrometri",
      "Pulsation Timing Variations": "Zonklama zamanlaması değişimleri",
      "Disk Kinematics": "Disk kinematiği",
    },
    groups: {
      Norse: "İskandinav grubu",
      "Norse (Skathi subgroup)": "İskandinav grubu (Skathi alt grubu)",
      "Norse (Narvi subgroup)": "İskandinav grubu (Narvi alt grubu)",
      Inuit: "İnuit grubu",
      Gallic: "Galya grubu",
      "Carme group": "Carme grubu",
      "Ananke group": "Ananke grubu",
      "Pasiphae group": "Pasiphae grubu",
      "Himalia group": "Himalia grubu",
      "Carpo group": "Carpo grubu",
      "Themisto group": "Themisto grubu",
      "Valetudo group": "Valetudo grubu",
      "Caliban group": "Caliban grubu",
      "Sao group": "Sao grubu",
      "Neso group": "Neso grubu",
      "Halimede group": "Halimede grubu",
      "Inner (Amalthea) group": "İç grup (Amalthea grubu)",
      "inner regular": "iç düzenli uydu",
      "inner regular (ring moonlet)": "iç düzenli uydu (halka uyducuğu)",
      "retrograde irregular (Sycorax-like, ungrouped)": "ters yönlü düzensiz uydu (Sycorax benzeri, grupsuz)",
      "prograde irregular (Margaret)": "ileri yönlü düzensiz uydu (Margaret)",
      "Nereid (prograde irregular)": "Nereid (ileri yönlü düzensiz uydu)",
    },
  },

  fields: {
    name: "Ad",
    status: "Durum",
    star: "Yıldızı",
    discoveryMethod: "Keşif yöntemi",
    discoveryYear: "Keşif yılı",
    discoveryFacility: "Keşfeden tesis",
    orbitalPeriodDays: "Yörünge periyodu (gün)",
    semiMajorAxisAu: "Yarı büyük eksen (AB)",
    eccentricity: "Dış merkezlik",
    radiusEarth: "Yarıçap (Dünya yarıçapı)",
    radiusCalculated: "Yarıçap hesaplanmış",
    massEarth: "Kütle (Dünya kütlesi)",
    massCalculated: "Kütle hesaplanmış",
    massIsMinimum: "Kütle bir en düşük kütle",
    density: "Yoğunluk (g/cm³)",
    densityCalculated: "Yoğunluk hesaplanmış",
    eqTempK: "Denge sıcaklığı (K)",
    eqTempCalculated: "Denge sıcaklığı hesaplanmış",
    insolation: "Işınım (Dünya = 1)",
    insolationCalculated: "Işınım hesaplanmış",
  },

  planet: {
    notFound: "Gezegen bulunamadı",
    description: (kind, star) => `${kind} (yıldızı: ${star}): ölçülen değerler, keşif ve değişiklik geçmişi.`,
    removed: (since) =>
      `NASA bu gezegeni artık doğrulanmış ötegezegenler arasında listelemiyor${since ? ` (fark edildiği tarih: ${since})` : ""}. Aşağıdaki değerler bilinen son değerlerdir.`,
    illustration: (name) => `${name} illüstrasyonu`,
    headline: (kind, isSun) => [`${kind} · `, isSun ? "’in çevresinde dönüyor" : " yıldızının çevresinde dönüyor"],
    distance: (lightYears) => `, Güneş’ten ${lightYears} ışık yılı uzakta`,
    formerly: (names) => `Eski adı: ${names}.`,
    onOrbit: "Yörüngesinde 3B olarak gör",
    modelReal: "Model, uzay araçlarının görüntülerinden birleştirilmiş gerçek bir gezegen haritasını gösterir.",
    modelComputed:
      "Bu gezegeni kimse yakından görmedi. Model aşağıdaki değerlerden hesaplanmıştır: bu boyutta ve sıcaklıkta bir gezegenin nasıl görünebileceğini gösterir.",
    modelHowTo: HOW_TO,
    mapCredit: "Harita: ",
    section: "Gezegen",
    calculatedNote:
      "“Hesaplanmış”, ölçülmek yerine başka ölçümlerden türetilmiş değerleri belirtir. “En düşük kütle”, yalnızca bir alt sınırın bilindiği anlamına gelir; gerçek kütle daha yüksek olabilir. Denge sıcaklığı atmosferi hesaba katmaz, bu yüzden yüzey çok daha sıcak olabilir.",
    orbit: "Yörünge",
    orbitNote: "1 AB, Dünya ile Güneş arasındaki uzaklıktır. 0 dış merkezlik kusursuz bir çemberdir.",
    discovery: "Keşif",
    moon: "Uydu",
    moons: "Uydular",
    hostStar: (star) => `Yıldızı: ${star}`,
    moreAbout: (star) => `${star} hakkında daha fazlası`,
    others: (count) => `Bu sistemde bilinen ${count} gezegen daha`,
    history: "Değişiklik geçmişi",
    historyIntro: "Katalog NASA ile her karşılaştırıldığında değişen değerler buraya kaydedilir.",
    date: "Tarih",
    value: "Değer",
    before: "Önce",
    after: "Sonra",
    valuesFrom: "Değerlerin kaynağı: ",
    factSheet: "NASA Planetary Fact Sheet",
    archiveSource: (when) => `Değerler NASA Exoplanet Archive’dan alınmıştır; burada en son ${when} tarihinde değişti. `,
    allData: (name) => `${name} için arşivdeki tüm veriler`,
    size: (name, times) => `${name}, Dünya’nın ${times} katı genişliğinde.`,
    earth: "Dünya",
  },

  star: {
    notFound: "Yıldız bulunamadı",
    description: (name, planets) => `${name} ve bilinen ${planets} gezegeni.`,
    headline: (isSun, lightYears, planets) =>
      `${isSun ? "Kendi yıldızımız" : lightYears !== null ? `Güneş’ten ${lightYears} ışık yılı uzaklıktaki yıldız` : "Uzaklığı bilinmeyen yıldız"} · bilinen ${planets} gezegen`,
    formerly: (names) => `Eski adı: ${names}.`,
    viewSystem: "Sistemi 3B olarak gör",
    openMap: "Samanyolu haritasını aç",
    findOnMap: "Haritada bul",
    noPosition: "Uzaklığı bilinmediği için bu yıldız haritaya yerleştirilemiyor.",
    planets: (count) => (count === 1 ? "Gezegen" : "Gezegenler"),
    noneListed: "NASA şu anda bu yıldız için doğrulanmış bir gezegen listelemiyor.",
    noLongerListed: "NASA tarafından artık listelenmiyor",
    dwarfs: "Cüce gezegenler ve Vesta",
    section: "Yıldız",
    distanceValue: (lightYears, parsecs) => `${lightYears} ışık yılı (${parsecs} pc)`,
    magnitudeNote:
      "Parlaklık kadir cinsinden verilir: sayı ne kadar küçükse yıldız o kadar parlaktır. Çıplak gözle görülebilen en sönük yıldızlar yaklaşık 6 kadirdir.",
    position: "Konum",
    rightAscension: "Sağ açıklık",
    declination: "Dik açıklık",
    catalogueNames: "Katalog adları",
  },

  body: {
    notFound: "Bulunamadı",
    moon: "Uydu",
    dwarfPlanet: "Cüce gezegen",
    asteroid: "Asteroit",
    moons: "Uydular",
    moonOf: (parent) => `${of(parent)} uydusu`,
    headline: (kind, parent) => {
      const ending = genitiveEnding(parent);
      if (kind === "moon") return ["", `${ending} uydusu`];
      return ["", `${ending} çevresinde dönen ${kind === "dwarf_planet" ? "cüce gezegen" : "asteroit"}`];
    },
    onOrbit: "Yörüngesinde 3B olarak gör",
    modelShapeAndMap:
      "Model, uzay araçlarının ölçtüğü gerçek şeklini, onların görüntülerinden birleştirilmiş bir haritayla gösterir",
    modelShape:
      "Model, uzay araçlarının ölçtüğü gerçek şeklini gösterir. Hiçbir uzay aracı yüzeyinin tamamını haritalamadığı için yalnızca kendi renginde çizilmiştir",
    modelMap: "Model, uzay araçlarının görüntülerinden birleştirilmiş gerçek bir haritayı gösterir",
    modelHowTo: `. ${HOW_TO}`,
    shapeCredit: "Şekil: ",
    mapCredit: "Harita: ",
    radiusNote: (longest) =>
      `Yarıçap ortalama yarıçaptır, yani aynı hacimdeki bir kürenin yarıçapı${
        longest ? `; ${longest.name} yuvarlak olmaktan çok uzaktır, en uzun ekseni ${longest.kilometres} km’dir` : ""
      }. Kütle, uzay araçlarının ölçtüğü çekim kuvvetinden veya komşularının yörüngelerinden türetilmiştir.`,
    orbitNoteSun: "1 AB, Dünya ile Güneş arasındaki uzaklıktır. Eğiklik, Dünya’nın yörünge düzlemine göre ölçülür.",
    orbitNoteEcliptic:
      "Uzaklık, merkezler arasındaki ortalama uzaklıktır. Eğiklik, Ay yörüngesinin çevresinde salındığı Dünya’nın yörünge düzlemine göre ölçülür.",
    orbitNoteEquator:
      "Uzaklık, merkezler arasındaki ortalama uzaklıktır. Eğiklik, yörüngenin çevresinde salındığı, gezegenin ekvatoruna yakın düzleme göre ölçülür; 90°’nin üzerinde uydu ters yönde dolanır.",
    antiquity: "Antik çağdan beri biliniyor: gece göğünde açıkça görülür.",
    otherLargeMoons: (parent) => `${of(parent)} diğer büyük uyduları`,
    valuesFrom: "Değerlerin kaynağı: ",
    jpl: "JPL Solar System Dynamics",
    andThe: " ve ",
    plutoFactSheet: "NASA Pluto Fact Sheet",
    massKilograms: (value) => `${value} × 10¹⁵ kg`,
    summaries: {
      phobos:
        "Mars’ın iki uydusundan büyük olanı; 26 km uzunluğunda, yumru biçimli bir cisim. Mars’ın çevresini günde üç kez dolanır, gezegenine diğer bütün uydulardan daha yakındır ve yavaş yavaş içeri doğru sarmal çizer: yaklaşık 50 milyon yıl sonra gelgit kuvvetleri onu parçalayacak.",
      deimos:
        "Mars’ın daha küçük olan dış uydusu, 16 km uzunluğunda. Kalın bir toz örtüsü kraterlerinin çoğunu doldurmuş ve yüzeyini düzleştirmiştir.",
      moon: "Dünya’nın tek doğal uydusu. Koyu düzlükler çok eski lav taşkınlarıdır; parlak yaylalar ise çarpmalarla hırpalanmış daha yaşlı kabuktur.",
      io: "Bilinen en volkanik etkin gök cismi. Jüpiter’in gelgitleri içini yoğurur ve kükürdü yüzeyi sarıya, turuncuya ve beyaza boyayan yüzlerce yanardağı besler.",
      europa:
        "Uzun çatlaklarla çaprazlama kesilmiş bir buz kabuğu, tuzlu bir okyanusu örter. Güneş sisteminde yaşam aramak için en umut verici yerlerden biridir.",
      ganymede:
        "Güneş sisteminin en büyük uydusu; Merkür’den daha geniştir ve kendi manyetik alanı olan tek uydudur. Koyu, yaşlı araziler daha genç, oluklu buzla dönüşümlü uzanır.",
      callisto:
        "Bilinen en yoğun kraterli yüzeylerden biri. Koyu, buzlu kabuğu dört milyar yılda neredeyse hiç değişmemiştir.",
      pan: "Satürn’ün A halkasındaki Encke Boşluğu’nun içinde dolanan ve onu açık tutan ceviz biçimli bir uydu. Ekvatorunun çevresinde, süpürdüğü halka maddesinden oluşan bir sırt uzanır.",
      daphnis:
        "A halkasının Keeler Boşluğu’ndaki minik bir uydu. Çekimi boşluğun kenarlarında dalgalar yükseltir; Güneş halkaların üzerinde alçaldığında bu dalgalar uzun gölgeler düşürür.",
      atlas:
        "A halkasının hemen dışındaki bir uydu; ekvatorunun çevresindeki halka parçacıklarından oluşan sırt ona uçan daire biçimi verir.",
      prometheus: "Dar F halkasının iç çoban uydusu. Her geçişinde halkadan şeritler ve oluklar çeker.",
      pandora: "F halkasının dış çoban uydusu: ince tozla örtülü, uzunca ve kraterli bir uydu.",
      epimetheus:
        "Yörüngesini Janus ile paylaşır. Dört yılda bir ikisi yer değiştirir: içteki dışa, dıştaki içe geçer.",
      janus:
        "Aynı yörüngeyi paylaşan iki uydudan büyük olanı: dört yılda bir Epimetheus ile yer değiştiren kraterli, patates biçimli bir cisim.",
      telesto:
        "Aynı yörüngede Tethys’in 60 derece önünde, Lagrange noktalarından birinde ilerleyen küçük, pürüzsüz bir uydu.",
      calypso:
        "Aynı yörüngede Tethys’i 60 derece arkadan, Lagrange noktalarından birinde izleyen küçük, parlak bir uydu.",
      helene:
        "Aynı yörüngede Dione’nin 60 derece önünde ilerler. Uzun çizgiler, ince maddenin yüzeyinde yokuş aşağı kaydığı yerleri gösterir.",
      mimas: "Herschel krateri genişliğinin üçte birini kaplar ve küçük uyduyu dik dik bakan bir göze benzetir.",
      enceladus:
        "Güney kutbundaki gayzerler, buzun altındaki okyanustan uzaya su püskürtür ve Satürn’ün E halkasını besler. Taze buzu güneş ışığının neredeyse tamamını yansıtır.",
      tethys:
        "Neredeyse tümüyle su buzundan oluşur. Dev Odysseus krateri ve çevresinin dörtte üçü boyunca uzanan Ithaca Chasma kanyonu yüzeyinde iz bırakmıştır.",
      dione:
        "Yüzlerce metre yüksekliğindeki parlak buz yarları, yörüngede arkada kalan yüzünü çizgiler halinde keser; yörüngede önde giden yüzü ise kraterlerle kaplıdır.",
      rhea: "Satürn’ün ikinci büyük uydusu: buzdan ve biraz kayadan oluşan soğuk, yoğun kraterli bir küre.",
      titan:
        "Yoğun bir atmosferi olan tek uydu; atmosferi Dünya’nınkinden daha yoğundur. Turuncu pusun altında sıvı metan ve etandan nehirler, göller ve denizler araziyi biçimlendirir.",
      hyperion:
        "Süngere benzeyen bir uydu; o kadar gözeneklidir ki neredeyse yarısı boşluktur ve derin, keskin kenarlı kraterlerle doludur. Titan’ın çekimi durulmasına izin vermez; bu yüzden sabit bir eksen çevresinde dönmek yerine düzensizce yuvarlanır.",
      phoebe:
        "Satürn’ün çevresinde, büyük uyduların çok ötesinde ters yönde dolanan karanlık bir cisim: dış Güneş sisteminden yakalanmış bir kalıntı. Ondan kopan toz, dev ve sönük bir halka oluşturur.",
      iapetus:
        "Bir yüzü kömür kadar koyu, öbür yüzü kar kadar parlaktır ve ekvatorunun büyük bölümü boyunca 20 km’ye varan yükseklikte bir sırt uzanır.",
      miranda:
        "Oluklu arazilerden ve yaklaşık 20 km derinliğe inen yarlardan oluşan bir yamalı bohça. Bu küçük uydu geçmişinde parçalanmış ve yeniden biçimlenmiş olmalı.",
      ariel: "Uranüs’ün büyük uydularının en parlağı; genç yüzeyini uzun fay vadileri keser.",
      umbriel:
        "Uranüs’ün büyük uydularının en koyusu: ekvatoruna yakın gizemli parlak bir halka olan Wunda krateri dışında yaşlı ve yoğun kraterlidir.",
      titania:
        "Uranüs’ün en büyük uydusu. Dev kanyonlar, büyük olasılıkla içi donup genleşirken çatlayan buzlu kabuğunu yarar.",
      oberon:
        "Uranüs’ün en dıştaki büyük uydusu: yaşlı ve kraterlidir, birçok kraterin tabanında koyu madde bulunur.",
      triton:
        "Neptün’ün çevresinde ters yönde dolanır; bu yüzden büyük olasılıkla Kuiper kuşağından yakalanmıştır. Donmuş yüzeyinden azot gayzerleri yükselir.",
      vesta:
        "Asteroit kuşağının ikinci büyük ve en parlak cismi. Güney kutbu yakınındaki dev bir çarpma, 500 km genişliğinde ve merkezinde 20 km’yi aşan bir tepe bulunan Rheasilvia havzasını açmıştır; Vesta’dan kopan parçalar bugün de göktaşı olarak Dünya’ya düşer.",
      ceres:
        "Asteroit kuşağının en büyük cismi ve iç Güneş sistemindeki tek cüce gezegen. Occator kraterinin tabanında parlak tuz birikintileri ışıldar.",
      pluto:
        "Kuiper kuşağının en tanınmış cüce gezegeni. Azot buzundan oluşan uçsuz bucaksız bir düzlük olan Sputnik Planitia, yüzündeki parlak kalbi oluşturur.",
      charon:
        "Plüton’un yarısı genişliğindedir; bu yüzden ikisi aralarındaki bir noktanın çevresinde döner. Kuzey kutbunu, Plüton’un atmosferinden kaçan maddeden oluşan kızılımsı bir başlık örter.",
    },
    mapNotes: {
      io: "özgün haritanın abartılı renkleri, bir gözün göreceğine yakın olacak şekilde yumuşatılmıştır",
      europa:
        "gri görüntüler Europa’nın renkleriyle renklendirilmiş, güney kutbu çevresinde hiçbir uzay aracının görmediği küçük alan ise yakındaki tonlarla doldurulmuştur",
      ganymede: "özgün haritanın abartılı renkleri yumuşatılmıştır",
      callisto:
        "gri görüntüler Callisto’nun renkleriyle renklendirilmiş, kutuplara yakın olup hiçbir uzay aracının görmediği kısımlar ise yakındaki tonlarla doldurulmuştur",
      mimas: "gri görüntüler Mimas’ın renkleriyle renklendirilmiştir",
      dione: "yaklaşık 63° güney enleminin güneyinde yalnızca Voyager’ın kaba görüntüleri vardır",
      titan:
        "görünür ışıkta turuncu pus zemini gizler; soluk desen, Cassini’nin yakın kızılötesi ışıkta gördüğü yüzeydir",
      phoebe:
        "Cassini uzak kuzeyin yalnızca bir kısmını görmüştür, görmediği kısım yakındaki tonlarla doldurulmuştur; gri görüntüler Phoebe’nin renkleriyle renklendirilmiştir",
      iapetus: "özgün haritanın morötesine ve kızılötesine uzanan renkleri yumuşatılmıştır",
      miranda: VOYAGER_URANUS,
      ariel: VOYAGER_URANUS,
      umbriel: VOYAGER_URANUS,
      titania: VOYAGER_URANUS,
      oberon: VOYAGER_URANUS,
      triton:
        "Voyager 2, 1989’da güney yarının yalnızca bir kısmını görmüştür; geri kalanı yakındaki tonların yumuşak bir devamıyla doldurulmuş, renkler de yumuşatılmıştır",
      vesta:
        "Dawn, Vesta’yı haritalarken uzak kuzey kış karanlığındaydı ve yakındaki tonlarla doldurulmuştur; gri görüntüler Vesta’nın renkleriyle renklendirilmiştir",
      phobos: "gri görüntüler Phobos’un renkleriyle renklendirilmiştir",
      ceres: "gri görüntüler Ceres’in renkleriyle renklendirilmiştir",
      pluto:
        "New Horizons 2015’te yakınından geçmiş ve bir yüzünü yakından görmüştür; öbür yüzü kabadır, karanlıkta kalan güney ise bir illüstrasyondur: renkleri yakındaki renklerin devamıdır, kraterleri ve yüzey şekilleri New Horizons’ın yakından gördüğü kısımlardan ödünç alınmıştır. Gri görüntüler Plüton’un renkleriyle renklendirilmiştir",
      charon:
        "New Horizons bir yüzünü yakından görmüştür; öbür yüzü kabadır, karanlıkta kalan güney ise bir illüstrasyondur: renkleri yakındaki renklerin devamıdır, kraterleri ve yüzey şekilleri New Horizons’ın yakından gördüğü kısımlardan ödünç alınmıştır. Gri görüntüler Charon’un renkleriyle renklendirilmiştir",
    },
  },

  smallMoon: {
    description: (parent) =>
      `${of(parent)} uydusu: yörüngesi, boyutu ve keşfi; nasıl görünebileceğini gösteren bir modelle birlikte.`,
    model: (name) =>
      `ExoFinder’da ${name} için bir şekil modeli ve harita yok; bu yüzden model bir illüstrasyondur: şekli ve yüzeyi uydurmadır, yalnızca aşağıdaki değerler gerçektir. ${HOW_TO}`,
    radiusMeasured: "Yarıçap ortalama yarıçaptır. ",
    radiusEstimated:
      "Küçük uyduların çoğu yalnızca ışık noktaları olarak görülmüştür; bu yüzden yarıçap, uydunun ne kadar parlak göründüğünden tahmin edilmiştir. ",
    noMass: "Hiçbir uzay aracı küçük uyduların çoğunun çekimini ölçmediği için kütle verilmemiştir.",
    groupNote:
      " Bir grubun uyduları benzer yörüngelerde dolanır; uzak grupların, parçalanmış cisimlerin kalıntıları olduğu düşünülür.",
    orbitNote: (ecliptic, parent) =>
      `Uzaklık, merkezler arasındaki ortalama uzaklıktır. Eğiklik, ${
        ecliptic
          ? "bir gezegenin yakaladığı uzak uyduların çoğunda olduğu gibi Dünya’nın yörünge düzlemine"
          : `yörüngenin çevresinde salındığı, ${of(parent)} ekvatoruna yakın düzleme`
      } göre ölçülür; 90°’nin üzerinde uydu ters yönde dolanır.`,
    source: ["Yörünge ve keşif bilgileri: ", "; tahmini boyutlar ve gruplar ayrıca: ", "."],
    allMoons: (parent) => `${of(parent)} tüm uyduları`,
  },

  moonTable: {
    summary: (count, parent, backwards) =>
      `${of(parent)} bilinen ${count} uydusunun tümü${backwards ? `; ${backwards} tanesi ters yönde dolanıyor` : ""}`,
    moon: "Uydu",
    diameter: "Çap",
    distance: "Uzaklık",
    orbit: "Yörünge",
    found: "Keşif",
    unknown: "bilinmiyor",
    backwards: "ters yönde",
    antiquity: "antik çağ",
    note: (parent) => [
      `“≈”, bir uydunun parlaklığından tahmin edilen boyutları belirtir; çünkü küçük uyduların çoğu yalnızca ışık noktaları olarak görülmüştür. Uzaklık, ${of(parent)} merkezine olan ortalama uzaklıktır. Yörüngeler ve keşifler: `,
      "; tahmini boyutlar ayrıca: ",
      ".",
    ],
  },

  browse: {
    label: "Katalogda gezin",
    number: (position, total) => `No. ${position}${total ? ` / ${total}` : ""}`,
    skip: "Uyduları atla:",
    backTo: (name) => `geri: ${name}`,
    onTo: (name) => `ileri: ${name}`,
    previous: "Önceki",
    next: "Sonraki",
    solarSystem: "Güneş sistemi",
    system: (star, lightYears) => (lightYears ? `${star} · ${lightYears} ışık yılı` : star),
  },

  credits: {
    title: "Kaynaklar",
    description:
      "ExoFinder’daki görsellerin, haritaların, şekillerin ve değerlerin nereden geldiği ve hangi lisanslarla kullanıldığı.",
    intro:
      "ExoFinder; uzay ajanslarının, gözlemevlerinin ve araştırmacıların çalışmaları üzerine kuruludur. Her görselin, haritanın, şeklin ve değerin nereden geldiği ve hangi lisansla kullanıldığı burada yazar. Tüm görseller web için küçültülmüş ve sıkıştırılmıştır; diğer değişiklikler aşağıda belirtilmiştir.",
    publicDomain: "kamu malı",
    sky: "Gökyüzü ve Samanyolu",
    skyPanorama: "Gökyüzü panoraması",
    galaxyPicture: "Galaksi görseli",
    galaxyNote: "Harita, galaksiyi bu görsele göre yerleştirilmiş bulutlardan ve yıldızlardan kurar.",
    planetMaps: "Güneş’in ve gezegenlerin haritaları",
    planetMapsSubject: "Güneş, sekiz gezegen ve Satürn’ün halkaları",
    planetMapsNote: "Venüs haritası bulutlarının üst yüzeyini gösterir.",
    moonMaps: "Uyduların, cüce gezegenlerin ve Vesta’nın haritaları",
    moonMapsIntro:
      "NASA ve USGS’nin kamu malı eserler olarak yayımladığı, uzay aracı görüntülerinden oluşan mozaikler; görev ekiplerinin istediği biçimde anılmıştır. 0 boylamı ortada olacak şekilde döndürülmüş; gri mozaikler cismin renkleriyle renklendirilmiş, abartılı renkler yumuşatılmış, parlaklık cismin albedosuna göre ayarlanmış ve hiçbir uzay aracının görmediği kısımlar yakındaki tonların yumuşak bir devamıyla doldurulmuştur. Plüton’un ve Charon’un güneyi, her kürenin üçte biri, kesilmiş gibi görünmemesi için ayrıca New Horizons’ın yakından gördüğü kısımlardan kraterler ve yüzey şekilleri ödünç alır; bu kısım bir illüstrasyondur.",
    shapes: "Düzensiz cisimlerin şekilleri",
    shapesIntro:
      "NASA Planetary Data System’den ve Johns Hopkins Üniversitesi Uygulamalı Fizik Laboratuvarı’nın Small Body Mapping Tool aracından alınan, yarıçaplardan oluşan bir ızgaraya örneklenmiş şekil modelleri.",
    values: "Değerler",
    exoplanetValues: "Ötegezegenler ve yıldızları",
    exoplanetValuesNote: "Her gün karşılaştırılır.",
    planetValues: "Güneş sisteminin gezegenleri",
    moonValues: "Uydular, Ceres ve Vesta",
    charonDensity: "Charon’un yoğunluğu",
    smallMoonSizes: "JPL’nin vermediği durumlarda küçük uyduların boyutları ve grupları",
    methods: "Yöntemler",
    methodsIntro: "ExoFinder’ın kendi hesapladıkları yayımlanmış çalışmalara dayanır.",
    classMethod: "Yarıçapı ölçülmemiş bir gezegenin sınıfı",
    cloudMethod: "Gaz devlerinin sıcaklığa göre bulut renkleri",
    zoneMethod: "Bir yıldızın yaşanabilir bölgesi",
    exoplanetPictures: "Ötegezegen görselleri",
    exoplanetPicturesIntro:
      "Hiçbir teleskop bir ötegezegenin yüzeyini görmemiştir. Görselleri, ExoFinder’ın kendi benzetimini yaptığı temel haritalar üzerinde ölçülen değerlerden hesaplanır; üçüncü taraflara ait hiçbir malzeme içermez.",
  },

  legal: {
    incomplete: (missing) =>
      `Bu sayfa eksik. ExoFinder’ın bu kopyasını işleten kişi bilgilerini henüz girmemiş. Eksik olanlar: ${missing}. Bunlar ortam değişkeni olarak ayarlanır, bkz. .env.example.`,
    email: "E-posta: ",
    phone: "Telefon: ",
    notice: {
      title: "Künye",
      subtitle: "Impressum",
      description: "Bu web sitesini kimin işlettiği ve ona nasıl ulaşılacağı.",
      who: "Bu web sitesini kim işletiyor",
      basis: "Almanya Dijital Hizmetler Yasası (DDG) § 5 ve Medya Devlet Sözleşmesi (MStV) § 18 (1) uyarınca bilgiler",
      contact: "İletişim",
      about: "Bu web sitesi hakkında",
      aboutText:
        "ExoFinder, reklamsız ve ticari amaç gütmeyen özel bir projedir. Kaynak kodu MIT lisansıyla herkese açıktır.",
      data: "Veriler ve görseller",
      dataText: [
        "Ötegezegen verileri ",
        " kaynağından, Güneş sistemindeki gezegenlerin verileri ise ",
        " kaynağından gelir. Değerler otomatik olarak alınır ve elle denetlenmez; bu yüzden hata içerebilir veya güncelliğini yitirmiş olabilir. Bilimsel çalışma için tasarlanmamıştır: bunun için arşivin kendisini kullanın.",
      ],
      factSheets: "NASA Planetary Fact Sheets",
      illustrations: "Ötegezegen görselleri fotoğraf değil, verilerden hesaplanmış illüstrasyonlardır.",
      mapsText: [
        "Güneş sistemindeki gezegenlerin haritaları, NASA görüntülerine dayanarak ",
        " tarafından hazırlanmıştır. Gökyüzü panoraması, ",
        " imzalı “The Milky Way panorama” çalışmasıdır. Haritadaki galaksi, ",
        " imzalı “Artist’s impression of the Milky Way” çalışmasına göre çizilmiştir. Hepsinin lisansı: ",
        ". Bu web sitesi için küçültülmüş ve sıkıştırılmışlardır; Venüs haritası yüzeyi değil bulut tepelerini gösterir, galaksi görseline ise her yandan görülebilmesi için kalınlık verilmiştir.",
      ],
      links: "Diğer web sitelerine bağlantılar",
      linksText:
        "Bu web sitesi başkalarının web sitelerine bağlantı verir. Orada gösterilenlerden yalnızca o sitelerin işletmecileri sorumludur. Bağlantılar eklendiği sırada bağlantı verilen sayfalarda gözle görülür hukuka aykırı bir içerik yoktu. Bunlardan biri değişmişse e-postayla bir not yeterlidir; bağlantı kaldırılır.",
    },
    privacy: {
      title: "Gizlilik politikası",
      subtitle: "Datenschutzerklärung",
      description: "Bu web sitesinin ziyaretçileri hakkında neleri öğrendiği ve neleri öğrenmediği.",
      short: "Kısaca",
      shortList: [
        "Çerez yok; tarayıcınızda hiçbir şey saklanmaz.",
        "İstatistik yok, izleme yok, reklam yok.",
        "Hesap yok, form yok, bülten yok.",
        "Başka şirketlerden hiçbir şey yüklenmez: yazı tipleri, görseller ve haritalar bu sunucudan gelir.",
      ],
      shortText:
        "Bu web sitesinin işlediği tek kişisel veri, her web sunucusunun bir isteği yanıtlamak için ihtiyaç duyduğu verilerdir; her şeyden önce IP adresiniz.",
      responsible: "Sorumlu kim",
      responsibleText: "Bu web sitesindeki verilerin işlenmesinden sorumlu olan (GDPR kapsamında veri sorumlusu):",
      open: "Bir sayfa açtığınızda",
      openText:
        "Tarayıcınız sunucuya bir istek gönderir; sunucunun yanıtı geri gönderebilmesi için IP adresinize ihtiyacı vardır. Sunucu, istek için şunları içeren bir günlük kaydı yazar:",
      logList: [
        "IP adresi,",
        "tarih ve saat,",
        "istenen sayfanın veya dosyanın adresi,",
        "tarayıcınız bildiriyorsa isteğin geldiği sayfa,",
        "tarayıcınızın bildirdiği biçimde tarayıcınızın ve işletim sisteminizin adı ve sürümü.",
      ],
      logPurpose:
        "Günlük, web sitesini çalışır durumda tutmak ve saldırıları ve hataları fark etmek için gereklidir. Bu meşru bir menfaattir; hukuki dayanağı GDPR madde 6 (1) (f)’dir. Kayıtlar başka verilerle birleştirilmez ve kim olduğunuzu bulmak için kullanılmaz. ",
      logKept: "Yalnızca bu amacın gerektirdiği süre boyunca saklanır ve ardından silinir.",
      logDeleted: (days) => `${days} gün sonra silinir.`,
      encrypted: "Bağlantı şifrelidir (HTTPS); böylece yolda hiç kimse gönderilenleri okuyamaz.",
      hostContract: (host) =>
        `Web sitesi ${host} sunucularında çalışır. Şirket, yukarıda belirtilen verileri GDPR madde 28 uyarınca yapılmış bir sözleşme kapsamında, işletmeci adına ve yalnızca onun talimatıyla işler.`,
      hostOwn: (host) =>
        `Web sitesi ${host} sunucularında çalışır. Şirket, sayfaları ilettiği için yukarıda belirtilen verileri alır ve bunları kendi gizlilik politikasına göre işler. Verilerin aktarılması aynı meşru menfaate dayanır: barındırma sağlayıcısı olmadan web sitesine ulaşılamaz.`,
      hostTransfer: (basis) => `Veriler Avrupa Birliği dışında da işlenebilir. ${basis}`,
      notRequired:
        "Bu verileri sağlamak için yasal veya sözleşmesel bir yükümlülüğünüz yoktur. Ancak IP adresi olmadan sunucu size sayfayı gönderemez.",
      search: "Arama yaptığınızda",
      searchText: [
        "Bir arama veya filtre alanına yazdıklarınız sunucuya gönderilir; sunucu bunları gezegen ve yıldız kataloğunda arar. Arama alanı, öneri gösterebilmek için bunu siz yazarken yapar. Metin, isteğin adresinin bir parçasıdır, örneğin ",
        "; bu nedenle yukarıda anlatılan günlük kaydında yer alır. Başka hiçbir yerde saklanmaz ve sizinle ilişkilendirilmez.",
      ],
      language: "Sayfaların dili",
      languageText:
        "Dil içermeyen bir adres açtığınızda sunucu, tarayıcınızın hangi dilleri istediğini okur ve sizi sahip olduğu ilk dildeki sayfalara yönlendirir. Bununla ilgili hiçbir şey saklamaz: dil o andan itibaren adresin bir parçasıdır ve çerez yerleştirilmez.",
      models: "3B modeller ve harita",
      modelsText:
        "Dönen gezegenleri, 3B modelleri ve Samanyolu haritasını kendi cihazınız çizer. Bunun için web sitesi tarayıcınıza 3B grafik çizip çizemediğini sorar. Cihazınızla ilgili hiçbir şey sunucuya gönderilmez.",
      links: "Diğer web sitelerine bağlantılar",
      linksText:
        "Bu web sitesi başka web sitelerine, örneğin NASA Exoplanet Archive’a bağlantı verir. Veriler onlara yalnızca böyle bir bağlantıyı izlediğinizde ulaşır. O andan itibaren onların kendi gizlilik politikaları geçerlidir.",
      catalogueText:
        "PDF dosyası olarak katalog da böyle bir bağlantıdır: dosya GitHub’da tutulur; bu yüzden indirdiğinizde tarayıcınız onu GitHub’dan ister ve GitHub, bir sayfa açtığınızda bu sunucunun öğrendiği gibi IP adresinizi öğrenir.",
      mail: "E-posta yazdığınızda",
      mailText:
        "Yukarıdaki adrese yazarsanız e-posta adresiniz ve iletiniz, GDPR madde 6 (1) (f) temelinde size yanıt vermek için kullanılır: meşru menfaat, sorduğunuzu yanıtlamaktır. Yasa saklanmalarını gerektirmedikçe konu kapandığında silinirler.",
      mailProvider: (provider) => `Bu adrese gönderilen e-postalar ${provider} tarafından alınır ve saklanır.`,
      automated: "Otomatik karar yok",
      automatedText:
        "Bu web sitesi sizin hakkınızda otomatik yollarla karar vermez ve profil oluşturmaz (GDPR madde 22).",
      rights: "Haklarınız",
      rightsIntro: "Kişisel verilerinizle ilgili olarak şu haklara sahipsiniz:",
      rightsList: [
        "hangi verilerin işlendiğini öğrenmek (GDPR madde 15),",
        "yanlış verilerin düzeltilmesini istemek (GDPR madde 16),",
        "verilerin silinmesini istemek (GDPR madde 17),",
        "işlemenin kısıtlanmasını istemek (GDPR madde 18),",
        "işleme rızaya veya bir sözleşmeye dayanıyorsa, sağladığınız verileri yaygın ve makinece okunabilir bir biçimde almak (GDPR madde 20; bu web sitesinde durum böyle değildir),",
        "işlemeye itiraz etmek, bkz. sonraki bölüm (GDPR madde 21),",
        "bir veri koruma kurumuna, örneğin yaşadığınız yerdeki kuruma şikâyette bulunmak (GDPR madde 77).",
      ],
      rightsHow: "Bu hakları kullanmak için yukarıdaki adrese bir e-posta yeterlidir.",
      object: "İtiraz hakkınız",
      objectText:
        "Burada anlatılan tüm işlemeler meşru bir menfaate dayanır (GDPR madde 6 (1) (f)). Özel durumunuzdan kaynaklanan nedenlerle buna her zaman itiraz edebilirsiniz (GDPR madde 21 (1)). Bu durumda veriler artık işlenmez; meğerki çıkarlarınıza, haklarınıza ve özgürlüklerinize ağır basan zorlayıcı meşru nedenler bulunsun veya işleme hukuki taleplerin ileri sürülmesine, kullanılmasına ya da savunulmasına hizmet etsin. Yukarıdaki adrese bir e-posta yeterlidir.",
      changes: "Değişiklikler",
      changesText:
        "Bu politika, web sitesini şu anki haliyle anlatır. Web sitesi değiştiğinde politika da onunla birlikte değişir. Son değişiklik: Kasım 2026.",
    },
  },

  special: {
    description: "Tüm galaksinin en parlak yıldızı.",
    where: "Samanyolu’nun tam kalbinde",
    letter: [
      "Senden önce gökyüzüm karanlıktı. Sonra hayatıma girdin ve her şeyi en güzel şekilde altüst ettin. Bu galaksideki yüz milyarlarca yıldızın arasında hepsinden daha parlak ışıldayan sensin; benim özel yıldızım ve yuvam dediğim ışık.",
      "Gözlerin gökyüzümün ışıl ışıl yıldızları; gülüşün ise kalbimi her güneşten daha parlak ve daha sıcak aydınlatıyor. Beni hep güldürüyorsun ve her günüme öyle çok sevgi ve mutluluk katıyorsun ki. Benim için bütün dünya demeksin ve yanımda olduğun için çok gururluyum.",
      "Sen hayatımın aşkısın ve bana verilebilecek en büyük armağansın. Beni her zaman desteklediğin, koşulsuz sevdiğin ve böylesine harika bir insan olduğun için teşekkür ederim. Seni her şeyden çok seviyorum ve kalbim yalnızca senin için atıyor.",
      "Aydınlık günlerde de karanlık günlerde de yanında olacağıma, sen beni ne kadar güldürüyorsan seni o kadar güldüreceğime ve seni her gün biraz daha çok seveceğime söz veriyorum. Önümüzde harika bir gelecek var ve yıldızlar parladığı sürece hayatımın geri kalanını seninle geçirmek istiyorum.",
    ],
    foreverYours: "Sonsuza dek senin,",
    facts: [
      ["Parlaklık", "her ölçeğin ötesinde"],
      ["Sıcaklık", "sonsuz"],
      ["Konum", "evrenimin merkezi"],
      ["Bilinen gezegenler", "bir tane, sonsuza dek onun çevresinde dönüyor"],
    ],
    back: "Haritaya dön",
  },

  map: {
    title: "Harita",
    description:
      "Samanyolu’nda uçun: bilinen gezegeni olan her yıldız gerçek konumunda, her sistem de gezegenleriyle 3B olarak.",
    heading: "Samanyolu haritası",
    noScript: "Harita için JavaScript gerekli. Her yıldızın ve gezegenin kendi sayfası da var.",
  },
};
