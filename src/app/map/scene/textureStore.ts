import {
  Data3DTexture,
  DataTexture,
  FloatType,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  type IUniform,
  type Texture,
} from "three";
import { NOISE_SIZE, noiseVolume } from "@/app/globe/noise";
import { loadTexture } from "./picture";

/** Loads each texture only once, however many planets use it, and decodes it off the main thread. */
export class TextureStore {
  private readonly textures = new Map<string, Texture>();
  private readonly waiting = new Map<string, ((texture: Texture | null) => void)[]>();
  /** A placeholder for shader texture slots that a planet does not use. */
  readonly blank: Texture;
  /** Mid grey, which the shader reads as level ground. It stands in for a relief map that could not be read. */
  readonly level: Texture;
  /** The 3D noise volume used for clouds and fine surface detail. */
  readonly noise: Data3DTexture;

  constructor(private readonly anisotropy: number) {
    this.blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.blank.needsUpdate = true;
    this.level = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    this.level.needsUpdate = true;

    this.noise = new Data3DTexture(noiseVolume(), NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
    this.noise.format = RedFormat;
    this.noise.type = FloatType;
    // Half floats are precise enough, and unlike full floats they can be filtered on every WebGL 2 device.
    this.noise.internalFormat = "R16F";
    this.noise.minFilter = LinearFilter;
    this.noise.magFilter = LinearFilter;
    this.noise.wrapS = RepeatWrapping;
    this.noise.wrapT = RepeatWrapping;
    this.noise.wrapR = RepeatWrapping;
    this.noise.generateMipmaps = false;
    this.noise.unpackAlignment = 1;
    this.noise.needsUpdate = true;
  }

  /**
   * Returns the texture for `url`. `onDone` is called once the texture has loaded (immediately if it
   * already has), or with `null` if loading failed.
   */
  get(url: string, onDone: (texture: Texture | null) => void = () => {}): Texture {
    const known = this.textures.get(url);
    if (known) {
      const queue = this.waiting.get(url);
      if (queue) queue.push(onDone);
      else onDone(known);
      return known;
    }
    this.waiting.set(url, [onDone]);
    const settle = (result: Texture | null) => {
      const queue = this.waiting.get(url) ?? [];
      this.waiting.delete(url);
      for (const callback of queue) callback(result);
    };
    const texture = loadTexture(
      url,
      () => settle(texture),
      () => {
        // A failed texture is removed from the cache so that the next system that needs it tries again.
        this.textures.delete(url);
        texture.dispose();
        settle(null);
      },
    );
    texture.wrapS = RepeatWrapping;
    texture.anisotropy = this.anisotropy;
    this.textures.set(url, texture);
    return texture;
  }

  /**
   * Puts the map at `url` into `uniform`, for a map a planet can do without (its relief or its
   * winds): if the map cannot be read, `level` takes its place. `onDone` is called either way.
   */
  spare(uniform: IUniform, url: string, onDone: () => void = () => {}): void {
    uniform.value = this.get(url, (texture) => {
      if (!texture) uniform.value = this.level;
      onDone();
    });
  }

  dispose(): void {
    for (const texture of this.textures.values()) texture.dispose();
    this.blank.dispose();
    this.level.dispose();
    this.noise.dispose();
  }
}
