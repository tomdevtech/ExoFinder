/**
 * The pictures of the printed catalogue: every body drawn once with the shaders and maps of the site, in a
 * headless browser, and kept as a JPEG. A picture is kept under a hash of everything that shapes it, so a
 * later run only draws the bodies that are new or look different.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import type { GlobePose } from "@/app/globe/renderer";
import { inventedBody, SHAPE_FRAGMENT, SHAPE_VERTEX, shapeMesh, SHAPE_HEIGHT, SHAPE_WIDTH } from "@/app/globe/shape";
import { linearColor, type GlobeSpec } from "@/app/globe/spec";
import { BALL_VERTEX, STAR_FRAGMENT } from "@/app/map/scene/shaders";
import { drawJob, planetJob, type GlJob, type GlMap, type GlMesh } from "./gl-page";

/** What a picture shows: a globe, a measured shape model, a made-up small body, or the Sun. */
export type PictureSource =
  | { kind: "globe"; spec: GlobeSpec }
  | { kind: "shape"; slug: string; maxRadius: number; map: string | null; color: string }
  | { kind: "invented"; seed: number }
  | { kind: "sun" };

/** The page colour of the catalogue. The pictures are laid over it, so that no edge shows around them. */
export const PAGE_COLOUR = "#05060b";

/** Bumped by hand when a picture has to be drawn again although nothing that is hashed has changed, such as a map file. */
const VERSION = 1;
/** A moment at which every planet is drawn, so that its weather is the same in every edition. */
const POSE: GlobePose = { seconds: 0, yaw: 0, pitch: 0, zoom: 1, flow: true };
/**
 * Every picture is drawn this many times larger and scaled down. That smooths the hard edges of the meshes,
 * which the browser does not smooth here, and the grain of the planets that is finer than a pixel.
 */
const OVERSAMPLING = 2;
/** The view of ShapeViewer.tsx: a narrow lens from slightly above, the star to the upper left. */
const FIELD_OF_VIEW = (20 * Math.PI) / 180;
const PITCH = 0.25;
const SUNWARD = [-0.62, 0.42, 0.66];
const ORIGIN = "http://catalogue.invalid";
const PICTURES_PER_PAGE = 150;

const VERSION_LINE = "#version 300 es\n";

type Vec3 = [number, number, number];

const normalize = ([x, y, z]: number[]): Vec3 => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The camera of a mesh picture: the matrices column by column, and where the camera and the star stand in
 * the space of a body turned by `turn` about its axis. The camera stands far enough back that a body
 * reaching `maxRadius` from its centre fits the picture.
 */
export function meshView(maxRadius: number, turn: number) {
  const distance = (maxRadius * 1.08) / Math.sin(FIELD_OF_VIEW / 2);
  const eye: Vec3 = [0, distance * Math.sin(PITCH), distance * Math.cos(PITCH)];
  const back = normalize(eye);
  const right = normalize(cross([0, 1, 0], back));
  const up = cross(back, right);
  const view = [
    right[0], up[0], back[0], 0,
    right[1], up[1], back[1], 0,
    right[2], up[2], back[2], 0,
    -dot(right, eye), -dot(up, eye), -dot(back, eye), 1,
  ];
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const model = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  const modelView = Array.from({ length: 16 }, (_, at) => {
    const column = Math.floor(at / 4);
    const row = at % 4;
    return [0, 1, 2, 3].reduce((sum, k) => sum + view[k * 4 + row] * model[column * 4 + k], 0);
  });
  const near = 0.01;
  const far = 1000;
  const scale = 1 / Math.tan(FIELD_OF_VIEW / 2);
  const projection = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
  // Turning a point of the world into the body's space undoes the body's turn.
  const intoBody = ([x, y, z]: Vec3): Vec3 => [c * x - s * z, y, s * x + c * z];
  const star = SUNWARD.map((_, axis) => (right[axis] * SUNWARD[0] + up[axis] * SUNWARD[1] + back[axis] * SUNWARD[2]) * 1000) as Vec3;
  return { modelView, projection, camera: intoBody(eye), star: intoBody(star) };
}

const base64 = (array: Float32Array | Uint32Array | Uint8Array | Uint16Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");

function toGlMesh(grid: Uint16Array, maxRadius: number): GlMesh {
  const mesh = shapeMesh(grid, maxRadius);
  return {
    positions: base64(mesh.positions),
    normals: base64(mesh.normals),
    directions: base64(mesh.directions),
    indices: base64(mesh.indices),
  };
}

/** A turn about the axis that differs from body to body, so that they do not all show the same face. */
const turnOf = (seed: number) => ((seed % 360) * Math.PI) / 180;

function hashOf(text: string): number {
  return createHash("sha256").update(text).digest().readUInt32LE(0);
}

/** The job that draws a source for a picture of `size` pixels, larger by `OVERSAMPLING`. */
function jobFor(source: PictureSource, size: number, publicDir: string): GlJob {
  const side = size * OVERSAMPLING;
  if (source.kind === "globe") return planetJob(source.spec, POSE, side, "lg");

  const mesh = (vertex: string, fragment: string, grid: Uint16Array, maxRadius: number, turn: number, map: GlMap, uniforms: GlJob["uniforms"], noise: boolean): GlJob => {
    const view = meshView(maxRadius, turn);
    return {
      vertex: VERSION_LINE + vertex,
      fragment: VERSION_LINE + fragment,
      shape: "mesh",
      uniforms: { ...uniforms, uLightObject: view.star, uCameraObject: view.camera },
      matrices: { modelViewMatrix: view.modelView, projectionMatrix: view.projection },
      maps: [map],
      noise,
      mesh: toGlMesh(grid, maxRadius),
      width: side,
      height: side,
    };
  };

  if (source.kind === "sun") {
    const sphere = new Uint16Array(SHAPE_WIDTH * (SHAPE_HEIGHT + 1)).fill(65535);
    const map = { name: "uMapDay", url: "/textures/planets/sun-lg.jpg", wraps: true };
    return mesh(BALL_VERTEX, STAR_FRAGMENT, sphere, 1, 0, map, { uHasMap: 1, uColor: [1, 1, 1] }, true);
  }

  if (source.kind === "invented") {
    const body = inventedBody(source.seed);
    const map = {
      name: "uMapDay",
      url: `invented:${source.seed}`,
      wraps: true,
      pixels: { data: base64(body.map), width: body.mapWidth, height: body.mapHeight },
    };
    const uniforms = { uHasMap: 1, uTint: [0, 0, 0], uLight: [1, 1, 1] };
    return mesh(SHAPE_VERTEX, SHAPE_FRAGMENT, body.grid, body.maxRadius, turnOf(source.seed), map, uniforms, false);
  }

  const file = readFileSync(path.join(publicDir, "shapes", `${source.slug}.bin`));
  const grid = new Uint16Array(file.buffer, file.byteOffset, file.byteLength / 2);
  const map = { name: "uMapDay", url: source.map, wraps: true };
  const uniforms = { uHasMap: source.map ? 1 : 0, uTint: linearColor(source.color), uLight: [1, 1, 1] };
  return mesh(SHAPE_VERTEX, SHAPE_FRAGMENT, grid, source.maxRadius, turnOf(hashOf(source.slug)), map, uniforms, false);
}

/**
 * Everything that shapes the picture of a source, to name the file it is kept in. Building the mesh of a
 * small moon takes a third of a second, so a mesh is named by what it is made from, not by its buffers.
 */
function fingerprint(source: PictureSource, size: number): unknown {
  if (source.kind === "globe") return planetJob(source.spec, POSE, size * OVERSAMPLING, "lg");
  const shaders = source.kind === "sun" ? [BALL_VERTEX, STAR_FRAGMENT] : [SHAPE_VERTEX, SHAPE_FRAGMENT];
  return [source, shaders, OVERSAMPLING, FIELD_OF_VIEW, PITCH, SUNWARD];
}

export interface StudioOptions {
  /** The folder the pictures are kept in. */
  cacheDir: string;
  /** The `public` folder of the app, where the maps and the shapes are. */
  publicDir: string;
  /** The width and height of a picture in pixels. */
  size: number;
  /** The JPEG quality from 1 to 100. */
  quality: number;
  /** Draws with the graphics card instead of in software, which is many times faster where there is one. */
  gpu: boolean;
}

/** A headless browser that draws the pictures of the catalogue one after the other. */
export class PictureStudio {
  private browser: Browser | null = null;
  private page: Page | null = null;
  /** How many pictures were drawn in this run, as opposed to found in the folder. */
  drawn = 0;
  /** How many pictures the current page has drawn. */
  private onPage = 0;

  constructor(private readonly options: StudioOptions) {
    mkdirSync(options.cacheDir, { recursive: true });
  }

  /** The name of the graphics card the browser draws with, or of its software renderer. */
  async renderer(): Promise<string> {
    const page = await this.open();
    return page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
    });
  }

  /** Returns the file of the picture of `source`, drawing it first if it is not there yet. */
  async picture(source: PictureSource): Promise<string> {
    const { size, quality, cacheDir, publicDir } = this.options;
    const key = createHash("sha256")
      .update(JSON.stringify([VERSION, PAGE_COLOUR, size, quality, fingerprint(source, size)]))
      .digest("hex")
      .slice(0, 32);
    const file = path.join(cacheDir, `${key}.jpg`);
    if (existsSync(file)) return file;

    const picture = await this.draw(jobFor(source, size, publicDir));
    // The pixels are multiplied by their opacity already, so the page colour only shows through what is left of it.
    const background = [1, 3, 5].map((at) => Number.parseInt(PAGE_COLOUR.slice(at, at + 2), 16));
    const flat = Buffer.alloc(picture.width * picture.height * 3);
    for (let pixel = 0; pixel < picture.width * picture.height; pixel++) {
      const through = 1 - picture.data[pixel * 4 + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        flat[pixel * 3 + channel] = Math.min(255, Math.round(picture.data[pixel * 4 + channel] + background[channel] * through));
      }
    }
    // mozjpeg writes the smallest file a JPEG of this quality can be, and a PDF takes a JPEG as it is.
    await sharp(flat, { raw: { width: picture.width, height: picture.height, channels: 3 } })
      .resize(size, size, { kernel: "lanczos3" })
      .jpeg({ quality, mozjpeg: true })
      .toFile(file);
    this.drawn++;
    return file;
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.page = null;
    this.onPage = 0;
  }

  private async draw(job: GlJob) {
    // A page that has drawn hundreds of pictures holds on to memory, so it is replaced now and then.
    if (this.onPage >= PICTURES_PER_PAGE) await this.leavePage();
    this.onPage++;
    try {
      return await drawJob(await this.open(), job);
    } catch (error) {
      // A page can crash or lose its graphics context in the middle of thousands of pictures.
      console.warn("Drawing failed once, trying again in a new browser:", error instanceof Error ? error.message : error);
      await this.close();
      return drawJob(await this.open(), job);
    }
  }

  private async leavePage(): Promise<void> {
    await this.page?.close().catch(() => {});
    this.page = null;
    this.onPage = 0;
  }

  private async open(): Promise<Page> {
    if (this.page) return this.page;
    this.browser ??= await chromium.launch({
      headless: true,
      args: this.options.gpu
        ? ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--force_high_performance_gpu", "--enable-gpu"]
        : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    const page = await this.browser.newPage();
    const root = path.resolve(this.options.publicDir);
    // The page asks for its maps like a page of the site does; they are handed over from the folder, without a server.
    await page.route(`${ORIGIN}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Catalogue</title>" });
      const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
      if (!file.startsWith(root + path.sep) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ path: file });
    });
    // tsx wraps the helper functions of the code it sends to the page in a call to `__name`, which only exists in Node.
    await page.addInitScript("globalThis.__name = (fn) => fn;");
    await page.goto(`${ORIGIN}/`);
    this.page = page;
    return page;
  }
}
