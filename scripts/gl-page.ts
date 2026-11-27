/**
 * Draws with the app's own shaders and maps in a page of a headless browser and returns the pixels. Node
 * works out every uniform, as the app does in the browser, and the page only runs WebGL: so the picture
 * is the one the site shows, at any size, moment and camera. The shader tests and the catalogue use it.
 */
import type { Page } from "playwright";
import { globeFragment, GLOBE_VERTEX } from "@/app/globe/globe.glsl";
import { NOISE_SIZE, noiseVolume } from "@/app/globe/noise";
import { poseUniforms, type GlobePose } from "@/app/globe/renderer";
import type { GlobeSpec } from "@/app/globe/spec";
import { surfaceDefines, surfaceUniforms, textureUrls } from "@/app/globe/uniforms";

/** A picture stores RGBA values from 0 to 255 per pixel, with rows from the top. */
export interface Picture {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface GlMap {
  name: string;
  /** The file the map is read from, or the name it is kept under when `pixels` are given. Null binds a blank texture. */
  url: string | null;
  wraps: boolean;
  /** Resizes the image to this square while it is decoded, because the map loads the galaxy picture that way. */
  size?: number;
  /** The map itself instead of a file: RGBA bytes as base64, with rows from the bottom as WebGL reads them. */
  pixels?: { data: string; width: number; height: number };
}

/** The buffers of a mesh as base64: three floats per vertex each, and 32-bit indices. */
export interface GlMesh {
  positions: string;
  normals: string;
  directions: string;
  indices: string;
}

export interface GlJob {
  vertex: string;
  fragment: string;
  /**
   * The planet shader draws one full-screen triangle without buffers, the galaxy shader a square with
   * position and uv attributes, and a shape model its `mesh` with position, normal and direction.
   */
  shape: "triangle" | "square" | "mesh";
  uniforms: Record<string, number | number[]>;
  /** 4 × 4 matrices, column by column. They are apart from `uniforms`, where 16 numbers are four vec4. */
  matrices?: Record<string, number[]>;
  /** The textures in texture-unit order. */
  maps: GlMap[];
  /** Whether the shader samples the planet noise volume, which is bound to the unit after `maps`. */
  noise: boolean;
  mesh?: GlMesh;
  width: number;
  height: number;
}

/** Runs in the page. It sets up WebGL once and caches programs and textures across jobs. */
async function drawInPage({ job, noise, noiseSize }: { job: GlJob; noise: string | null; noiseSize: number }) {
  interface Lab {
    canvas: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    programs: Map<string, WebGLProgram>;
    maps: Map<string, WebGLTexture>;
    blank: WebGLTexture;
    noise: WebGLTexture | null;
    square: WebGLBuffer;
  }
  const bytesOf = (text: string) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
  const scope = window as unknown as { shaderLab?: Lab };
  if (!scope.shaderLab) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!context) throw new Error("The browser has no WebGL 2.");
    const blank = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, blank);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, 1, 1, 0, context.RGBA, context.UNSIGNED_BYTE, new Uint8Array(4));
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
    const square = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, square);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 0, 0, 1, -1, 0, 1, 0, -1, 1, 0, 0, 1, 1, 1, 0, 1, 1]),
      context.STATIC_DRAW,
    );
    context.disable(context.DEPTH_TEST);
    context.disable(context.BLEND);
    scope.shaderLab = { canvas, gl: context, programs: new Map(), maps: new Map(), blank, noise: null, square };
  }
  const lab = scope.shaderLab;
  const gl = lab.gl;

  if (noise && !lab.noise) {
    lab.noise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, lab.noise);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, noiseSize, noiseSize, noiseSize, 0, gl.RED, gl.FLOAT, new Float32Array(bytesOf(noise).buffer));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  }

  const key = job.vertex + job.fragment;
  let program = lab.programs.get(key);
  if (!program) {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "The shader does not compile.");
      return shader;
    };
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, job.vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, job.fragment));
    gl.bindAttribLocation(program, 0, "position");
    gl.bindAttribLocation(program, 1, "uv");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "The program does not link.");
    lab.programs.set(key, program);
  }
  gl.useProgram(program);

  const filter = (wraps: boolean, mipmaps: boolean) => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wraps ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  for (const { url, wraps, size, pixels } of job.maps) {
    if (!url || lab.maps.has(url)) continue;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    if (pixels) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixels.width, pixels.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytesOf(pixels.data));
      filter(wraps, false);
      lab.maps.set(url, texture);
      continue;
    }
    if (size) {
      // The bitmap is flipped while it is decoded, because UNPACK_FLIP_Y_WEBGL does not apply to an ImageBitmap.
      const blob = await (await fetch(url)).blob();
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: "high",
        imageOrientation: "flipY",
      });
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      bitmap.close();
    } else {
      const image = new Image();
      image.src = url;
      await image.decode();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    filter(wraps, true);
    lab.maps.set(url, texture);
  }

  for (const [name, value] of Object.entries(job.uniforms)) {
    const location = gl.getUniformLocation(program, name);
    if (typeof value === "number") gl.uniform1f(location, value);
    else if (value.length === 2) gl.uniform2fv(location, value);
    else if (value.length === 3) gl.uniform3fv(location, value);
    else if (value.length === 9) gl.uniformMatrix3fv(location, false, value);
    // Everything else is a vec4 or an array of vec4, which uniform4fv handles in one call.
    else gl.uniform4fv(location, value);
  }
  for (const [name, value] of Object.entries(job.matrices ?? {})) {
    gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, value);
  }
  job.maps.forEach(({ name, url }, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, url ? lab.maps.get(url)! : lab.blank);
    gl.uniform1i(gl.getUniformLocation(program, name), unit);
  });
  if (job.noise) {
    gl.activeTexture(gl.TEXTURE0 + job.maps.length);
    gl.bindTexture(gl.TEXTURE_3D, lab.noise);
    gl.uniform1i(gl.getUniformLocation(program, "uNoise"), job.maps.length);
  }

  lab.canvas.width = job.width;
  lab.canvas.height = job.height;
  gl.viewport(0, 0, job.width, job.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (job.shape === "mesh" && job.mesh) {
    // A mesh is drawn once, so its buffers go as soon as the picture is taken.
    const array = gl.createVertexArray();
    gl.bindVertexArray(array);
    const buffers = (["positions", "normals", "directions"] as const).map((part, slot) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, bytesOf(job.mesh![part]), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, ["position", "normal", "direction"][slot]);
      if (location >= 0) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
      }
      return buffer;
    });
    const indices = bytesOf(job.mesh.indices);
    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, indices.length / 4, gl.UNSIGNED_INT, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(null);
    gl.deleteVertexArray(array);
    for (const buffer of [...buffers, elements]) gl.deleteBuffer(buffer);
  } else if (job.shape === "square") {
    gl.bindBuffer(gl.ARRAY_BUFFER, lab.square);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else {
    gl.disableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const pixels = new Uint8Array(job.width * job.height * 4);
  gl.readPixels(0, 0, job.width, job.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // A map that came as pixels belongs to this picture alone, so it does not stay on the graphics card.
  for (const { url, pixels: own } of job.maps) {
    if (!url || !own) continue;
    gl.deleteTexture(lab.maps.get(url)!);
    lab.maps.delete(url);
  }
  const encoder = pixels as Uint8Array & { toBase64?: () => string };
  if (encoder.toBase64) return encoder.toBase64();
  // Browsers without Uint8Array.toBase64 build the text piece by piece, which is slow for a large picture.
  let text = "";
  for (let at = 0; at < pixels.length; at += 32768) {
    text += String.fromCharCode(...pixels.subarray(at, at + 32768));
  }
  return btoa(text);
}

let noiseAsText: string | undefined;

/** Draws the job in the page, which must be able to fetch the maps the job names. */
export async function drawJob(page: Page, job: GlJob): Promise<Picture> {
  // The noise is computed in Node, as the app computes it in the browser, and sent to the page only once.
  if (job.noise) noiseAsText ??= Buffer.from(noiseVolume().buffer).toString("base64");
  const text = await page.evaluate(drawInPage, { job, noise: job.noise ? (noiseAsText ?? null) : null, noiseSize: NOISE_SIZE });
  const upsideDown = Buffer.from(text, "base64");
  // WebGL counts rows from the bottom, so the rows are reversed into picture order.
  const data = new Uint8Array(upsideDown.length);
  const row = job.width * 4;
  for (let y = 0; y < job.height; y++) {
    data.set(upsideDown.subarray((job.height - 1 - y) * row, (job.height - y) * row), y * row);
  }
  return { width: job.width, height: job.height, data };
}

/** What `drawJob` needs to draw a planet as renderer.ts does, in a square of `size` pixels with the maps of `maps`. */
export function planetJob(spec: GlobeSpec, pose: GlobePose, size: number, maps: "sm" | "lg"): GlJob {
  const urls = textureUrls(spec, maps);
  return {
    vertex: GLOBE_VERTEX,
    fragment: globeFragment(surfaceDefines(spec)),
    shape: "triangle",
    uniforms: {
      ...surfaceUniforms(spec),
      ...poseUniforms(spec, pose, { x: 0, y: 0, width: size, height: size }),
    },
    maps: [
      { name: "uMapDay", url: urls.day, wraps: true },
      { name: "uMapNight", url: urls.night, wraps: true },
      { name: "uMapClouds", url: urls.clouds, wraps: true },
      { name: "uRingMap", url: urls.ring, wraps: false },
      { name: "uMapRelief", url: urls.relief, wraps: true },
      { name: "uMapRelief2", url: urls.relief2, wraps: true },
      { name: "uMapFlow", url: urls.flow, wraps: true },
    ],
    noise: true,
    width: size,
    height: size,
  };
}
