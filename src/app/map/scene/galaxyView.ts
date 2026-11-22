import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DataTexture,
  GLSL3,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RawShaderMaterial,
  Scene,
  Vector3,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { clamp, smoothstep } from "@/shared/math";
import { isSpecialStar, SPECIAL_STAR_COLOR } from "@/app/stars/my-special-star/star";
import { GALACTIC_CENTRE, GALAXY_EDGE, starColor } from "../galaxy";
import type { MapStar } from "../payload";
import type { LabelKind, LabelLayer } from "./labels";
import {
  COPY_FRAGMENT,
  GALAXY_GLOW_FRAGMENT,
  HOSTS_FRAGMENT,
  HOSTS_VERTEX,
  SCREEN_VERTEX,
} from "./shaders";
import { createSky, type Sky } from "./sky";
import { CLOUD_SHARE, GalaxyCloudsView } from "./galaxyCloudsView";
import { loadPicture, type Picture } from "./picture";
import { ShaderGate } from "./shaderGate";
import { StarfieldView } from "./starfieldView";

/** The size of the drawing area in CSS pixels and the number of device pixels per CSS pixel. */
export interface Viewport {
  width: number;
  height: number;
  pixelRatio: number;
}

/** An automatic camera move, for example to a star. */
interface Flight {
  /** The point the camera looks at while it approaches or leaves it. */
  focus: Vector3;
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
}

/**
 * Integrating the galaxy's light along every line of sight is expensive per pixel, so the glow is
 * rendered into a target of at most this many pixels and stretched over the screen.
 */
const GLOW_PIXELS = 1_300_000;
/** The fade-in time in seconds of the galaxy model once its picture has arrived. */
const ARRIVAL_SECONDS = 0.6;
/**
 * Distance ranges in parsecs over which the sky photo fades out and the computed model fades in.
 * The disc is thin, so height above it counts HEIGHT_COUNTS times as much as distance along it.
 */
const SKY_RANGE: readonly [number, number] = [150, 900];
const MODEL_RANGE: readonly [number, number] = [100, 700];
const HEIGHT_COUNTS = 4;
/** The start position, a few parsecs from the Sun and looking past it towards the galactic centre. */
const HOME = new Vector3(-9, -6.5, 4);
const OVERVIEW = new Vector3(GALACTIC_CENTRE[0] - 15000, -13000, 21000);
const CENTRE = new Vector3(...GALACTIC_CENTRE);
/**
 * The edge length in pixels at which the artist's impression is read for the stars, clouds and glow.
 * More is not needed, because from afar the clouds carry the detail and the glow samples a blurred copy.
 */
const PICTURE_SIZE = 512;
/** The minimum and maximum orbit distance from the galactic centre in parsecs. */
const ORBIT_RANGE: readonly [number, number] = [400, 120_000];
/** The distance in parsecs from a star at which a flight to it ends. */
const ARRIVAL_DISTANCE = 0.45;
/** The number of stars near the camera that get a label. */
const LABELLED_NEIGHBOURS = 8;
/** The number of nearby candidates considered for a label, since some are behind the camera or off screen. */
const NEIGHBOUR_CANDIDATES = 40;
const NEIGHBOUR_RANGE = 45;
/** The maximum distance in CSS pixels between a click and a star for the click to select it. */
const PICK_RADIUS = 14;
/** The special star near the galactic centre is labelled when the camera is closer than this many parsecs. */
const SPECIAL_STAR_REVEAL = 3000;

const additive = { blending: CustomBlending, blendSrc: OneFactor, blendDst: OneFactor } as const;

/**
 * Renders the planet-hosting stars at their real positions, the Milky Way around them and a camera
 * that flies freely or orbits the galactic centre (`setOrbit`). Lengths are in parsecs, the Sun is at
 * the origin and z points to galactic north. Near the Sun the sky is a photo of the real Milky Way;
 * further out the photo would be wrong, so it fades into the computed galaxy model.
 */
export class GalaxyView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.0005, 500_000);

  selected: number | null = null;
  hovered: number | null = null;

  private stars: MapStar[] = [];
  private coords = new Float32Array(0);
  private sunIndex = -1;
  private specialIndex = -1;
  private hosts: Points<BufferGeometry, RawShaderMaterial> | null = null;
  private readonly sky: Sky;
  /** The procedural stars without known planets, generated around the camera. */
  private readonly field: StarfieldView;
  /** The galaxy as a volume of clouds, used for the view from afar. */
  private readonly clouds: GalaxyCloudsView;
  /** The glow is rendered into its own low-resolution target and then drawn onto the screen (see GLOW_PIXELS). */
  private readonly glow: {
    scene: Scene;
    source: Mesh<PlaneGeometry, RawShaderMaterial>;
    target: WebGLRenderTarget;
    screen: Mesh<PlaneGeometry, RawShaderMaterial>;
  };
  /** The inputs the glow was last rendered with. While they stay the same, the previous result is reused. */
  private drawnFrom = "";
  /**
   * The artist's impression of the galaxy. The glow texture is only created from it once the camera
   * leaves the Sun's neighbourhood, where the sky photo is enough. `arrived` then runs from 0 to 1 so
   * that the galaxy fades in.
   */
  private readonly picture: Promise<Picture>;
  private glowMap: DataTexture | null = null;
  private arrived = 0;
  private readonly gate = new ShaderGate();

  private readonly position = HOME.clone();
  private yaw = 0;
  private pitch = 0;
  private readonly velocity = new Vector3();
  private dolly = 0;
  private flight: Flight | null = null;
  /** The point the camera orbits and looks at, or null during free flight. */
  private pivot: Vector3 | null = null;
  /** Called whenever the camera starts or stops orbiting. */
  onOrbitChange: (orbiting: boolean) => void = () => {};
  /** The camera speed at normal pace in parsecs per second. */
  private pace = 1;
  private neighbours: { index: number; distance: number }[] = [];
  private readonly viewProjection = new Matrix4();
  private readonly scratch = new Vector3();

  /** `pictureUrl` is the URL of the artist's impression of the galaxy. */
  constructor(skyTexture: Texture, pictureUrl: string) {
    this.camera.up.set(0, 0, 1);
    this.lookAt(new Vector3(0, 0, 0));

    this.sky = createSky(skyTexture, new Matrix3());
    this.scene.add(this.sky.mesh);
    // The picture is loaded once and shared by the starfield plan, the clouds and the glow.
    this.picture = loadPicture(pictureUrl, PICTURE_SIZE);
    const linear = this.picture.then((picture) => picture.linear);
    this.field = new StarfieldView(linear, PICTURE_SIZE);
    this.scene.add(this.field.group);
    this.clouds = new GalaxyCloudsView(linear, PICTURE_SIZE, (clusters) => this.field.addClusters(clusters));

    const source = new Mesh(
      new PlaneGeometry(2, 2),
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SCREEN_VERTEX,
        fragmentShader: GALAXY_GLOW_FRAGMENT,
        uniforms: {
          uMap: { value: null },
          uEye: { value: new Vector3() },
          uForward: { value: new Vector3() },
          uRight: { value: new Vector3() },
          uUp: { value: new Vector3() },
          uFade: { value: 0 },
          uOutside: { value: 1 },
          uClouds: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    source.frustumCulled = false;
    const target = new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    });
    const screen = new Mesh(
      new PlaneGeometry(2, 2),
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SCREEN_VERTEX,
        fragmentShader: COPY_FRAGMENT,
        uniforms: { uMap: { value: target.texture } },
        depthTest: false,
        depthWrite: false,
        transparent: true,
        ...additive,
      }),
    );
    screen.frustumCulled = false;
    screen.renderOrder = 1;
    this.scene.add(screen);
    // The clouds are rendered into the same low-resolution target after the glow, because they are
    // just as soft and their dust must darken the glow behind it.
    this.glow = { scene: new Scene().add(source, this.clouds.group), source, target, screen };
  }

  /** Renders the galaxy. Call this after `update`. */
  render(renderer: WebGLRenderer, viewport: Viewport): void {
    const { scene, source, target, screen } = this.glow;
    const scale = Math.min(1, Math.sqrt(GLOW_PIXELS / (viewport.width * viewport.height)));
    const width = Math.max(1, Math.round(viewport.width * scale));
    const height = Math.max(1, Math.round(viewport.height * scale));
    if (target.width !== width || target.height !== height) target.setSize(width, height);
    // Once its texture exists, the glow shader is compiled in the background so that it can fade in
    // when it is ready (see `update`).
    if (source.material.uniforms.uMap.value && !this.gate.isReady(source.material)) {
      renderer.setRenderTarget(target);
      this.gate.prepare(renderer, scene, this.camera);
      renderer.setRenderTarget(null);
    }
    screen.visible = source.material.uniforms.uFade.value > 0.001;
    if (screen.visible) {
      // The glow is the most expensive part of the frame, so it is only re-rendered when its inputs change.
      const { uEye, uForward, uRight, uUp, uFade, uOutside, uClouds } = source.material.uniforms;
      const from = JSON.stringify([width, height, uEye.value, uForward.value, uRight.value, uUp.value, uFade.value, uOutside.value, uClouds.value]);
      if (from !== this.drawnFrom) {
        renderer.setRenderTarget(target);
        const complete = this.gate.render(renderer, scene, this.camera);
        renderer.setRenderTarget(null);
        // If some objects were skipped because their shaders were still compiling, it is redrawn next frame.
        this.drawnFrom = complete ? from : "";
      }
    }
    this.gate.render(renderer, this.scene, this.camera);
  }

  /** Sets the planet-hosting stars. This is called once, after they have loaded. */
  setStars(stars: MapStar[]): void {
    this.stars = stars;
    this.coords = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const weights = new Float32Array(stars.length);
    stars.forEach(([slug, , x, y, z, teffK, planetCount], index) => {
      this.coords.set([x, y, z], index * 3);
      const special = isSpecialStar(slug);
      colors.set(special ? SPECIAL_STAR_COLOR : starColor(teffK), index * 3);
      weights[index] = special ? 1 : Math.min((planetCount - 1) / 6, 1);
      if (slug === "sun") this.sunIndex = index;
      if (special) this.specialIndex = index;
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.coords, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("weight", new BufferAttribute(weights, 1));
    this.hosts = new Points(
      geometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: HOSTS_VERTEX,
        fragmentShader: HOSTS_FRAGMENT,
        uniforms: { uPixelsPerUnit: { value: 1 }, uPixelRatio: { value: 1 } },
        depthTest: false,
        depthWrite: false,
        transparent: true,
        ...additive,
      }),
    );
    this.hosts.frustumCulled = false;
    this.hosts.renderOrder = 2;
    this.scene.add(this.hosts);
  }

  /**
   * Turns the view by a pointer drag in pixels, as if the sky were grabbed and pulled. While orbiting,
   * it rotates the camera around the pivot instead.
   */
  drag(dx: number, dy: number): void {
    this.flight = null;
    if (this.pivot) {
      this.circle(this.pivot, -dx * 0.005, dy * 0.005, 1);
      return;
    }
    this.yaw += dx * 0.0032;
    this.pitch = clamp(this.pitch + dy * 0.0032, -1.55, 1.55);
  }

  /**
   * Moves the camera forwards for positive amounts and backwards for negative ones, or towards the pivot
   * while orbiting. One mouse wheel notch is about 1.
   */
  push(amount: number): void {
    this.flight = null;
    this.dolly = clamp(this.dolly + amount * 0.3, -3, 3);
  }

  get orbiting(): boolean {
    return this.pivot !== null;
  }

  /** Switches between orbiting the galactic centre and free flight. Orbiting starts with a turn towards the centre. */
  setOrbit(on: boolean, instantly = false): void {
    if (on === this.orbiting) return;
    this.pivot = on ? CENTRE.clone() : null;
    if (on) {
      // Inside the minimum orbit distance there is nothing to orbit, so the camera is moved out first.
      if (this.position.distanceTo(CENTRE) < ORBIT_RANGE[0]) this.position.set(CENTRE.x - ORBIT_RANGE[0] * 3, CENTRE.y, CENTRE.z + ORBIT_RANGE[0]);
      this.fly(CENTRE, this.position.clone(), instantly);
    }
    this.onOrbitChange(on);
  }

  flyToStar(index: number, instantly = false): void {
    this.setOrbit(false);
    const star = this.starPosition(index, new Vector3());
    const away = this.position.clone().sub(star);
    if (away.lengthSq() < 1e-8) away.set(-1, -0.6, 0.4);
    this.fly(star, star.clone().addScaledVector(away.normalize(), ARRIVAL_DISTANCE), instantly);
  }

  flyHome(instantly = false): void {
    this.setOrbit(false);
    this.fly(new Vector3(0, 0, 0), HOME, instantly);
  }

  /** Flies out to view the whole galaxy and then orbits its centre. */
  flyToOverview(instantly = false): void {
    this.fly(CENTRE, OVERVIEW, instantly);
    if (!this.pivot) {
      this.pivot = CENTRE.clone();
      this.onOrbitChange(true);
    }
  }

  /**
   * Moves the camera around `pivot` by `turn` (around galactic north) and `tilt` (up or down) in radians,
   * and multiplies its distance by `scale`. The camera keeps looking at the pivot.
   */
  private circle(pivot: Vector3, turn: number, tilt: number, scale: number): void {
    const offset = this.scratch.copy(this.position).sub(pivot);
    const distance = clamp(Math.max(offset.length(), 1) * scale, ORBIT_RANGE[0], ORBIT_RANGE[1]);
    const azimuth = Math.atan2(offset.y, offset.x) + turn;
    const elevation = clamp(Math.asin(clamp(offset.z / Math.max(offset.length(), 1), -1, 1)) + tilt, -1.5, 1.5);
    const cos = Math.cos(elevation);
    this.position.set(
      pivot.x + distance * cos * Math.cos(azimuth),
      pivot.y + distance * cos * Math.sin(azimuth),
      pivot.z + distance * Math.sin(elevation),
    );
    this.lookAt(pivot);
  }

  private fly(focus: Vector3, to: Vector3, instantly: boolean): void {
    this.velocity.set(0, 0, 0);
    this.dolly = 0;
    if (instantly) {
      this.flight = null;
      this.position.copy(to);
      this.lookAt(focus);
      return;
    }
    const before = Math.max(this.position.distanceTo(focus), 1e-3);
    const after = Math.max(to.distanceTo(focus), 1e-3);
    const sideways = this.position.distanceTo(to) / Math.max(before, after);
    this.flight = {
      focus: focus.clone(),
      from: this.position.clone(),
      to: to.clone(),
      elapsed: 0,
      duration: clamp(1.4 + 0.3 * Math.abs(Math.log(before / after)) + 0.6 * sideways, 1.4, 5),
    };
  }

  private lookAt(point: Vector3): void {
    const d = this.scratch.copy(point).sub(this.position);
    if (d.lengthSq() < 1e-12) return;
    this.yaw = Math.atan2(d.y, d.x);
    this.pitch = Math.atan2(d.z, Math.hypot(d.x, d.y));
  }

  /** Advances the camera by `dt` seconds. `keys` holds the codes of the keys that are currently pressed. */
  update(dt: number, keys: ReadonlySet<string>, viewport: Viewport): void {
    this.measureSurroundings();

    const cosPitch = Math.cos(this.pitch);
    const forward = new Vector3(
      cosPitch * Math.cos(this.yaw),
      cosPitch * Math.sin(this.yaw),
      Math.sin(this.pitch),
    );
    const right = new Vector3(Math.sin(this.yaw), -Math.cos(this.yaw), 0);

    const shift = keys.has("ShiftLeft") || keys.has("ShiftRight");
    if (this.pivot) {
      const fast = shift ? 3 : 1;
      // While orbiting, the keys rotate around the pivot and move towards or away from it.
      const axis = (plus: string[], minus: string[]) =>
        (plus.some((key) => keys.has(key)) ? 1 : 0) - (minus.some((key) => keys.has(key)) ? 1 : 0);
      const sideways = axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]);
      const upwards = axis(["KeyE", "Space"], ["KeyQ", "KeyC"]);
      const nearer = axis(["KeyW", "ArrowUp"], ["KeyS", "ArrowDown"]);
      if (sideways || upwards || nearer) this.flight = null;
      if (this.flight) {
        this.advanceFlight(this.flight, dt);
      } else {
        this.velocity.set(0, 0, 0);
        const step = this.dolly * (1 - Math.exp(-dt * 9));
        this.dolly -= step;
        const turn = sideways * dt * 0.8 * fast;
        const tilt = upwards * dt * 0.8;
        const scale = Math.exp(-step * 0.7 - nearer * dt * 1.2 * fast);
        // Without input the position is not recomputed, because rounding errors would shift it slightly
        // and invalidate the cached glow every time.
        if (turn !== 0 || tilt !== 0 || Math.abs(scale - 1) > 1e-7) this.circle(this.pivot, turn, tilt, scale);
      }
    }

    const wish = new Vector3();
    if (!this.pivot) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) wish.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) wish.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) wish.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) wish.sub(right);
      if (keys.has("KeyE") || keys.has("Space")) wish.z += 1;
      if (keys.has("KeyQ") || keys.has("KeyC")) wish.z -= 1;
    }
    if (wish.lengthSq() > 0) {
      this.flight = null;
      wish.normalize().multiplyScalar(this.pace * (shift ? 6 : 1));
    }

    if (this.pivot) {
      // In orbit mode the camera was already moved above.
    } else if (this.flight) {
      this.advanceFlight(this.flight, dt);
    } else {
      // The velocity eases towards the key input so that starting and stopping do not jerk.
      this.velocity.lerp(wish, 1 - Math.exp(-dt * 7));
      this.position.addScaledVector(this.velocity, dt);
      const step = this.dolly * (1 - Math.exp(-dt * 9));
      this.dolly -= step;
      this.position.addScaledVector(forward, step * this.pace * 1.6);
      if (this.position.length() > 150_000) this.position.setLength(150_000);
    }

    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.position);
    const cos = Math.cos(this.pitch);
    this.camera.lookAt(
      this.position.x + cos * Math.cos(this.yaw),
      this.position.y + cos * Math.sin(this.yaw),
      this.position.z + Math.sin(this.pitch),
    );
    this.camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);

    // This is the number of CSS pixels that one parsec covers at a distance of one parsec.
    const cssPixelsPerUnit = viewport.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const pixelsPerUnit = cssPixelsPerUnit * viewport.pixelRatio;
    // This measures how far the view differs from the one from the Sun, weighting height more.
    const away = Math.hypot(this.position.x, this.position.y, this.position.z * HEIGHT_COUNTS);
    const photographed = 1 - smoothstep(SKY_RANGE[0], SKY_RANGE[1], away);
    this.sky.setOpacity(photographed);
    this.field.update(this.camera, photographed, viewport.pixelRatio);
    const wanted = smoothstep(MODEL_RANGE[0], MODEL_RANGE[1], away);
    const glow = this.glow.source.material.uniforms;
    if (wanted > 0 && !this.glowMap) {
      this.glowMap = new DataTexture();
      this.picture.then(
        (picture) => {
          if (!this.glowMap) return;
          this.glowMap.image = { data: rowsFromBottom(picture), width: picture.size, height: picture.size };
          this.glowMap.generateMipmaps = true;
          this.glowMap.minFilter = LinearMipmapLinearFilter;
          this.glowMap.magFilter = LinearFilter;
          this.glowMap.needsUpdate = true;
          glow.uMap.value = this.glowMap;
        },
        // If the picture fails to load, there is no galaxy model and only the sky photo is shown.
        () => {},
      );
    }
    // The galaxy fades in once its texture is set and its shader is compiled.
    if (glow.uMap.value && this.gate.isReady(this.glow.source.material)) {
      this.arrived = Math.min(1, this.arrived + dt / ARRIVAL_SECONDS);
    }
    const fade = wanted * this.arrived;
    // The shader builds each pixel's view ray as forward plus scaled right and up vectors.
    const reach = Math.tan((this.camera.fov * Math.PI) / 360);
    const view = this.camera.matrixWorld.elements;
    glow.uFade.value = fade;
    // This is 0 inside the disc, where the galaxy surrounds the camera, and 1 outside it (see GALAXY_GLOW_FRAGMENT).
    const fromCentre = Math.hypot(this.position.x - CENTRE.x, this.position.y - CENTRE.y);
    const outside = Math.max(
      smoothstep(200, 1500, Math.abs(this.position.z)),
      smoothstep(GALAXY_EDGE * 0.8, GALAXY_EDGE, fromCentre),
    );
    glow.uOutside.value = outside;
    // Once the clouds exist, they take over part of the flat sheet's light.
    glow.uClouds.value = this.clouds.ready ? CLOUD_SHARE : 0;
    // The clouds are rendered into the glow target, which has fewer pixels than the screen (GLOW_PIXELS).
    const glowScale = Math.min(1, Math.sqrt(GLOW_PIXELS / (viewport.width * viewport.height)));
    this.clouds.update(cssPixelsPerUnit * glowScale, 1, fade * outside, this.position);
    this.field.showClusters(fade * outside);
    (glow.uEye.value as Vector3).copy(this.position);
    (glow.uRight.value as Vector3).set(view[0], view[1], view[2]).multiplyScalar(reach * this.camera.aspect);
    (glow.uUp.value as Vector3).set(view[4], view[5], view[6]).multiplyScalar(reach);
    (glow.uForward.value as Vector3).set(-view[8], -view[9], -view[10]);
    if (this.hosts) {
      this.hosts.material.uniforms.uPixelsPerUnit.value = pixelsPerUnit;
      this.hosts.material.uniforms.uPixelRatio.value = viewport.pixelRatio;
    }
  }

  private advanceFlight(flight: Flight, dt: number): void {
    flight.elapsed += dt;
    const t = Math.min(flight.elapsed / flight.duration, 1);
    const eased = t * t * t * (t * (t * 6 - 15) + 10);

    // The distance to the focus is interpolated logarithmically, so the approach slows down naturally
    // however long the flight is.
    const start = flight.from.clone().sub(flight.focus);
    const end = flight.to.clone().sub(flight.focus);
    const startDistance = Math.max(start.length(), 1e-3);
    const endDistance = Math.max(end.length(), 1e-3);
    const distance = Math.exp(
      Math.log(startDistance) + (Math.log(endDistance) - Math.log(startDistance)) * eased,
    );
    const direction = start.normalize().lerp(end.normalize(), eased);
    if (direction.lengthSq() < 1e-8) direction.copy(end);
    this.position.copy(flight.focus).addScaledVector(direction.normalize(), distance);

    // The camera turns towards the focus the short way round.
    const d = this.scratch.copy(flight.focus).sub(this.position);
    const blend = Math.max(1 - Math.exp(-dt * 6), eased * eased);
    const wantYaw = Math.atan2(d.y, d.x);
    const wantPitch = Math.atan2(d.z, Math.hypot(d.x, d.y));
    let turn = (wantYaw - this.yaw) % (2 * Math.PI);
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    this.yaw += turn * blend;
    this.pitch += (wantPitch - this.pitch) * blend;

    if (t >= 1) this.flight = null;
  }

  /** Finds the stars near the camera, which set the flight speed and get labels. */
  private measureSurroundings(): void {
    const { x, y, z } = this.position;
    const near: { index: number; distance: number }[] = [];
    let nearest = Infinity;
    for (let i = 0; i < this.stars.length; i++) {
      const dx = this.coords[i * 3] - x;
      const dy = this.coords[i * 3 + 1] - y;
      const dz = this.coords[i * 3 + 2] - z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < nearest) nearest = distance;
      if (distance > NEIGHBOUR_RANGE) continue;
      if (near.length === NEIGHBOUR_CANDIDATES && distance >= near[near.length - 1].distance) continue;
      let slot = near.length;
      while (slot > 0 && near[slot - 1].distance > distance) slot--;
      near.splice(slot, 0, { index: i, distance });
      if (near.length > NEIGHBOUR_CANDIDATES) near.pop();
    }
    this.neighbours = near;
    // The camera moves slowly between close stars and fast through empty space.
    const fromSun = this.position.length();
    this.pace = Math.max(0.25, fromSun * 0.03, Number.isFinite(nearest) ? nearest * 0.8 : 1);
  }

  starPosition(index: number, out: Vector3): Vector3 {
    return out.set(this.coords[index * 3], this.coords[index * 3 + 1], this.coords[index * 3 + 2]);
  }

  /** Returns the distance from the camera to a star in parsecs. */
  distanceTo(index: number): number {
    return this.starPosition(index, this.scratch).distanceTo(this.position);
  }

  /** Projects a point to screen coordinates in CSS pixels plus its clip-space w, or returns null if it is behind the camera. */
  private project(x: number, y: number, z: number, viewport: Viewport): [number, number, number] | null {
    const m = this.viewProjection.elements;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 1e-6) return null;
    const sx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    const sy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    return [(sx * 0.5 + 0.5) * viewport.width, (0.5 - sy * 0.5) * viewport.height, w];
  }

  /** Returns the star under the point (x, y) in CSS pixels, or null. */
  pick(x: number, y: number, viewport: Viewport): number | null {
    let best: number | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < this.stars.length; i++) {
      const point = this.project(this.coords[i * 3], this.coords[i * 3 + 1], this.coords[i * 3 + 2], viewport);
      if (!point) continue;
      const offset = Math.hypot(point[0] - x, point[1] - y);
      if (offset > PICK_RADIUS) continue;
      // The score mainly favours the star closest to the pointer, but a much nearer star beats one far behind it.
      const score = offset + Math.log10(point[2] + 1) * 3;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  drawLabels(labels: LabelLayer, viewport: Viewport): void {
    const inside = (point: [number, number, number] | null): point is [number, number, number] =>
      point !== null &&
      point[0] > -50 &&
      point[0] < viewport.width + 50 &&
      point[1] > -20 &&
      point[1] < viewport.height + 20;
    const starPoint = (index: number) =>
      this.project(this.coords[index * 3], this.coords[index * 3 + 1], this.coords[index * 3 + 2], viewport);

    const shown = new Set<number>();
    const name = (index: number, kind: LabelKind): boolean => {
      if (shown.has(index)) return false;
      const point = starPoint(index);
      if (!inside(point)) return false;
      shown.add(index);
      labels.put(this.stars[index][1], point[0], point[1], index === this.specialIndex ? "special" : kind);
      if (index === this.selected) labels.mark(point[0], point[1], 13);
      return true;
    };

    if (this.selected !== null) name(this.selected, "strong");
    if (this.hovered !== null) name(this.hovered, "strong");
    if (this.sunIndex >= 0) name(this.sunIndex, "plain");
    const nearCentre = this.position.distanceTo(CENTRE) < SPECIAL_STAR_REVEAL;
    if (this.specialIndex >= 0 && nearCentre) name(this.specialIndex, "special");
    let named = 0;
    for (const neighbour of this.neighbours) {
      if (named === LABELLED_NEIGHBOURS) break;
      if (name(neighbour.index, "faint")) named++;
    }

    // Nebulae and clusters are labelled when the camera comes near.
    for (const landmark of this.field.namedLandmarks(this.camera)) {
      const point = this.project(...landmark.position, viewport);
      if (inside(point)) labels.put(landmark.name, point[0], point[1], "faint", 0);
    }

    // When the special star near the centre is labelled, it replaces the "Galactic centre" label.
    const specialShown = this.specialIndex >= 0 && shown.has(this.specialIndex);
    if (this.position.length() > 1500 && !specialShown) {
      const centre = this.project(CENTRE.x, CENTRE.y, CENTRE.z, viewport);
      if (inside(centre)) labels.put("Galactic centre", centre[0], centre[1], "faint", 0);
    }
  }

  dispose(): void {
    this.glowMap?.dispose();
    this.glowMap = null;
    this.glow.source.geometry.dispose();
    this.glow.source.material.dispose();
    this.glow.target.dispose();
    this.glow.screen.geometry.dispose();
    this.glow.screen.material.dispose();
    this.hosts?.geometry.dispose();
    this.hosts?.material.dispose();
    this.field.dispose();
    this.clouds.dispose();
    this.sky.dispose();
  }
}

/** Flips the picture's rows, because images start at the top while WebGL textures start at the bottom. */
function rowsFromBottom(picture: Picture): Uint8Array {
  const { size, bytes } = picture;
  const row = size * 4;
  const data = new Uint8Array(bytes.length);
  for (let y = 0; y < size; y++) data.set(bytes.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  return data;
}
