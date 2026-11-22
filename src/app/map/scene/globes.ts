import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DataTexture,
  DoubleSide,
  GLSL3,
  Group,
  Line,
  LineBasicMaterial,
  LinearFilter,
  Mesh,
  OneFactor,
  RawShaderMaterial,
  RepeatWrapping,
  RingGeometry,
  Vector3,
  type IUniform,
  type SphereGeometry,
  type Texture,
} from "three";
import { inventedBody, loadShapeGrid, SHAPE_FRAGMENT, SHAPE_VERTEX, shapeMesh } from "@/app/globe/shape";
import { shapeGeometry } from "@/app/globe/shapeGeometry";
import { linearColor, type GlobeSpec } from "@/app/globe/spec";
import { stormUniforms } from "@/app/globe/storms";
import { surfaceDefines, surfaceUniforms, textureUrls, type TextureUrls } from "@/app/globe/uniforms";
import { hashText } from "@/shared/math";
import { EARTH_RADIUS_KM } from "@/shared/units";
import { layoutMoons, orbitPoint, type MoonLayout, type OrbitLayout } from "../orbits";
import type { MapPlanet, MapShape } from "../payload";
import { OCCLUDER_LAYER } from "./hazeLayer";
import { BALL_VERTEX, HAZE_FRAGMENT, MOON_FRAGMENT, PLANET_FRAGMENT, RING_FRAGMENT, RING_VERTEX } from "./shaders";
import type { SmallMoonsView } from "./smallMoonsView";
import type { TextureStore } from "./textureStore";

/** What planets and moons have in common: a globe drawn with the shader of the detail pages, and its orbit. */
export interface Globe {
  name: string;
  spec: GlobeSpec;
  /** Whether the high-resolution maps have been requested (see `sharpen`). */
  sharp: boolean;
  /** The group that moves along the orbit. It stays hidden until the maps have loaded. */
  anchor: Group;
  /** The tilted axis, scaled to the globe's radius in view units. Everything in it is measured in radii. */
  axis: Group;
  /** The globe mesh, which spins around the tilted axis: a sphere, or the shape of an irregular body. */
  ball: Mesh<BufferGeometry, RawShaderMaterial>;
  /** Whether the globe is drawn from a shape model, with its own geometry and the shader of shape.ts. */
  shaped: boolean;
  /**
   * The radius grid of a shape model once it has loaded. On the map the body is drawn from every
   * COARSE_SHAPE-th point of it, and `sharpen` rebuilds it in full when the camera follows it.
   */
  outline: { grid: Uint16Array | null; maxRadius: number; fine: boolean } | null;
  /** Whether the body tumbles instead of keeping one face to its planet. */
  tumbling: boolean;
  haze: Mesh<SphereGeometry, RawShaderMaterial> | null;
  /** The orbit, built with a semi-major axis of 1 and scaled to the current one. */
  orbit: Line<BufferGeometry, LineBasicMaterial>;
  /** The radius in view units at the current mix of scales, before the floor of a few pixels. */
  size: number;
  /** The semi-major axis in view units at the current mix of scales. */
  semiMajor: number;
}

export interface Body extends Globe {
  layout: OrbitLayout;
  ring: Mesh<RingGeometry, RawShaderMaterial> | null;
  /** The illustrated moon of an exoplanet, which belongs to its look. */
  moon: Mesh<SphereGeometry, RawShaderMaterial> | null;
  /** The real moons, created the first time the camera follows the planet, so that their maps load only then. */
  moons: Moon[] | null;
  /** The small moons as points, created with the large ones. */
  smallMoons: SmallMoonsView | null;
  /** 1 when shown, falling to 0 while another planet's moon system takes the stage. */
  presence: number;
  spin: number;
  spinStart: number;
}

export interface Moon extends Globe {
  layout: MoonLayout;
  /** The plane of the orbit, which is shown only while the camera follows the planet. */
  plane: Group;
}

/** A small moon the camera follows, with a shape and a surface made up from its name. */
export type InventedGlobe = Mesh<BufferGeometry, RawShaderMaterial>;

export const ORBIT_COLOR = 0x8fa3c8;
const ORBIT_SEGMENTS = 256;
/** Shape models on the map use every fourth point of their grids: about 4,000 triangles instead of 65,000. */
const COARSE_SHAPE = 4;

/** Returns an angle from 0 to 2π that is always the same for the same text. */
function scatterAngle(text: string): number {
  return ((hashText(text) % 3600) / 3600) * 2 * Math.PI;
}

/** The surface and the map of a small moon nobody has seen close up (see `inventedBody`). */
function inventedSurface(name: string): { geometry: BufferGeometry; map: DataTexture } {
  const invented = inventedBody(hashText(name));
  const geometry = shapeGeometry(shapeMesh(invented.grid, invented.maxRadius));
  // The map is display colour like the real ones.
  const map = new DataTexture(invented.map, invented.mapWidth, invented.mapHeight);
  map.wrapS = RepeatWrapping;
  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;
  return { geometry, map };
}

/**
 * Builds what the system view draws as globes: the planets with their rings, the moons, and the small
 * moon the camera follows. The view places them; here they get their meshes, shaders and maps.
 */
export class GlobeFactory {
  constructor(
    private readonly textures: TextureStore,
    /** The unit sphere every round globe is drawn from. */
    private readonly ballGeometry: SphereGeometry,
  ) {}

  /**
   * Builds the globe of a planet or moon, with its haze and an orbit line of semi-major axis 1. The globe
   * stays hidden until its maps have loaded so that it does not flash black; a map that fails to load also
   * counts as done, so it never stays hidden for ever. The caller adds its own parts to `axis` and then
   * calls `ready`.
   */
  private createGlobe(
    name: string,
    spec: GlobeSpec,
    orbit: { eccentricity: number; periapsis: number },
    shape: MapShape | null = null,
  ): Globe & { uniforms: Record<string, IUniform>; ready: () => void } {
    const { textures } = this;
    // On its orbit a globe is only a few dozen pixels wide, so the small maps are enough until the
    // camera follows it (see `sharpen`).
    const urls: Omit<TextureUrls, "day"> & { day: string | null } = textureUrls(spec, "sm");
    // An irregular body without a map is drawn in its colour; asking for its map would only fail.
    if (shape && !shape.map) urls.day = null;

    const anchor = new Group();
    const axis = new Group();
    axis.rotation.z = (-spec.tiltDeg * Math.PI) / 180;
    anchor.add(axis);

    let pending = 1;
    const loaded = () => {
      pending--;
      if (pending === 0) anchor.visible = true;
    };
    const map = (url: string | null) => {
      if (!url) return textures.blank;
      pending++;
      return textures.get(url, loaded);
    };
    anchor.visible = false;

    const uniforms: Record<string, IUniform> = {
      uTime: { value: 0 },
      uDetail: { value: 0 },
      uMapDay: { value: map(urls.day) },
      uMapNight: { value: map(urls.night) },
      uMapClouds: { value: map(urls.clouds) },
      uRingMap: { value: map(urls.ring) },
      uMapRelief: { value: textures.blank },
      uMapRelief2: { value: textures.blank },
      uMapFlow: { value: textures.blank },
      uNoise: { value: textures.noise },
      uLightObject: { value: new Vector3() },
      uCameraObject: { value: new Vector3() },
    };
    // A planet is drawn without relief if a relief map cannot be read (they are AVIF, which old browsers lack),
    // and with clouds that stand still if its flow map cannot: mid grey is level ground and calm air.
    const spare = (name: string, url: string | null) => {
      if (!url) return;
      pending++;
      textures.spare(uniforms[name], url, loaded);
    };
    spare("uMapRelief", urls.relief);
    spare("uMapRelief2", urls.relief2);
    spare("uMapFlow", urls.flow);
    let ball: Globe["ball"];
    let outline: Globe["outline"] = null;
    if (shape) {
      const loading: NonNullable<Globe["outline"]> = { grid: null, maxRadius: shape.maxRadius, fine: false };
      outline = loading;
      // An irregular body keeps the uniforms the planets' updates set, though its shader reads few of them.
      uniforms.uHasMap = { value: shape.map ? 1 : 0 };
      uniforms.uTint = { value: linearColor(spec.palette[1]) };
      uniforms.uLight = { value: linearColor(spec.light) };
      ball = new Mesh(
        new BufferGeometry(),
        new RawShaderMaterial({ glslVersion: GLSL3, vertexShader: SHAPE_VERTEX, fragmentShader: SHAPE_FRAGMENT, uniforms }),
      );
      // The globe stays hidden until its shape has loaded too.
      pending++;
      loadShapeGrid(shape.url)
        .then((grid) => {
          loading.grid = grid;
          ball.geometry.dispose();
          ball.geometry = shapeGeometry(shapeMesh(grid, shape.maxRadius, loading.fine ? 1 : COARSE_SHAPE));
        })
        .catch((error) => console.warn(`The shape of ${name} could not be loaded.`, error))
        .finally(loaded);
    } else {
      for (const [key, value] of Object.entries({ ...surfaceUniforms(spec), ...stormUniforms(spec, 0) })) uniforms[key] = { value };
      ball = new Mesh(
        this.ballGeometry,
        new RawShaderMaterial({
          glslVersion: GLSL3,
          vertexShader: BALL_VERTEX,
          fragmentShader: PLANET_FRAGMENT,
          // The defines ensure that only the shader code this globe needs is compiled.
          defines: { ...surfaceDefines(spec) },
          uniforms,
        }),
      );
    }
    // Fast-spinning giants are flattened at the poles.
    ball.scale.set(1, 1 - spec.flattening, 1);
    axis.add(ball);

    let haze: Globe["haze"] = null;
    if (spec.atmosphere) {
      // The glow is a thin line (limbGlow in surface.glsl.ts), which has faded out well within this shell.
      const shell = 1.05;
      haze = new Mesh(
        this.ballGeometry,
        new RawShaderMaterial({
          glslVersion: GLSL3,
          vertexShader: BALL_VERTEX,
          fragmentShader: HAZE_FRAGMENT,
          uniforms: {
            uColor: { value: linearColor(spec.atmosphere.color) },
            uDensity: { value: spec.atmosphere.density },
            uStrength: { value: surfaceDefines(spec).AIR ? 1 : 0.35 },
            uShell: { value: shell },
            uLightObject: { value: new Vector3() },
            uCameraObject: { value: new Vector3() },
          },
          side: BackSide,
          transparent: true,
          depthWrite: false,
          blending: CustomBlending,
          blendSrc: OneFactor,
          blendDst: OneFactor,
        }),
      );
      haze.scale.set(shell, shell * (1 - spec.flattening), shell);
      axis.add(haze);
    }

    // Globes hide the faint lines of the haze behind them.
    ball.layers.enable(OCCLUDER_LAYER);
    const points = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      const [x, y] = orbitPoint(1, orbit.eccentricity, orbit.periapsis, (i / ORBIT_SEGMENTS) * 2 * Math.PI);
      points.set([x, 0, -y], i * 3);
    }
    const orbitGeometry = new BufferGeometry();
    orbitGeometry.setAttribute("position", new BufferAttribute(points, 3));
    const orbitLine = new Line(
      orbitGeometry,
      new LineBasicMaterial({ color: ORBIT_COLOR, transparent: true, opacity: 0.3, depthWrite: false }),
    );

    return {
      name,
      spec,
      // Without a map there is nothing sharper to load.
      sharp: shape !== null && !shape.map,
      anchor,
      axis,
      ball,
      haze,
      orbit: orbitLine,
      size: 1,
      semiMajor: 1,
      shaped: shape !== null,
      outline,
      tumbling: shape?.tumbling ?? false,
      uniforms,
      ready: loaded,
    };
  }

  createBody(planet: MapPlanet, layout: OrbitLayout): Body {
    const spec = planet.globe;
    const globe = this.createGlobe(planet.name, spec, layout, planet.shape);
    const { axis, ball, uniforms } = globe;

    let ring: Body["ring"] = null;
    if (spec.rings) {
      ring = new Mesh(
        new RingGeometry(spec.rings.inner, spec.rings.outer, 160, 1),
        new RawShaderMaterial({
          glslVersion: GLSL3,
          vertexShader: RING_VERTEX,
          fragmentShader: RING_FRAGMENT,
          defines: ball.material.defines,
          // The rings share the planet's uniforms so they use the same maps and lighting. Only the light
          // and camera directions are separate, because the disc does not spin with the planet.
          uniforms: {
            ...uniforms,
            uLightObject: { value: new Vector3() },
            uCameraObject: { value: new Vector3() },
          },
          side: DoubleSide,
          transparent: true,
          depthWrite: false,
        }),
      );
      // RingGeometry is built upright, so it is laid flat into the equatorial plane.
      ring.rotation.x = -Math.PI / 2;
      axis.add(ring);
    }

    let moon: Body["moon"] = null;
    if (spec.moon) {
      moon = new Mesh(
        this.ballGeometry,
        new RawShaderMaterial({
          glslVersion: GLSL3,
          vertexShader: BALL_VERTEX,
          fragmentShader: MOON_FRAGMENT,
          uniforms: {
            uSeed: uniforms.uSeed,
            uLight: uniforms.uLight,
            uNoise: uniforms.uNoise,
            uLightObject: { value: new Vector3() },
          },
        }),
      );
      moon.scale.setScalar(spec.moon.size);
      // The moon is attached to the tilted axis so that its orbit lies in the planet's equatorial plane.
      axis.add(moon);
    }

    globe.ready();
    return {
      ...globe,
      layout,
      ring,
      moon,
      moons: null,
      smallMoons: null,
      presence: 1,
      spin: spec.spin,
      spinStart: ((spec.seed * 0.618) % 1) * Math.PI * 2,
    };
  }

  /**
   * Creates the real moons of a planet. Each orbit lies in a plane tilted by the moon's inclination
   * against the planet's equator, or against the ecliptic for the Moon, and travels with the planet.
   */
  createMoons(planet: MapPlanet, body: Body): Moon[] {
    const layouts = layoutMoons(
      planet.moons,
      { radiusKm: (planet.radiusEarth ?? 1) * EARTH_RADIUS_KM, size: body.layout.size, reach: body.spec.rings?.outer ?? 1 },
      hashText(planet.slug),
    );
    return layouts.map((layout) => {
      const data = planet.moons[layout.index];
      const globe = this.createGlobe(data.name, data.globe, layout, data.shape);
      const plane = new Group();
      // With the order "YXZ" three.js tilts the orbit about x by the inclination first and then turns its
      // ascending node about the axis to a fixed but arbitrary direction.
      plane.rotation.set((data.inclinationDeg * Math.PI) / 180, scatterAngle(data.slug), 0, "YXZ");
      plane.add(globe.anchor, globe.orbit);
      plane.visible = false;
      const reference = new Group();
      if (!data.ecliptic) reference.rotation.z = (-body.spec.tiltDeg * Math.PI) / 180;
      reference.add(plane);
      body.anchor.add(reference);
      globe.ready();
      return { ...globe, layout, plane };
    });
  }

  /**
   * Replaces the small maps of a planet or moon with the large ones, each as soon as it has loaded, and
   * builds a shape model in full. This happens once, when the camera first follows it.
   */
  sharpen(globe: Globe): void {
    const { outline } = globe;
    if (outline && !outline.fine) {
      // If the grid is still loading, it is built in full when it arrives.
      outline.fine = true;
      if (outline.grid) {
        globe.ball.geometry.dispose();
        globe.ball.geometry = shapeGeometry(shapeMesh(outline.grid, outline.maxRadius));
      }
    }
    if (globe.sharp) return;
    globe.sharp = true;
    const urls = textureUrls(globe.spec, "lg");
    // The rings share these uniforms with the planet, so they are updated as well.
    const { uniforms } = globe.ball.material;
    const swap = (name: string, url: string | null) => {
      if (!url) return;
      this.textures.get(url, (texture) => {
        if (texture) uniforms[name].value = texture;
      });
    };
    swap("uMapDay", urls.day);
    swap("uMapNight", urls.night);
    swap("uMapClouds", urls.clouds);
    swap("uMapRelief", urls.relief);
    swap("uMapRelief2", urls.relief2);
  }

  /** Creates the globe of a followed small moon. It stays hidden until the view has placed it. */
  createInvented(name: string): InventedGlobe {
    const { geometry, map } = inventedSurface(name);
    const globe: InventedGlobe = new Mesh(
      geometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SHAPE_VERTEX,
        fragmentShader: SHAPE_FRAGMENT,
        uniforms: {
          uMapDay: { value: map },
          uHasMap: { value: 1 },
          uTint: { value: [0, 0, 0] },
          uLight: { value: [1, 1, 1] },
          uLightObject: { value: new Vector3() },
          uCameraObject: { value: new Vector3() },
        },
      }),
    );
    globe.visible = false;
    globe.layers.enable(OCCLUDER_LAYER);
    return globe;
  }

  /** Gives the globe of a followed small moon the shape and surface of another one. */
  reshapeInvented(globe: InventedGlobe, name: string): void {
    const { geometry, map } = inventedSurface(name);
    globe.geometry.dispose();
    (globe.material.uniforms.uMapDay.value as Texture).dispose();
    globe.geometry = geometry;
    globe.material.uniforms.uMapDay.value = map;
  }

  disposeBody(body: Body): void {
    for (const globe of [body, ...(body.moons ?? [])]) {
      globe.ball.material.dispose();
      if (globe.shaped) globe.ball.geometry.dispose();
      globe.haze?.material.dispose();
      globe.orbit.geometry.dispose();
      globe.orbit.material.dispose();
    }
    body.ring?.geometry.dispose();
    body.ring?.material.dispose();
    body.moon?.material.dispose();
    body.smallMoons?.dispose();
  }

  disposeInvented(globe: InventedGlobe): void {
    globe.geometry.dispose();
    (globe.material.uniforms.uMapDay.value as Texture).dispose();
    globe.material.dispose();
  }
}
