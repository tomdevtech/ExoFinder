import type { Texture } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store of the map's textures. Reading a picture needs a browser, so loadTexture is replaced by
 * one that hands out a texture at once and lets the test decide whether and when the picture arrives.
 */
const loads: { url: string; texture: Texture; arrive: () => void; fail: () => void }[] = [];

vi.mock("@/app/map/scene/picture", async () => {
  const { Texture: Made } = await import("three");
  return {
    loadTexture: (url: string, onLoad: (texture: Texture) => void, onError: () => void) => {
      const texture = new Made();
      loads.push({ url, texture, arrive: () => onLoad(texture), fail: onError });
      return texture;
    },
  };
});

const { TextureStore } = await import("@/app/map/scene/textureStore");

beforeEach(() => {
  loads.length = 0;
});

describe("TextureStore", () => {
  it("reads a map once, however many planets use it, and tells each of them when it has arrived", () => {
    const store = new TextureStore(4);
    const told: (Texture | null)[] = [];
    const first = store.get("/a.webp", (texture) => told.push(texture));
    const second = store.get("/a.webp", (texture) => told.push(texture));
    expect(second).toBe(first);
    expect(loads).toHaveLength(1);
    expect(told).toEqual([]);
    loads[0].arrive();
    expect(told).toEqual([first, first]);
    // Whoever asks later is told at once.
    store.get("/a.webp", (texture) => told.push(texture));
    expect(told).toHaveLength(3);
    expect(loads).toHaveLength(1);
    expect(first.anisotropy).toBe(4);
  });

  it("tells of a map that could not be read, and tries again for the next planet", () => {
    const store = new TextureStore(1);
    const told: (Texture | null)[] = [];
    store.get("/gone.webp", (texture) => told.push(texture));
    loads[0].fail();
    expect(told).toEqual([null]);
    store.get("/gone.webp");
    expect(loads).toHaveLength(2);
  });

  it("keeps a black pixel for maps a planet does not have and a mid grey one for level ground and calm air", () => {
    const store = new TextureStore(1);
    const pixel = (texture: Texture) => [...(texture.image as { data: Uint8Array }).data];
    expect(pixel(store.blank)).toEqual([0, 0, 0, 255]);
    expect(pixel(store.level)).toEqual([128, 128, 128, 255]);
  });

  it("puts a relief or flow map into its place, and level ground where the map cannot be read", () => {
    const store = new TextureStore(1);
    const relief = { value: store.blank as Texture };
    const flow = { value: store.blank as Texture };
    let done = 0;
    store.spare(relief, "/relief.avif", () => done++);
    store.spare(flow, "/flow.webp", () => done++);
    // Until a map has arrived its own texture is in place, which the renderer draws as soon as it is filled.
    expect(relief.value).toBe(loads[0].texture);
    expect(flow.value).toBe(loads[1].texture);
    expect(done).toBe(0);
    // A browser that cannot read AVIF leaves the planet without relief instead of without a picture.
    loads[0].fail();
    loads[1].arrive();
    expect(relief.value).toBe(store.level);
    expect(flow.value).toBe(loads[1].texture);
    expect(done).toBe(2);
  });

  it("frees every texture it holds", () => {
    const store = new TextureStore(1);
    const map = store.get("/a.webp");
    const freed: Texture[] = [];
    for (const texture of [map, store.blank, store.level, store.noise]) {
      texture.addEventListener("dispose", () => freed.push(texture));
    }
    store.dispose();
    expect(freed).toHaveLength(4);
  });
});
