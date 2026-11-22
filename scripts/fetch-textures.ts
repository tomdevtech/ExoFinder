/**
 * Downloads planet, moon, Milky Way and galaxy textures and stores scaled copies in public/textures.
 *
 *   npm run textures
 *
 * TEXTURES_ONLY=planets (or rings, moons, sun, sky; several with commas) limits a run to some groups, so
 * the planets can be renewed without fetching the moon mosaics.
 *
 * The output is checked in, so this only needs to run when a size or source changes. The downloads stay
 * in .cache/textures, which git ignores, so a second run does not fetch the large moon mosaics (several
 * hundred megabytes each) again. They are kept in the project rather than the system's shared temporary
 * directory, where another program could put a file of the same name in their place. Credits and
 * licences are listed in public/textures/README.md.
 */
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MAP_SOURCES, type MapSource } from "@/app/solar-system/maps";
import { earthWinds } from "./earth-winds";
import { prepareMap, type MapRecipe } from "./moon-maps";
import { saveFlow } from "./winds";

const SOLAR_SYSTEM_SCOPE = "https://www.solarsystemscope.com/textures/download/";
const ESO_PANORAMA = "https://cdn.eso.org/images/large/eso0932a.jpg";
const ESO_GALAXY = "https://cdn.eso.org/images/large/eso1339g.jpg";
const OUT = path.resolve("public/textures");
const ONLY = process.env.TEXTURES_ONLY?.split(",");
const wanted = (group: string) => !ONLY || ONLY.includes(group);

/**
 * Source file name and local name of each surface map. Where the source offers a map at least 4096
 * pixels wide, it also comes extra large, for the 3D view zoomed in; those names must be listed in
 * SHARP_MAPS (src/app/globe/uniforms.ts).
 */
const PLANET_MAPS: [source: string, name: string][] = [
  ["8k_mercury.jpg", "mercury"],
  ["4k_venus_atmosphere.jpg", "venus"],
  ["8k_earth_daymap.jpg", "earth"],
  ["8k_earth_nightmap.jpg", "earth-night"],
  ["8k_earth_clouds.jpg", "earth-clouds"],
  ["8k_mars.jpg", "mars"],
  ["8k_jupiter.jpg", "jupiter"],
  ["8k_saturn.jpg", "saturn"],
  ["2k_uranus.jpg", "uranus"],
  ["2k_neptune.jpg", "neptune"],
];

/** Earth's slopes as a normal map and its seas as a mask, which become its relief map. */
const EARTH_NORMALS = "8k_earth_normal_map.tif";
const EARTH_SEAS = "8k_earth_specular_map.tif";

/**
 * How each moon's mosaic is prepared (scripts/moon-maps.ts): where its longitude 0 lies, how it is
 * coloured, and its visual albedo. For a GeoTIFF the middle is the projection's central meridian
 * (GeoKey 3088) shifted by the tiepoint, which differs between products of the same archive; the others
 * were checked against known features (Herschel on Mimas, Cassini Regio on Iapetus, Occator on Ceres). Grey mosaics are tinted from the colour of the dark ground to that of
 * the bright ground, after colour images of the same body.
 */
const MOON_RECIPES: Record<string, MapRecipe> = {
  moon: { centredOn180: false, colouring: { kind: "colour", saturation: 0.6 }, albedo: 0.12 },
  io: { centredOn180: false, colouring: { kind: "colour", saturation: 0.55 }, albedo: 0.63 },
  europa: { centredOn180: true, colouring: { kind: "grey", dark: "#8a6a50", bright: "#f2ede4" }, albedo: 0.67 },
  ganymede: { centredOn180: true, colouring: { kind: "colour", saturation: 0.5 }, albedo: 0.43 },
  callisto: { centredOn180: true, colouring: { kind: "grey", dark: "#5c4e40", bright: "#dcd5c9" }, albedo: 0.22 },
  mimas: { centredOn180: false, colouring: { kind: "grey", dark: "#9a958e", bright: "#e8e5e0" }, albedo: 0.6 },
  enceladus: { centredOn180: false, colouring: { kind: "grey", dark: "#c3ced6", bright: "#fbfdff" }, albedo: 0.9 },
  tethys: { centredOn180: false, colouring: { kind: "grey", dark: "#b6b1a9", bright: "#f2efe9" }, albedo: 0.8 },
  dione: { centredOn180: false, colouring: { kind: "grey", dark: "#a6a199", bright: "#eeebe6" }, albedo: 0.7 },
  rhea: { centredOn180: false, colouring: { kind: "grey", dark: "#a8a299", bright: "#ece8e1" }, albedo: 0.7 },
  titan: { centredOn180: true, colouring: { kind: "haze", color: "#d39a4c" }, albedo: 0.22 },
  phoebe: { centredOn180: false, colouring: { kind: "grey", dark: "#3f3a35", bright: "#857d73" }, albedo: 0.06 },
  iapetus: { centredOn180: true, colouring: { kind: "colour", saturation: 0.3 }, albedo: 0.3 },
  miranda: { centredOn180: false, colouring: { kind: "grey", dark: "#807b75", bright: "#d8d4ce" }, albedo: 0.32 },
  ariel: { centredOn180: false, colouring: { kind: "grey", dark: "#827d77", bright: "#dcd8d2" }, albedo: 0.39 },
  umbriel: { centredOn180: false, colouring: { kind: "grey", dark: "#6f6c68", bright: "#c9c6c1" }, albedo: 0.21 },
  titania: { centredOn180: false, colouring: { kind: "grey", dark: "#7e7871", bright: "#d6d0c8" }, albedo: 0.27 },
  oberon: { centredOn180: false, colouring: { kind: "grey", dark: "#7a706a", bright: "#d2cac2" }, albedo: 0.23 },
  triton: { centredOn180: false, colouring: { kind: "colour", saturation: 0.35 }, albedo: 0.72 },
  vesta: { centredOn180: false, colouring: { kind: "grey", dark: "#615b54", bright: "#ddd7cd" }, albedo: 0.42 },
  phobos: { centredOn180: false, colouring: { kind: "grey", dark: "#463f39", bright: "#8c837a" }, albedo: 0.07 },
  ceres: { centredOn180: true, colouring: { kind: "grey", dark: "#5e5a55", bright: "#cfcbc4" }, albedo: 0.09 },
  pluto: { centredOn180: true, colouring: { kind: "grey", dark: "#6e3a28", bright: "#f4eadc" }, albedo: 0.52 },
  charon: { centredOn180: false, colouring: { kind: "grey", dark: "#6a564e", bright: "#dcd7d0" }, albedo: 0.38 },
};

/**
 * Downloads `url` into `directory`, unless an earlier run already did. The file gets its name only once it
 * is complete, so an interrupted download is not mistaken for one.
 */
async function download(url: string, directory: string): Promise<string> {
  const file = path.join(directory, path.basename(new URL(url).pathname));
  try {
    await access(file);
    return file;
  } catch {
    // Not downloaded yet.
  }
  const response = await fetch(url, { headers: { "User-Agent": "exofinder-textures" } });
  if (!response.ok) throw new Error(`${url} answered with status ${response.status}`);
  const partial = `${file}.part`;
  await writeFile(partial, Buffer.from(await response.arrayBuffer()));
  await rename(partial, file);
  return file;
}

/**
 * Scales a moon's mosaic to `width` and prepares it, after cutting it out of its frame if the publisher
 * framed it. Large mosaics are scaled first, which is much faster.
 */
async function moonMap(file: string, recipe: MapRecipe, crop: MapSource["crop"], width: number, out: string, quality: number): Promise<number> {
  const source = sharp(file, { limitInputPixels: false });
  if (crop) source.extract(crop);
  const { data, info } = await source
    .resize(width, width / 2, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // A grey mosaic arrives with one channel; the preparation works on three.
  const rgb = info.channels === 3 ? new Uint8Array(data) : expand(new Uint8Array(data), info.channels);
  const { picture, filled } = prepareMap({ width: info.width, height: info.height, rgb }, recipe);
  await sharp(Buffer.from(picture.rgb), { raw: { width: picture.width, height: picture.height, channels: 3 } })
    .jpeg({ quality, mozjpeg: true })
    .toFile(out);
  return filled;
}

function expand(data: Uint8Array, channels: number): Uint8Array {
  const count = data.length / channels;
  const rgb = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) rgb.fill(data[i * channels], i * 3, i * 3 + 3);
  return rgb;
}

async function main() {
  const downloads = path.resolve(".cache/textures");
  await mkdir(downloads, { recursive: true });
  await mkdir(path.join(OUT, "planets"), { recursive: true });
  await mkdir(path.join(OUT, "sky"), { recursive: true });

  for (const [source, name] of wanted("planets") ? PLANET_MAPS : []) {
    const file = await download(SOLAR_SYSTEM_SCOPE + source, downloads);
    const { width = 0 } = await sharp(file).metadata();
    // Large for the 3D model, small for list thumbnails. The colours keep their full resolution,
    // because halved they would bleed across the coasts.
    await sharp(file)
      .resize(2048, 1024)
      .jpeg({ quality: 80, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toFile(path.join(OUT, "planets", `${name}-lg.jpg`));
    await sharp(file)
      .resize(512, 256)
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(OUT, "planets", `${name}-sm.jpg`));
    // Extra large for the 3D model zoomed in.
    if (width >= 4096) {
      await sharp(file)
        .resize(4096, 2048)
        .webp({ quality: 80, smartSubsample: true, effort: 6 })
        .toFile(path.join(OUT, "planets", `${name}-xl.webp`));
    }
    console.log(`planets/${name}`);
  }

  if (wanted("planets")) {
    // Earth's relief map: how far the ground leans east (red) and north (green), and the seas (blue).
    const normals = await download(SOLAR_SYSTEM_SCOPE + EARTH_NORMALS, downloads);
    const seas = await download(SOLAR_SYSTEM_SCOPE + EARTH_SEAS, downloads);
    for (const [size, width] of [["sm", 512], ["lg", 2048], ["xl", 4096]] as const) {
      const lean = await sharp(normals, { limitInputPixels: false }).resize(width, width / 2).removeAlpha().raw().toBuffer();
      const sea = await sharp(seas, { limitInputPixels: false }).resize(width, width / 2).greyscale().raw().toBuffer();
      const pixels = new Uint8Array(width * (width / 2) * 3);
      for (let i = 0; i < sea.length; i++) {
        pixels[i * 3] = lean[i * 3];
        // The source counts the lean towards south, as rows of a picture run.
        pixels[i * 3 + 1] = 255 - lean[i * 3 + 1];
        pixels[i * 3 + 2] = sea[i];
      }
      // The channels hold numbers, so none of them is stored at half resolution.
      await sharp(pixels, { raw: { width, height: width / 2, channels: 3 } })
        .jpeg({ quality: 86, chromaSubsampling: "4:4:4", mozjpeg: true })
        .toFile(path.join(OUT, "planets", `earth-relief-${size}.jpg`));
    }
    console.log("planets/earth-relief");

    // The winds that keep Earth's cloud map moving (scripts/earth-winds.ts).
    await saveFlow(path.join(OUT, "planets", "earth-clouds-flow.webp"), earthWinds());
    console.log("planets/earth-clouds-flow");
  }

  if (wanted("rings")) {
    // The ring texture holds colour and alpha from the inner to the outer edge, so a thin strip is enough.
    const ring = await download(SOLAR_SYSTEM_SCOPE + "2k_saturn_ring_alpha.png", downloads);
    await sharp(ring)
      .resize(1024, 4, { fit: "fill" })
      .png()
      .toFile(path.join(OUT, "planets", "saturn-ring.png"));
    console.log("planets/saturn-ring");
  }

  // The moons and dwarf planets, keyed by the slugs of src/app/solar-system/bodies.ts.
  for (const [name, recipe] of wanted("moons") ? Object.entries(MOON_RECIPES) : []) {
    const file = await download(MAP_SOURCES[name].download, downloads);
    const { crop } = MAP_SOURCES[name];
    const filled = await moonMap(file, recipe, crop, 2048, path.join(OUT, "planets", `${name}-lg.jpg`), 80);
    await moonMap(file, recipe, crop, 512, path.join(OUT, "planets", `${name}-sm.jpg`), 78);
    console.log(`planets/${name}${filled > 0.005 ? ` (${(filled * 100).toFixed(0)} % filled)` : ""}`);
  }

  if (wanted("sun")) {
    const sun = await download(SOLAR_SYSTEM_SCOPE + "2k_sun.jpg", downloads);
    await sharp(sun)
      .resize(1024, 512)
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT, "planets", "sun-lg.jpg"));
    console.log("planets/sun");
  }

  if (wanted("sky")) {
    // The sky panorama is in galactic coordinates with the galactic centre in the middle.
    const panorama = await download(ESO_PANORAMA, downloads);
    await sharp(panorama)
      .resize(4096, 2048)
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(OUT, "sky", "milky-way-lg.jpg"));
    await sharp(panorama)
      .resize(2048, 1024)
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(OUT, "sky", "milky-way-sm.jpg"));
    console.log("sky/milky-way");

    // The map samples this top-down galaxy view at 512 px (scene/galaxyView.ts).
    // 1024 px leaves headroom for downscaling, and more would only waste bandwidth.
    const galaxy = await download(ESO_GALAXY, downloads);
    await sharp(galaxy)
      .resize(1024, 1024, { kernel: "lanczos3" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(path.join(OUT, "sky", "galaxy.jpg"));
    console.log("sky/galaxy");
  }

  console.log(`Done. The downloads are kept in ${downloads} for the next run and can be deleted.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
