import { globeFragment, GLOBE_VERTEX } from "./globe.glsl";
import { NOISE_SIZE, noiseVolume } from "./noise";
import { stormUniforms } from "./storms";
import {
  globeRadius,
  globeRotation,
  lightDirection,
  lockedSway,
  moonPosition,
  type GlobeSpec,
} from "./spec";
import {
  defineLines,
  LARGE_MAP_WIDTH,
  stretchesLargeMaps,
  surfaceConstants,
  type SurfaceDefines,
  type SurfaceUniforms,
} from "./uniforms";

/** How the planet is seen at one moment. */
export interface GlobePose {
  /** Seconds the planet has been turning. */
  seconds: number;
  /** The viewer's position around the planet, in radians. */
  yaw?: number;
  pitch?: number;
  /** A zoom of 1 shows the whole planet. */
  zoom?: number;
  /** Lets the bands of gas giants drift. It is off for the small images in lists. */
  flow?: boolean;
}

/** A rectangle of the canvas in pixels, measured from the lower left corner as WebGL does. */
export interface GlobeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LoadedTexture {
  texture: WebGLTexture;
  ready: boolean;
}

/**
 * The uniforms of globe.glsl.ts that depend on the pose and on where the planet is drawn. Together
 * with surfaceUniforms() and the textures they are everything a frame needs.
 */
export function poseUniforms(
  spec: GlobeSpec,
  pose: GlobePose,
  rect: GlobeRect,
): Record<string, number | number[]> {
  const zoom = pose.zoom ?? 1;
  const yaw = (pose.yaw ?? 0) + lockedSway(spec, pose.seconds);
  const moon = moonPosition(spec, pose.seconds, yaw, pose.pitch) ?? [0, 0, 0];
  return {
    uTime: pose.seconds,
    // Zooming in adds detail to the clouds and the fine grain.
    uDetail: Math.min(3, Math.max(0, Math.log2(zoom))),
    uCenter: [rect.x + rect.width / 2, rect.y + rect.height / 2],
    uRadius: (Math.min(rect.width, rect.height) / 2) * globeRadius(spec) * zoom,
    // The rotation is stored row by row, but WebGL reads it column by column. Read that way it is the
    // inverse rotation, which is the one the shader needs.
    uViewToObj: globeRotation(spec, pose.seconds, yaw, pose.pitch),
    uLightView: lightDirection(yaw, pose.pitch),
    uFlatten: spec.flattening,
    uMoon: [moon[0], moon[1], moon[2], spec.moon?.size ?? 0],
    ...stormUniforms(spec, pose.seconds),
    ...(pose.flow ? {} : { uFlow: 0 }),
  };
}

/** One program, built for one combination of surface parts. */
interface Program {
  program: WebGLProgram | null;
  /** The shaders are kept while the program is being built, so their error logs can be read. */
  shaders: WebGLShader[];
  state: "building" | "ready" | "failed";
  locations: Map<string, WebGLUniformLocation | null>;
}

/** Texture units: the maps of surface.glsl.ts come first, in the order of `maps` in `draw`, then the noise. */
const MAP_UNITS = ["uMapDay", "uMapNight", "uMapClouds", "uRingMap", "uMapRelief", "uMapRelief2", "uMapFlow"] as const;
const NOISE_UNIT = MAP_UNITS.length;
/** How often a disposed renderer checks whether a program it still has to delete has finished building. */
const DROP_POLL_MS = 200;

/**
 * Draws planets with WebGL 2, any number of them into different parts of one canvas. Each
 * combination of surface parts has its own program. Programs are built in the background because
 * some drivers (Direct3D on Windows) take noticeable time, and asking for the result too early would
 * freeze the page. Until a planet's program is ready, `draw` returns false and the still image stays.
 */
export class GlobeRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly textureSize: "sm" | "lg";
  private readonly onChange: () => void;
  /** Lets the renderer ask whether the driver has finished a program without waiting for it. */
  private readonly parallelCompile: { COMPLETION_STATUS_KHR: number } | null;
  private programs = new Map<string, Program>();
  private textures = new Map<string, LoadedTexture>();
  private blank: WebGLTexture | null = null;
  private noise: WebGLTexture | null = null;
  private disposed = false;
  /** Whether the graphics card takes textures as wide as the extra-large maps. */
  private holdsSharpMaps = false;

  /**
   * Returns null when the browser has no WebGL 2. `onChange` is called when a texture has arrived or
   * the context was restored, so a paused image can be drawn again.
   */
  static create(
    canvas: HTMLCanvasElement,
    textureSize: "sm" | "lg",
    onChange: () => void = () => {},
  ): GlobeRenderer | null {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
    if (!gl) return null;
    const renderer = new GlobeRenderer(gl, textureSize, onChange);
    canvas.addEventListener("webglcontextlost", renderer.onContextLost);
    canvas.addEventListener("webglcontextrestored", renderer.onContextRestored);
    return renderer;
  }

  private constructor(
    gl: WebGL2RenderingContext,
    textureSize: "sm" | "lg",
    onChange: () => void,
  ) {
    this.gl = gl;
    this.textureSize = textureSize;
    this.onChange = onChange;
    this.parallelCompile = gl.getExtension("KHR_parallel_shader_compile");
    this.setup();
  }

  /** Whether programs are built without blocking the page (KHR_parallel_shader_compile). */
  get buildsInBackground(): boolean {
    return this.parallelCompile !== null;
  }

  /** Starts building the program for these surface parts if it does not exist yet. */
  prepare(defines: SurfaceDefines): void {
    this.program(defines);
  }

  /**
   * Whether the planet's program is ready, starting to build it if necessary. Browsers without
   * KHR_parallel_shader_compile have to wait here once.
   */
  ready(spec: GlobeSpec): boolean {
    const { defines, program } = surfaceConstants(spec);
    const entry = this.program(defines, program);
    return entry !== null && this.check(entry);
  }

  /**
   * Whether a program is still being built. The canvas size must not change meanwhile, because that
   * waits for the driver and freezes the page.
   */
  busy(): boolean {
    let building = false;
    for (const entry of this.programs.values()) {
      if (!this.check(entry) && entry.state === "building") building = true;
    }
    return building;
  }

  /**
   * Draws the planet into the rectangle. Returns false when nothing could be drawn yet, for example
   * because the program is still being built or the textures are still loading.
   */
  draw(spec: GlobeSpec, pose: GlobePose, rect: GlobeRect): boolean {
    const gl = this.gl;
    if (gl.isContextLost()) return false;
    const constants = surfaceConstants(spec);
    const entry = this.program(constants.defines, constants.program);
    if (!entry || !this.check(entry) || !entry.program) return false;

    const urls = constants.urls[this.textureSize];
    const radius = (Math.min(rect.width, rect.height) / 2) * globeRadius(spec) * (pose.zoom ?? 1);
    // The extra-large maps are fetched once the planet is large enough for them and drawn each as
    // soon as it has arrived; until then, and if it never arrives, the large one is drawn.
    const stretched = this.textureSize === "lg" && this.holdsSharpMaps && stretchesLargeMaps(radius);
    const sharp = constants.urls.xl;
    const map = (url: string | null, sharpUrl: string | null, spare = false) => {
      if (!url) return null;
      const large = this.texture(url, true, spare);
      if (!stretched || !sharpUrl || sharpUrl === url) return large;
      const better = this.texture(sharpUrl, true);
      return better.ready ? better : large;
    };
    const maps = [
      map(urls.day, sharp.day),
      map(urls.night, sharp.night),
      map(urls.clouds, sharp.clouds),
      urls.ring ? this.texture(urls.ring, false) : null,
      // A planet is drawn without the relief of a preset if that map cannot be read, and with clouds
      // that stand still if its flow map cannot.
      map(urls.relief, sharp.relief, spec.kind === "terrain"),
      map(urls.relief2, sharp.relief2, true),
      map(urls.flow, sharp.flow, true),
    ];

    gl.viewport(rect.x, rect.y, rect.width, rect.height);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (maps.some((map) => map && !map.ready)) return false;

    gl.useProgram(entry.program);
    const location = (name: string) => this.location(entry, name);
    const set = (values: SurfaceUniforms | Record<string, number | number[]>) => {
      for (const [name, value] of Object.entries(values) as [string, number | number[]][]) {
        if (typeof value === "number") gl.uniform1f(location(name), value);
        else if (value.length === 2) gl.uniform2fv(location(name), value);
        else if (value.length === 3) gl.uniform3fv(location(name), value);
        else if (value.length === 9) gl.uniformMatrix3fv(location(name), false, value);
        // Everything else is a vec4 or an array of vec4.
        else gl.uniform4fv(location(name), value);
      }
    };
    // The pose comes second because it may switch off the drift that the spec asks for (`uFlow`).
    set(constants.uniforms);
    set(poseUniforms(spec, pose, rect));

    MAP_UNITS.forEach((name, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, maps[unit]?.texture ?? this.blank);
      gl.uniform1i(location(name), unit);
    });
    gl.activeTexture(gl.TEXTURE0 + NOISE_UNIT);
    gl.bindTexture(gl.TEXTURE_3D, this.noise);
    gl.uniform1i(location("uNoise"), NOISE_UNIT);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  dispose(): void {
    this.disposed = true;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    for (const entry of this.textures.values()) gl.deleteTexture(entry.texture);
    this.textures.clear();
    gl.deleteTexture(this.blank);
    gl.deleteTexture(this.noise);
    for (const entry of this.programs.values()) this.drop(entry);
    this.programs.clear();
  }

  private onContextLost = (event: Event) => {
    // Without preventDefault the browser would not restore the context.
    event.preventDefault();
    this.programs.clear();
  };

  private onContextRestored = () => {
    // Everything that lived on the GPU is gone and has to be created again.
    this.textures.clear();
    this.programs.clear();
    this.setup();
    this.onChange();
  };

/** Creates the textures every planet uses and sets the fixed drawing state. */
  private setup(): void {
    const gl = this.gl;

    // This blank texture stands in for the maps a planet does not have.
    this.blank = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.blank);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // The noise for the clouds and the fine grain (noise.ts). Half floats are precise enough and can
    // be filtered on every WebGL 2 device.
    this.noise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.noise);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, NOISE_SIZE, NOISE_SIZE, NOISE_SIZE, 0, gl.RED, gl.FLOAT, noiseVolume());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

    this.holdsSharpMaps = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) >= LARGE_MAP_WIDTH * 2;

    // Blending stays off because the shader writes colours already multiplied by their opacity.
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  /**
   * Returns the program for these surface parts, starting a build if needed. It does not ask the
   * driver whether the build succeeded, because that question waits until the driver is done;
   * `check` asks later.
   */
  private program(defines: SurfaceDefines, key = defineLines(defines)): Program | null {
    const existing = this.programs.get(key);
    if (existing) return existing;

    const gl = this.gl;
    if (gl.isContextLost()) return null;
    const vertex = this.compile(gl.VERTEX_SHADER, GLOBE_VERTEX);
    const fragment = this.compile(gl.FRAGMENT_SHADER, globeFragment(defines));
    const program = gl.createProgram();
    const entry: Program = {
      program: null,
      shaders: [],
      state: "failed",
      locations: new Map(),
    };
    if (vertex && fragment && program) {
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      entry.program = program;
      entry.shaders = [vertex, fragment];
      entry.state = "building";
    }
    this.programs.set(key, entry);
    return entry;
  }

  private compile(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  /** Whether the program is ready. It returns false without waiting while the program is still being built. */
  private check(entry: Program): boolean {
    if (entry.state !== "building") return entry.state === "ready";
    const gl = this.gl;
    const program = entry.program;
    if (!program) return false;
    if (
      this.parallelCompile &&
      !gl.getProgramParameter(program, this.parallelCompile.COMPLETION_STATUS_KHR)
    ) {
      return false;
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) {
        const messages = [
          ...entry.shaders.map((shader) => gl.getShaderInfoLog(shader)),
          gl.getProgramInfoLog(program),
        ].filter(Boolean);
        console.warn("Planet shader:", messages.join("\n"));
      }
      entry.state = "failed";
      this.drop(entry);
      return false;
    }
    for (const shader of entry.shaders) gl.deleteShader(shader);
    entry.shaders = [];
    entry.state = "ready";
    return true;
  }

  private drop(entry: Program): void {
    const gl = this.gl;
    const { program, shaders } = entry;
    entry.program = null;
    entry.shaders = [];
    const remove = () => {
      for (const shader of shaders) gl.deleteShader(shader);
      gl.deleteProgram(program);
    };
    // Deleting a program while the driver is still building it makes the browser log "Program object
    // expected" warnings, so it is deleted once the build is done. In development this happens on
    // every planet page, because React mounts the viewer twice.
    const extension = this.parallelCompile;
    if (!program || entry.state !== "building" || !extension) {
      remove();
      return;
    }
    const removeWhenBuilt = () => {
      if (gl.isContextLost()) return;
      if (gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) remove();
      else setTimeout(removeWhenBuilt, DROP_POLL_MS);
    };
    setTimeout(removeWhenBuilt, DROP_POLL_MS);
  }

  private location(entry: Program, name: string): WebGLUniformLocation | null {
    let location = entry.locations.get(name);
    if (location === undefined) {
      location = entry.program ? this.gl.getUniformLocation(entry.program, name) : null;
      entry.locations.set(name, location);
    }
    return location;
  }

  /**
   * Starts loading a texture on first use. `wraps` repeats it horizontally, for maps that go around the
   * planet. A planet waits for its maps, except for a `spare` one: if that cannot be read (the relief
   * maps are AVIF, which old browsers lack), mid grey takes its place, which the shader reads as level
   * ground or calm air.
   */
  private texture(url: string, wraps: boolean, spare = false): LoadedTexture {
    const existing = this.textures.get(url);
    if (existing) return existing;

    const gl = this.gl;
    const entry: LoadedTexture = { texture: gl.createTexture(), ready: false };
    this.textures.set(url, entry);

    const image = new Image();
    image.src = url;
    // The image is decoded off the main thread first. Uploading an undecoded image would decode it on
    // the main thread during the upload, which stalls phones. A texture that fails to load leaves
    // the planet waiting.
    const upload = () => {
      // The renderer may have been disposed or the context restored since the request started.
      if (this.disposed || this.textures.get(url) !== entry) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      // Images start at the top, while WebGL textures start at the bottom.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wraps ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Anisotropic filtering keeps the map sharp near the edge of the planet, where it is seen at a grazing angle.
      const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
      if (anisotropic) {
        gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, 8);
      }
      entry.ready = true;
      this.onChange();
    };
    const giveUp = () => {
      if (!spare || this.disposed || this.textures.get(url) !== entry) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      entry.ready = true;
      this.onChange();
    };
    image.decode().then(upload, giveUp);
    return entry;
  }
}
