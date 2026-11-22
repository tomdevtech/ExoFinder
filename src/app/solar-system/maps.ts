/**
 * Where the maps of the moons and dwarf planets come from. `npm run textures` downloads `download` and
 * prepares it (scripts/moon-maps.ts); the body's page shows the credit and the note.
 */
export interface MapSource {
  download: string;
  /** Who made the map, as the publisher asks to be credited. */
  credit: string;
  /** The page that describes the map. */
  url: string;
  licence: string;
  /** What the map does not show as it is, for example parts no spacecraft saw. */
  note: string | null;
  /** The part of the download that is the map, in pixels, where the publisher framed it with a title and labels. */
  crop?: { left: number; top: number; width: number; height: number };
}

const USGS = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/";
const PHOTOJOURNAL = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/";
const USGS_PAGE = "https://astrogeology.usgs.gov/search/map/";
const PUBLIC = "public domain";

const VOYAGER_URANUS =
  "Voyager 2 saw only the southern half when it flew past in 1986; the north is filled with a smooth continuation of the nearby tones";

export const MAP_SOURCES: Record<string, MapSource> = {
  moon: {
    download: "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg",
    credit: "NASA's Scientific Visualization Studio, from LRO camera images",
    url: "https://svs.gsfc.nasa.gov/4720",
    licence: PUBLIC,
    note: null,
  },
  io: {
    download: `${USGS}Io_Galileo_SSI_Global_Mosaic_ClrMerge_1km.tif`,
    credit: "NASA/JPL/USGS, Galileo",
    url: `${USGS_PAGE}io_galileo_ssi_global_color_merge_mosaic_1km`,
    licence: PUBLIC,
    note: "the enhanced colours of the original are toned down towards what an eye would see",
  },
  europa: {
    download: `${USGS}Europa_Voyager_GalileoSSI_global_mosaic_500m.tif`,
    credit: "NASA/JPL/USGS, Voyager and Galileo",
    url: `${USGS_PAGE}europa_voyager_galileo_ssi_global_mosaic_500m`,
    licence: PUBLIC,
    note: "the grey images are tinted with Europa's colours, and the small area round the south pole that no spacecraft saw is filled with the nearby tones",
  },
  ganymede: {
    download: `${USGS}Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif`,
    credit: "NASA/JPL/USGS, Voyager and Galileo",
    url: `${USGS_PAGE}ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km`,
    licence: PUBLIC,
    note: "the enhanced colours of the original are toned down",
  },
  callisto: {
    download: `${USGS}Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif`,
    credit: "NASA/JPL/USGS, Voyager and Galileo",
    url: `${USGS_PAGE}callisto_galileo_voyager_global_mosaic_1km`,
    licence: PUBLIC,
    note: "the grey images are tinted with Callisto's colours, and the parts near the poles that no spacecraft saw are filled with the nearby tones",
  },
  mimas: {
    download: `${PHOTOJOURNAL}pia17/pia17214/PIA17214.jpg`,
    credit: "NASA/JPL-Caltech/Space Science Institute, Cassini",
    url: "https://science.nasa.gov/photojournal/mimas-global-map-june-2017/",
    licence: PUBLIC,
    note: "the grey images are tinted with Mimas' colours",
  },
  enceladus: {
    download: `${USGS}Enceladus_Cassini_mosaic_global_110m.tif`,
    credit: "NASA/JPL-Caltech/Space Science Institute/USGS, Cassini",
    url: `${USGS_PAGE}enceladus_cassini_global_mosaic_110m`,
    licence: PUBLIC,
    note: null,
  },
  tethys: {
    download: `${USGS}Tethys_Cassini_mosaic_global_293m.tif`,
    credit: "NASA/JPL-Caltech/Space Science Institute/DLR, Cassini",
    url: `${USGS_PAGE}tethys_cassini_global_mosaic_293m`,
    licence: PUBLIC,
    note: null,
  },
  dione: {
    download: `${USGS}Dione_Cassini_Voyager_mosaic_global_154m.tif`,
    credit: "NASA/JPL-Caltech/Space Science Institute, Cassini and Voyager",
    url: `${USGS_PAGE}dione_cassini_voyager_global_mosaic_154m`,
    licence: PUBLIC,
    note: "south of about 63° S only Voyager's coarse images exist",
  },
  rhea: {
    download: `${USGS}Rhea_Cassini_Voyager_mosaic_global_417m.tif`,
    credit: "NASA/JPL-Caltech/Space Science Institute/DLR, Cassini and Voyager",
    url: `${USGS_PAGE}rhea_cassini_voyager_global_mosaic_417m`,
    licence: PUBLIC,
    note: null,
  },
  titan: {
    download: `${USGS}Titan_ISS_P19658_Mosaic_Global_4km.tif`,
    credit: "NASA/JPL-Caltech/Space Science Institute, Cassini",
    url: `${USGS_PAGE}titan_cassini_iss_global_mosaic_4005m`,
    licence: PUBLIC,
    note: "in visible light the orange haze hides the ground; the faint pattern is the surface as Cassini saw it in near-infrared light",
  },
  phoebe: {
    download: `${PHOTOJOURNAL}pia07/pia07775/PIA07775.tif`,
    credit: "NASA/JPL/Space Science Institute, Cassini",
    url: "https://science.nasa.gov/photojournal/map-of-phoebe-december-2005/",
    licence: PUBLIC,
    note: "Cassini saw the far north only in part, and that part is filled with the nearby tones; the grey images are tinted with Phoebe's colours",
    // The published map has a title, a frame and labelled axes round 8 pixels per degree of map.
    crop: { left: 189, top: 184, width: 2880, height: 1440 },
  },
  iapetus: {
    download: `${PHOTOJOURNAL}pia18/pia18436/PIA18436.jpg`,
    credit: "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute, Cassini",
    url: "https://science.nasa.gov/photojournal/color-maps-of-iapetus-2014/",
    licence: PUBLIC,
    note: "the colours of the original, which reach into ultraviolet and infrared, are toned down",
  },
  miranda: {
    download: "https://space.jpl.nasa.gov/tmaps/pix/ura5vuu2.jpg",
    credit: "NASA/JPL-Caltech/USGS, Voyager 2",
    url: "https://space.jpl.nasa.gov/tmaps/uranus.html",
    licence: PUBLIC,
    note: VOYAGER_URANUS,
  },
  ariel: {
    download: "https://space.jpl.nasa.gov/tmaps/pix/ura1vuu2.jpg",
    credit: "NASA/JPL-Caltech/USGS, Voyager 2",
    url: "https://space.jpl.nasa.gov/tmaps/uranus.html",
    licence: PUBLIC,
    note: VOYAGER_URANUS,
  },
  umbriel: {
    download: "https://space.jpl.nasa.gov/tmaps/pix/ura2vuu2.jpg",
    credit: "NASA/JPL-Caltech/USGS, Voyager 2",
    url: "https://space.jpl.nasa.gov/tmaps/uranus.html",
    licence: PUBLIC,
    note: VOYAGER_URANUS,
  },
  titania: {
    download: "https://space.jpl.nasa.gov/tmaps/pix/ura3vuu2.jpg",
    credit: "NASA/JPL-Caltech/USGS, Voyager 2",
    url: "https://space.jpl.nasa.gov/tmaps/uranus.html",
    licence: PUBLIC,
    note: VOYAGER_URANUS,
  },
  oberon: {
    download: "https://space.jpl.nasa.gov/tmaps/pix/ura4vuu2.jpg",
    credit: "NASA/JPL-Caltech/USGS, Voyager 2",
    url: "https://space.jpl.nasa.gov/tmaps/uranus.html",
    licence: PUBLIC,
    note: VOYAGER_URANUS,
  },
  triton: {
    download: `${USGS}Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif`,
    credit: "NASA/JPL/USGS/Lunar and Planetary Institute (P. Schenk), Voyager 2",
    url: `${USGS_PAGE}triton_voyager_2_global_color_mosaic_600m`,
    licence: PUBLIC,
    note: "Voyager 2 saw only part of the southern half in 1989; the rest is filled with a smooth continuation of the nearby tones, and the colours are toned down",
  },
  vesta: {
    download: `${USGS}Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif`,
    credit: "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA/USGS, Dawn",
    url: `${USGS_PAGE}vesta_dawn_fc_hamo_global_mosaic_60m`,
    licence: PUBLIC,
    note: "the far north was in winter darkness while Dawn mapped Vesta and is filled with the nearby tones, and the grey images are tinted with Vesta's colours",
  },
  phobos: {
    download: `${USGS}Phobos_ME_SRC_Mosaic_Global_16ppd.tif`,
    credit: "ESA/DLR/FU Berlin/NASA/USGS, Mars Express and Viking",
    url: "https://astrogeology.usgs.gov/search/map/phobos_mars_express_src_global_mosaic_16ppd",
    licence: PUBLIC,
    note: "the grey images are tinted with Phobos' colours",
  },
  ceres: {
    download: "https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps/asteroid_belt/Ceres/Ceres_Dawn_FC_DLR_global_8ppd.png",
    credit: "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA, Dawn",
    url: `${USGS_PAGE}ceres_dawn_fc_global_mosaic_400m`,
    licence: PUBLIC,
    note: "the grey images are tinted with Ceres' colours",
  },
  pluto: {
    download: `${USGS}Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif`,
    credit: "NASA/Johns Hopkins APL/Southwest Research Institute/USGS, New Horizons",
    url: `${USGS_PAGE}pluto_new_horizons_lorri_mvic_global_mosaic_300m`,
    licence: PUBLIC,
    note: "New Horizons flew past in 2015 and saw one side closely; the far side is coarse, and the south, which was in darkness, is an illustration: its colours continue the nearby ones, and its craters and relief are borrowed from the parts New Horizons saw closely. The grey images are tinted with Pluto's colours",
  },
  charon: {
    download: `${USGS}Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif`,
    credit: "NASA/Johns Hopkins APL/Southwest Research Institute/USGS, New Horizons",
    url: `${USGS_PAGE}charon_new_horizons_lorri_mvic_global_mosaic_300m`,
    licence: PUBLIC,
    note: "New Horizons saw one side closely; the far side is coarse, and the south, which was in darkness, is an illustration: its colours continue the nearby ones, and its craters and relief are borrowed from the parts New Horizons saw closely. The grey images are tinted with Charon's colours",
  },
};
