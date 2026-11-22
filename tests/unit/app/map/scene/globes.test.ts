import { SphereGeometry, type Texture } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { layoutOrbits } from "@/app/map/orbits";
import type { MapMoon, MapPlanet } from "@/app/map/payload";
import { planetAppearance, type AppearanceInput } from "@/app/planets/appearance";

/**
 * The globes of the system view. Reading a picture needs a browser, so loadTexture is replaced by one that
 * hands out a texture at once and lets the test decide whether and when the picture arrives.
 */
const loads: { url: string; arrive: () => void; fail: () => void }[] = [];

vi.mock("@/app/map/scene/picture", async () => {
  const { Texture: Made } = await import("three");
  return {
    loadTexture: (url: string, onLoad: (texture: Texture) => void, onError: () => void) => {
      const texture = new Made();
      loads.push({ url, arrive: () => onLoad(texture), fail: onError });
      return texture;
    },
  };
});

const { GlobeFactory } = await import("@/app/map/scene/globes");
const { TextureStore } = await import("@/app/map/scene/textureStore");

const SUN = { radiusSun: 1, massSun: 1 };

function mapPlanet(input: AppearanceInput, orbit: { periodDays: number; axisAu: number }, moons: MapMoon[] = []): MapPlanet {
  return {
    slug: input.slug,
    name: input.slug,
    description: "",
    href: `/planets/${input.slug}`,
    orbitalPeriodDays: orbit.periodDays,
    semiMajorAxisAu: orbit.axisAu,
    eccentricity: 0.05,
    radiusEarth: input.radiusEarth,
    globe: planetAppearance(input).globe,
    moons,
    smallMoons: [],
    shape: null,
  };
}

const sol = (slug: string, radiusEarth: number, eqTempK: number): AppearanceInput => ({
  slug,
  source: "sol",
  planetClass: radiusEarth > 6 ? "gas_giant" : "rocky",
  climateClass: "cold",
  starTeffK: 5772,
  radiusEarth,
  eqTempK,
  densityEarth: null,
  orbitalPeriodDays: 365,
});

const EARTH = mapPlanet(sol("earth", 1, 255), { periodDays: 365.25, axisAu: 1 });
const SATURN = mapPlanet(sol("saturn", 9.14, 81), { periodDays: 10759, axisAu: 9.58 });
const MERCURY = mapPlanet(sol("mercury", 0.38, 440), { periodDays: 88, axisAu: 0.39 });

function build(planet: MapPlanet) {
  const factory = new GlobeFactory(new TextureStore(4), new SphereGeometry(1, 8, 4));
  const [layout] = layoutOrbits([planet], SUN);
  return { factory, layout, body: factory.createBody(planet, layout) };
}

beforeEach(() => {
  loads.length = 0;
});

describe("GlobeFactory", () => {
  it("keeps a planet hidden until all its maps have arrived, so it never flashes black", () => {
    const { body } = build(EARTH);
    expect(loads.length).toBeGreaterThan(1);
    expect(body.anchor.visible).toBe(false);
    for (const load of loads.slice(0, -1)) load.arrive();
    expect(body.anchor.visible).toBe(false);
    loads.at(-1)?.arrive();
    expect(body.anchor.visible).toBe(true);
  });

  it("shows a planet whose maps could not be read as well, instead of hiding it for ever", () => {
    const { body } = build(EARTH);
    for (const load of loads) load.fail();
    expect(body.anchor.visible).toBe(true);
  });

  it("reads the small maps for a planet on its orbit", () => {
    build(EARTH);
    const sized = loads.map((load) => load.url).filter((url) => /-(sm|lg|xl)\./.test(url));
    expect(sized.length).toBeGreaterThan(0);
    expect(sized.every((url) => url.includes("-sm."))).toBe(true);
  });

  it("reads the large maps once the camera follows the planet, and only once", () => {
    const { factory, body } = build(EARTH);
    expect(body.sharp).toBe(false);
    const before = loads.length;
    factory.sharpen(body);
    const large = loads.slice(before).map((load) => load.url);
    expect(large.length).toBeGreaterThan(0);
    expect(large.every((url) => url.includes("-lg."))).toBe(true);
    expect(body.sharp).toBe(true);
    factory.sharpen(body);
    expect(loads).toHaveLength(before + large.length);
  });

  it("puts a large map in place of the small one when it has arrived", () => {
    const { factory, body } = build(EARTH);
    const small = body.ball.material.uniforms.uMapDay.value;
    const before = loads.length;
    factory.sharpen(body);
    expect(body.ball.material.uniforms.uMapDay.value).toBe(small);
    for (const load of loads.slice(before)) load.arrive();
    expect(body.ball.material.uniforms.uMapDay.value).not.toBe(small);
  });

  it("tilts the axis of a planet and lets its globe hide the faint lines behind it", () => {
    const { body } = build(EARTH);
    expect(body.axis.rotation.z).toBeCloseTo((-EARTH.globe.tiltDeg * Math.PI) / 180, 10);
    expect(body.axis.children).toContain(body.ball);
    expect(body.anchor.children).toContain(body.axis);
  });

  it("gives Saturn rings in its equator that share the maps and the light of the planet", () => {
    const { body } = build(SATURN);
    expect(SATURN.globe.rings).not.toBeNull();
    expect(body.ring).not.toBeNull();
    expect(body.ring?.rotation.x).toBeCloseTo(-Math.PI / 2, 10);
    const ring = body.ring!.material.uniforms;
    const ball = body.ball.material.uniforms;
    expect(ring.uMapDay).toBe(ball.uMapDay);
    expect(ring.uRingMap).toBe(ball.uRingMap);
    // The disc does not spin with the planet, so it has its own directions to the light and the camera.
    expect(ring.uLightObject).not.toBe(ball.uLightObject);
    expect(ring.uCameraObject).not.toBe(ball.uCameraObject);
  });

  it("gives a planet without rings none", () => {
    expect(build(EARTH).body.ring).toBeNull();
  });

  it("flattens a fast-turning giant at its poles", () => {
    const { body } = build(SATURN);
    expect(SATURN.globe.flattening).toBeGreaterThan(0);
    expect(body.ball.scale.y).toBeCloseTo(1 - SATURN.globe.flattening, 10);
    expect(body.ball.scale.x).toBe(1);
  });

  it("wraps a planet with air in a shell of haze, and leaves an airless one bare", () => {
    expect(EARTH.globe.atmosphere).not.toBeNull();
    expect(build(EARTH).body.haze).not.toBeNull();
    expect(MERCURY.globe.atmosphere).toBeNull();
    expect(build(MERCURY).body.haze).toBeNull();
  });

  it("draws the orbit as a closed line of semi-major axis 1, which the view scales", () => {
    const { body } = build(EARTH);
    const points = body.orbit.geometry.getAttribute("position");
    expect(points.count).toBe(257);
    expect([points.getX(0), points.getY(0), points.getZ(0)]).toEqual([points.getX(256), points.getY(256), points.getZ(256)]);
    let farthest = 0;
    let nearest = Infinity;
    for (let i = 0; i < points.count; i++) {
      expect(points.getY(i)).toBe(0);
      const distance = Math.hypot(points.getX(i), points.getZ(i));
      farthest = Math.max(farthest, distance);
      nearest = Math.min(nearest, distance);
    }
    expect(farthest).toBeCloseTo(1 + body.layout.eccentricity, 3);
    expect(nearest).toBeCloseTo(1 - body.layout.eccentricity, 3);
  });

  it("starts a planet without its real moons, which are made when the camera follows it", () => {
    const { body } = build(EARTH);
    expect(body.moons).toBeNull();
    expect(body.smallMoons).toBeNull();
    expect(body.presence).toBe(1);
  });

  it("makes the moons of a planet, hidden in the plane of their orbit until the camera follows it", () => {
    const moon: MapMoon = {
      slug: "moon",
      name: "Moon",
      href: "/solar-system/moon",
      semiMajorAxisKm: 384400,
      orbitalPeriodDays: 27.32,
      eccentricity: 0.055,
      inclinationDeg: 5.1,
      ecliptic: true,
      radiusKm: 1737.4,
      globe: MERCURY.globe,
      shape: null,
    };
    const planet = { ...EARTH, moons: [moon] };
    const { factory, body } = build(planet);
    const [made] = factory.createMoons(planet, body);
    expect(made.name).toBe("Moon");
    expect(made.plane.visible).toBe(false);
    expect(made.plane.children).toContain(made.anchor);
    expect(made.plane.children).toContain(made.orbit);
    expect(made.plane.rotation.x).toBeCloseTo((5.1 * Math.PI) / 180, 10);
    // The Moon's orbit is measured against the ecliptic, so it does not tilt with Earth's axis.
    expect(made.plane.parent?.rotation.z).toBe(0);
    expect(made.plane.parent?.parent).toBe(body.anchor);
  });

  it("tilts the orbit of a moon with the equator of its planet unless it refers to the ecliptic", () => {
    const titan: MapMoon = {
      slug: "titan",
      name: "Titan",
      href: "/solar-system/titan",
      semiMajorAxisKm: 1221870,
      orbitalPeriodDays: 15.95,
      eccentricity: 0.029,
      inclinationDeg: 0.3,
      ecliptic: false,
      radiusKm: 2574.7,
      globe: MERCURY.globe,
      shape: null,
    };
    const planet = { ...SATURN, moons: [titan] };
    const { factory, body } = build(planet);
    const [made] = factory.createMoons(planet, body);
    expect(made.plane.parent?.rotation.z).toBeCloseTo((-SATURN.globe.tiltDeg * Math.PI) / 180, 10);
  });

  it("makes up a hidden globe for a followed small moon, the same one for the same name", () => {
    const factory = new GlobeFactory(new TextureStore(4), new SphereGeometry(1, 8, 4));
    const globe = factory.createInvented("S/2004 S 12");
    expect(globe.visible).toBe(false);
    expect(globe.material.uniforms.uHasMap.value).toBe(1);
    const again = factory.createInvented("S/2004 S 12");
    expect(again.geometry.getAttribute("position").array).toEqual(globe.geometry.getAttribute("position").array);
    const other = factory.createInvented("S/2004 S 13");
    expect(other.geometry.getAttribute("position").array).not.toEqual(globe.geometry.getAttribute("position").array);
  });

  it("reshapes that globe for another small moon and frees what it drew before", () => {
    const factory = new GlobeFactory(new TextureStore(4), new SphereGeometry(1, 8, 4));
    const globe = factory.createInvented("S/2004 S 12");
    const geometry = globe.geometry;
    const map = globe.material.uniforms.uMapDay.value as Texture;
    const freedGeometry = vi.spyOn(geometry, "dispose");
    const freedMap = vi.spyOn(map, "dispose");
    factory.reshapeInvented(globe, "S/2004 S 13");
    expect(globe.geometry).not.toBe(geometry);
    expect(globe.material.uniforms.uMapDay.value).not.toBe(map);
    expect(freedGeometry).toHaveBeenCalledOnce();
    expect(freedMap).toHaveBeenCalledOnce();
  });

  it("frees the materials of a planet, its rings and its moons, but not the sphere all globes share", () => {
    const planet = { ...SATURN };
    const { factory, body } = build(planet);
    const shared = vi.spyOn(body.ball.geometry, "dispose");
    const freed = [body.ball.material, body.ring!.material, body.ring!.geometry, body.orbit.geometry, body.orbit.material].map((part) =>
      vi.spyOn(part, "dispose"),
    );
    factory.disposeBody(body);
    for (const spy of freed) expect(spy).toHaveBeenCalledOnce();
    expect(shared).not.toHaveBeenCalled();
  });
});
