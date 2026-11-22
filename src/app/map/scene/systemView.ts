import {
  CustomBlending,
  GLSL3,
  Matrix3,
  Mesh,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Texture,
  type WebGLRenderer,
} from "three";
import { seedOffset, SPIN_RATE } from "@/app/globe/spec";
import { stormUniforms } from "@/app/globe/storms";
import { approach, clamp, hashText, mixLog, wrapAngle } from "@/shared/math";
import { EARTH_RADIUS_KM } from "@/shared/units";
import { starColor } from "../galaxy";
import { habitableZone } from "../habitableZone";
import { compressedMoonDistance, layoutOrbits, orbitPoint, starSize, TRUE_AU, trueStarSize } from "../orbits";
import type { MapSystemPayload } from "../payload";
import { BeltsView } from "./beltsView";
import type { Viewport } from "./galaxyView";
import { GlobeFactory, ORBIT_COLOR, type Body, type Globe, type InventedGlobe, type Moon } from "./globes";
import { HabitableZoneView } from "./habitableZoneView";
import { HazeLayer, OCCLUDER_LAYER } from "./hazeLayer";
import type { LabelLayer } from "./labels";
import { OrbitTrace } from "./orbitTrace";
import { BALL_VERTEX, GLOW_FRAGMENT, GLOW_VERTEX, STAR_FRAGMENT } from "./shaders";
import { createSky, type Sky } from "./sky";
import { smallMoonRadius, SmallMoonsView } from "./smallMoonsView";
import type { TextureStore } from "./textureStore";

export type SystemHit =
  | { kind: "planet"; index: number }
  | { kind: "moon"; planet: number; moon: number }
  | { kind: "star" };

const SUN_MAP = "/textures/planets/sun-lg.jpg";
/** The angle in radians between the planet–star line and the camera direction when a planet is first followed. */
const DAYLIGHT_OFFSET = 0.9;
/** While the camera follows a planet, time slows so that one orbit takes at least this many seconds. */
const FOLLOWED_PERIOD = 90;
/** The smallest radius in CSS pixels a planet or moon is drawn with, so that the true scale does not lose it. */
const MIN_PIXELS = 1.6;
/** The seconds a change between the compressed and the true scale takes. */
const SCALE_SECONDS = 1.8;
/** How fast other planets give way to a moon system, and the belts fade, per second. */
const FADE_RATE = 3;
/** How far beyond the outermost orbit the camera may go back, also in the true scale for the Oort cloud. */
const FARTHEST = 9;
const OORT_EDGE_AU = 100000;

/**
 * Renders one star with its planets on their orbits, in a compressed or the true scale (see orbits.ts),
 * with the orbits in the plane y = 0. The planets and moons use the same shader as the 3D model on their
 * detail pages. Following a planet that has moons gives the stage to its moon system: the other planets,
 * the orbits around the star and the belts fade out and are neither drawn nor updated, and the camera stays
 * within the moon system. The moons follow the scale like everything else.
 */
export class SystemView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.02, 4000);

  /** The payload index of the planet the camera follows, or null when showing the whole system. */
  focused: number | null = null;
  /**
   * The moon the camera follows, if any: an index into the followed planet's large moons, or past them into
   * its small moons.
   */
  focusedMoon: number | null = null;
  paused = false;

  private readonly bodies: Body[] = [];
  private readonly belts: BeltsView | null = null;
  private readonly star: Mesh<SphereGeometry, RawShaderMaterial>;
  private readonly glow: Mesh<PlaneGeometry, RawShaderMaterial>;
  private readonly sky: Sky;
  private readonly ballGeometry = new SphereGeometry(1, 96, 48);
  private readonly globes: GlobeFactory;
  private readonly starSizes: [compressed: number, real: number];
  /** The radius of the largest orbit in either scale, used to fit the overview. */
  private readonly extents: [compressed: number, real: number];

  /** The habitable zone, or null for a star whose luminosity is unknown. */
  private readonly zone: HabitableZoneView | null = null;
  private zoneShown = false;
  /** How far the habitable zone has faded in, from 0 to 1. */
  private zoneFade = 0;
  /** Whether the moons are shown. Hidden moons are neither created, drawn nor updated. */
  private moonsShown = true;
  /** 0 for the compressed scale and 1 for the true one; `scaleGoal` is where it is heading. */
  private scaleProgress = 0;
  private scaleGoal = 0;
  /** How far the followed planet's moon system has taken the stage, from 0 to 1. */
  private stage = 0;
  private clock = 0;
  /** Moons keep their own pace, so that they do not crawl while time slows down for a followed planet. */
  private moonClock = 0;
  /** The animation time of the last frame, so that a change of focus can place the moons at once. */
  private lastSeconds = 0;
  /** The orbit speed factor, which is 1 normally and lower while the camera follows a fast planet. */
  private rate = 1;
  private azimuth = 0.6;
  /** The remaining rotation from the previous view direction, which decays so that focus changes glide. */
  private swing = 0;
  private elevation = 0.48;
  /**
   * The camera distance as a multiple of what it looks at: the radius of the followed planet or moon, or
   * the extent of the system. Changing the scale then keeps the picture, although sizes change a
   * thousandfold. `zoom` glides towards `zoomGoal` by its logarithm.
   */
  private zoom = 3;
  private zoomGoal = 3;
  private fitted = false;
  private readonly target = new Vector3();
  /** The remaining offset from the previous target, which decays so that focus changes glide. */
  private readonly lag = new Vector3();
  private readonly scratch = new Vector3();
  /**
   * The small moon the camera follows. Nobody has seen these close up, so it gets a made-up shape and surface
   * from its name (`inventedBody`), which the list calls an illustration. Created the first time one is
   * followed, and given a new shape whenever another one is.
   */
  private smallGlobe: InventedGlobe | null = null;
  private smallGlobeName: string | null = null;
  /** The followed small moon's radius in view units, before the floor of a few pixels. */
  private smallSize = 1;
  private readonly spot = new Vector3();
  /** The orbits of the followed planet and of the followed moon, traced around them every frame. */
  private readonly planetTrace = new OrbitTrace(ORBIT_COLOR);
  private readonly moonTrace = new OrbitTrace(ORBIT_COLOR);
  private readonly haze = new HazeLayer();

  constructor(
    private readonly payload: MapSystemPayload,
    private readonly textures: TextureStore,
    skyTexture: Texture,
  ) {
    const { star, planets } = payload;
    const seed = hashText(star.slug);
    this.globes = new GlobeFactory(textures, this.ballGeometry);

    // The orbital plane is tilted against the Milky Way, as it is in the solar system.
    const tilt = (60 * Math.PI) / 180;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    this.sky = createSky(skyTexture, new Matrix3().set(1, 0, 0, 0, -s, -c, 0, c, -s));
    this.sky.setOpacity(0.55);
    this.scene.add(this.sky.mesh);

    this.starSizes = [starSize(star.radiusSun), trueStarSize(star.radiusSun)];
    const display = starColor(star.teffK);
    const linear = display.map((channel) => channel ** 2.2);
    const brightest = Math.max(...linear);
    this.star = new Mesh(
      this.ballGeometry,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: BALL_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        uniforms: {
          uColor: { value: linear.map((channel) => channel / brightest) },
          uSeed: { value: seedOffset(seed % 9973) },
          uTime: { value: 0 },
          uHasMap: { value: star.isSun ? 1 : 0 },
          uMapDay: { value: star.isSun ? textures.get(SUN_MAP) : textures.blank },
          uNoise: { value: textures.noise },
          uCameraObject: { value: new Vector3() },
        },
      }),
    );
    this.star.layers.enable(OCCLUDER_LAYER);
    this.scene.add(this.star, this.planetTrace.line, this.moonTrace.line);

    this.glow = new Mesh(
      new PlaneGeometry(1, 1),
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        uniforms: { uColor: { value: display }, uCore: { value: 2 / 9 } },
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
      }),
    );
    this.scene.add(this.glow);

    const layouts = layoutOrbits(planets, star, seed);
    for (const layout of layouts) {
      const body = this.globes.createBody(planets[layout.index], layout);
      this.scene.add(body.anchor, body.orbit);
      this.bodies.push(body);
    }
    this.extents = [
      layouts.reduce((extent, layout) => Math.max(extent, layout.semiMajor * (1 + layout.eccentricity)), this.starSizes[0] * 3),
      layouts.reduce(
        (extent, layout) => Math.max(extent, layout.axisAu * TRUE_AU * (1 + layout.eccentricity)),
        this.starSizes[1] * 3,
      ),
    ];
    const jupiter = layouts.find((layout) => planets[layout.index].slug === "jupiter");
    if (star.isSun && jupiter) {
      this.belts = new BeltsView(layouts, {
        jupiterLongitude: jupiter.periapsis + jupiter.phase,
        jupiterPeriod: jupiter.period,
        seed,
      });
      this.scene.add(this.belts.mesh);
    }
    const zone = habitableZone(star);
    if (zone) {
      this.zone = new HabitableZoneView(zone, layouts, star.radiusSun);
      this.scene.add(this.zone.mesh);
    }
    this.placeBodies(0);
  }

  /** 0 for the compressed scale, 1 for the true one, eased while it changes. */
  private get trueScale(): number {
    const t = this.scaleProgress;
    return t * t * (3 - 2 * t);
  }

  private get extent(): number {
    return mixLog(this.extents[0], this.extents[1], this.trueScale);
  }

  private get starRadius(): number {
    return mixLog(this.starSizes[0], this.starSizes[1], this.trueScale);
  }

  /** Switches between the compressed scale (false) and the true scale (true), gliding over. */
  setTrueScale(on: boolean, instantly = false): void {
    const reach = this.zoneReach(this.scaleGoal);
    this.scaleGoal = on ? 1 : 0;
    if (instantly) this.scaleProgress = this.scaleGoal;
    // The habitable zone reaches out differently in each scale, and the overview keeps it in the picture.
    if (this.focused === null) this.zoomGoal *= this.zoneReach(this.scaleGoal) / reach;
  }

  /**
   * Shows or hides the habitable zone, which fades in and out. Showing it moves the camera of the overview
   * back until the whole zone is in the picture, and hiding it undoes that.
   */
  setHabitableZoneShown(shown: boolean, instantly = false): void {
    const reach = this.zoneReach(this.scaleGoal);
    this.zoneShown = shown;
    if (instantly) this.zoneFade = shown ? 1 : 0;
    // Before the first frame the overview has not been fitted yet, and will be with the zone.
    if (this.focused !== null || !this.fitted) return;
    const overview = this.overviewZoom(this.camera.aspect);
    this.zoomGoal = shown ? Math.max(this.zoomGoal, overview) : Math.max(this.zoomGoal / reach, Math.min(this.zoomGoal, overview));
  }

  /**
   * How many extents of the system the overview has to take in: 1, or more while a habitable zone beyond
   * the orbits is shown. A hot Jupiter circles fifty times closer to its star than the zone lies.
   */
  private zoneReach(trueScale: number): number {
    if (!this.zone || !this.zoneShown) return 1;
    return Math.max(1, (this.zone.outerRadius(trueScale) * 1.08) / mixLog(this.extents[0], this.extents[1], trueScale));
  }

  /** Shows or hides the moons. Hidden moons are neither drawn nor updated. */
  setMoonsShown(shown: boolean): void {
    this.moonsShown = shown;
    if (!shown && this.focusedMoon !== null) this.focus(this.focused, null);
  }

  /** Orbits the camera around its target. */
  drag(dx: number, dy: number): void {
    this.azimuth += dx * 0.005;
    this.elevation = clamp(this.elevation + dy * 0.005, -1.45, 1.45);
  }

  /** Moves the camera closer for positive amounts and away for negative ones. One mouse wheel notch is about 1. */
  push(amount: number): void {
    const [low, high] = this.zoomLimits();
    this.zoomGoal = clamp(this.zoomGoal * Math.exp(-amount * 0.2), low, high);
  }

  /** The closest and the farthest camera distance, as multiples of the reference length. */
  private zoomLimits(): [number, number] {
    const reference = this.reference();
    const closest = this.followedGlobe() || this.followedSmall() !== null ? 2.2 : (this.starRadius * 2.4) / reference;
    // Within a moon system the camera may go back to take in its outermost moon, but no farther, as the
    // rest of the system has made way.
    const body = this.moonStage() ? this.focusedBody() : null;
    if (body) {
      const small = this.payload.planets[body.layout.index].smallMoons;
      const radiusKm = (this.payload.planets[body.layout.index].radiusEarth ?? 1) * EARTH_RADIUS_KM;
      const knots = (body.moons ?? []).map((moon) => moon.layout).sort((a, b) => a.distance - b.distance);
      const outermost = Math.max(
        ...(body.moons ?? []).map((moon) => (moon.semiMajor / body.size) * (1 + moon.layout.eccentricity)),
        ...small.map(([, aKm, e]) => {
          const distance = (aKm / radiusKm) * (1 + e);
          return mixLog(compressedMoonDistance(knots, distance), distance, this.trueScale);
        }),
      );
      return [closest, Math.max(closest, (outermost * body.size * 3) / reference)];
    }
    // In the true scale the camera may go back far enough to take in the Oort cloud.
    const reach = this.belts ? mixLog(1, (OORT_EDGE_AU * TRUE_AU * 3) / (this.extents[1] * FARTHEST), this.trueScale) : 1;
    // The scale the view is heading for counts too, or the overview's goal would be cut short on the way there.
    const zone = Math.max(this.zoneReach(this.trueScale), this.zoneReach(this.scaleGoal));
    return [closest, (this.extent * FARTHEST * Math.max(1, reach, zone)) / reference];
  }

  /** Follows a planet or one of its moons, or shows the whole system when `index` is null. */
  focus(index: number | null, moon: number | null = null): void {
    const before = this.focusPoint(new Vector3());
    const distance = this.zoom * this.reference();
    this.focused = index;
    const body = this.focusedBody();
    if (body && body.moons === null && this.moonsShown && this.hasMoons(body)) {
      const planet = this.payload.planets[body.layout.index];
      body.moons = this.globes.createMoons(planet, body);
      if (planet.smallMoons.length > 0) {
        body.smallMoons = new SmallMoonsView(
          planet.smallMoons,
          (planet.radiusEarth ?? 1) * EARTH_RADIUS_KM,
          body.spec.tiltDeg,
          body.moons.map((moon) => moon.layout).sort((a, b) => a.distance - b.distance),
        );
        body.anchor.add(body.smallMoons.group);
      }
    }
    const moonCount = body?.moons ? body.moons.length + this.payload.planets[body.layout.index].smallMoons.length : 0;
    this.focusedMoon = this.moonsShown && moon !== null && moon >= 0 && moon < moonCount ? moon : null;
    if (this.followedSmall() !== null) this.ensureSmallGlobe();
    this.measureSmall();
    // The moons must be in place before the new target is measured.
    this.placeBodies(this.lastSeconds);
    const followed = this.followedMoon();
    // The old target and distance are kept and decay, so the camera glides over instead of jumping.
    this.lag.add(before).sub(this.focusPoint(this.scratch));
    this.zoom = distance / this.reference();
    if (followed) this.globes.sharpen(followed);
    if (body) {
      this.globes.sharpen(body);
      // The camera looks from the star's side, slightly off the line to it, so that most of the planet
      // is in daylight and the star does not block the view.
      const turned = this.azimuth + this.swing;
      const { x, z } = body.anchor.position;
      this.azimuth = Math.atan2(-z, -x) + DAYLIGHT_OFFSET;
      this.swing = wrapAngle(turned - this.azimuth);
    }
    this.zoomGoal = followed || this.followedSmall() !== null ? 6.5 : body ? (body.ring ? 13 : 6.5) : this.overviewZoom(this.camera.aspect);
  }

  private focusedBody(): Body | null {
    return this.bodies.find((body) => body.layout.index === this.focused) ?? null;
  }

  private followedMoon(): Moon | null {
    const moons = this.focusedBody()?.moons;
    return moons && this.focusedMoon !== null && this.focusedMoon < moons.length ? moons[this.focusedMoon] : null;
  }

  /** The index into the followed planet's small moons of the one the camera follows, if any. */
  private followedSmall(): number | null {
    const moons = this.focusedBody()?.moons;
    return moons && this.focusedMoon !== null && this.focusedMoon >= moons.length ? this.focusedMoon - moons.length : null;
  }

  private followedGlobe(): Globe | null {
    return this.followedMoon() ?? this.focusedBody();
  }

  /** The length the camera distance is measured in: the radius of what it follows, or the extent of the system. */
  private reference(): number {
    if (this.followedSmall() !== null) return this.smallSize;
    return this.followedGlobe()?.size ?? this.extent;
  }

  /** Where the followed small moon is, in world space, or null if the camera follows none. */
  private smallPoint(out: Vector3): Vector3 | null {
    const index = this.followedSmall();
    const body = this.focusedBody();
    if (index === null || !body?.smallMoons) return null;
    body.smallMoons.place(index, this.moonClock, this.trueScale, out);
    body.anchor.updateWorldMatrix(true, false);
    return out.multiplyScalar(body.size).applyMatrix4(body.anchor.matrixWorld);
  }

  /** Sets the followed small moon's radius in view units at the current mix of scales. */
  private measureSmall(): void {
    const index = this.followedSmall();
    const body = this.focusedBody();
    if (index === null || !body) return;
    const planet = this.payload.planets[body.layout.index];
    const radiusKm = planet.smallMoons[index][8];
    this.smallSize = smallMoonRadius(radiusKm, (planet.radiusEarth ?? 1) * EARTH_RADIUS_KM, body.layout.size, this.trueScale) * body.size;
  }

  private ensureSmallGlobe(): void {
    const index = this.followedSmall();
    const body = this.focusedBody();
    if (index === null || !body) return;
    const name = this.payload.planets[body.layout.index].smallMoons[index][0];
    if (this.smallGlobe && this.smallGlobeName === name) return;
    this.smallGlobeName = name;
    if (this.smallGlobe) {
      this.globes.reshapeInvented(this.smallGlobe, name);
      return;
    }
    this.smallGlobe = this.globes.createInvented(name);
    this.scene.add(this.smallGlobe);
  }

  private focusPoint(out: Vector3): Vector3 {
    const small = this.smallPoint(out);
    if (small) return small;
    const moon = this.followedMoon();
    if (moon) return moon.anchor.getWorldPosition(out);
    const body = this.focusedBody();
    return body ? out.copy(body.anchor.position) : out.set(0, 0, 0);
  }

  /**
   * Returns the camera distance, in extents, at which the whole system fits on the screen, with its
   * habitable zone while that is shown, in the scale the view is heading for.
   */
  private overviewZoom(aspect: number): number {
    return 2.7 * Math.max(1, 1 / aspect) * this.zoneReach(this.scaleGoal);
  }

  private hasMoons(body: Body): boolean {
    const planet = this.payload.planets[body.layout.index];
    return planet.moons.length + planet.smallMoons.length > 0;
  }

  /** Whether the followed planet's moons are on stage, which makes the other planets give way. */
  private moonStage(): boolean {
    const body = this.focusedBody();
    return this.moonsShown && body !== null && this.hasMoons(body);
  }

  /** Positions every planet and moon on its orbit at the current mix of scales and updates its rotation and shader time. */
  private placeBodies(seconds: number): void {
    this.lastSeconds = seconds;
    const scale = this.trueScale;
    for (const body of this.bodies) {
      const { layout } = body;
      body.semiMajor = mixLog(layout.semiMajor, layout.axisAu * TRUE_AU, scale);
      body.size = mixLog(layout.size, layout.trueSize, scale);
      const focused = layout.index === this.focused;
      body.presence = focused ? 1 : 1 - this.stage;
      // The planet's own orbit around the star gives way too. In the true scale a trace of it may stay, as
      // it really passes through the moon system; in the compressed scale it would cut across it at random.
      const orbitPresence = focused ? 1 - this.stage * (1 - 0.15 * scale) : body.presence;
      const [x, y] = orbitPoint(
        body.semiMajor,
        layout.eccentricity,
        layout.periapsis,
        layout.phase + (this.clock / layout.period) * 2 * Math.PI,
      );
      body.anchor.position.set(x, 0, -y);
      body.orbit.scale.setScalar(body.semiMajor);
      body.orbit.material.opacity = (focused ? 0.7 : 0.3) * orbitPresence;
      body.orbit.visible = orbitPresence > 0.002;
      body.axis.visible = body.presence > 0.002;
      if (body.moons) this.placeMoons(body, focused, seconds);
      // A planet that has given way is neither drawn nor updated until it comes back.
      if (!body.axis.visible) continue;
      // A tidally locked rocky planet rotates once per orbit. All other planets spin at their own pace,
      // including locked gas giants, whose winds carry the clouds around.
      body.ball.rotation.y =
        body.spec.locked > 0.5 && body.spec.kind === "terrain"
          ? Math.atan2(-x, y)
          : body.spinStart + seconds * SPIN_RATE * body.spin;
      const moon = body.spec.moon;
      if (body.moon && moon) {
        const angle = moon.phase + (seconds / moon.period) * 2 * Math.PI;
        body.moon.position.set(Math.cos(angle) * moon.distance, 0, Math.sin(angle) * moon.distance);
      }
      body.ball.material.uniforms.uTime.value = seconds;
      if (!body.shaped) {
        for (const [name, value] of Object.entries(stormUniforms(body.spec, seconds))) body.ball.material.uniforms[name].value = value;
      }
      body.ball.material.uniforms.uDetail.value = focused && this.focusedMoon === null ? 1 : 0;
    }
  }

  /**
   * Moves the moons along their orbits, at their true distances in radii of the planet. They show only
   * while the camera follows their planet, growing in as the rest of the system makes way.
   */
  private placeMoons(body: Body, focused: boolean, seconds: number): void {
    const shown = focused && this.moonsShown && this.stage > 0.002;
    (body.moons ?? []).forEach((moon, index) => {
      moon.plane.visible = shown;
      // The place is kept up to date while hidden, because following a moon measures from it at once.
      const { layout } = moon;
      moon.semiMajor = mixLog(layout.compressedDistance, layout.distance, this.trueScale) * body.size;
      moon.size = mixLog(layout.compressedSize, layout.size, this.trueScale) * body.size;
      const [x, y] = orbitPoint(
        moon.semiMajor,
        layout.eccentricity,
        layout.periapsis,
        layout.phase + (this.moonClock / layout.period) * 2 * Math.PI,
      );
      moon.anchor.position.set(x, 0, -y);
      moon.orbit.scale.setScalar(moon.semiMajor);
      // The moons are tidally locked, and the middle of each map (longitude 0) faces the planet. The
      // shader puts that longitude on +z, which this turns towards the planet at the origin. A tumbling
      // moon turns about all three axes at unrelated rates instead.
      if (moon.tumbling) moon.ball.rotation.set(seconds * 0.23, seconds * 0.17, seconds * 0.11);
      else moon.ball.rotation.y = Math.atan2(-x, y);
      const followed = index === this.focusedMoon;
      moon.orbit.material.opacity = (followed ? 0.6 : 0.25) * this.stage;
      moon.ball.material.uniforms.uTime.value = seconds;
      moon.ball.material.uniforms.uDetail.value = followed ? 1 : 0;
    });
  }

  /** Sets the drawn radius of a globe: its size, but never less than MIN_PIXELS on screen, times `presence`. */
  private sizeOnScreen(globe: Globe, pixelsPerUnit: number, presence: number): void {
    const away = globe.anchor.getWorldPosition(this.spot).distanceTo(this.camera.position);
    globe.axis.scale.setScalar(Math.max(globe.size, (MIN_PIXELS * away) / pixelsPerUnit) * Math.max(presence, 1e-4));
  }

  /** Advances the system by `dt` seconds. `seconds` is the animation time, which keeps running while the orbits are paused. */
  update(dt: number, seconds: number, viewport: Viewport): void {
    // Planets close to their star orbit very fast, so while the camera follows one, time slows down
    // until an orbit takes at least FOLLOWED_PERIOD seconds.
    const followed = this.focusedBody();
    const calm = followed ? Math.min(1, followed.layout.period / FOLLOWED_PERIOD) : 1;
    this.rate += (calm - this.rate) * (1 - Math.exp(-dt * 3));
    if (!this.paused) {
      this.clock += dt * this.rate;
      this.moonClock += dt;
    }
    this.scaleProgress = approach(this.scaleProgress, this.scaleGoal, dt / SCALE_SECONDS);
    this.stage = approach(this.stage, this.moonStage() ? 1 : 0, dt * FADE_RATE);
    this.zoneFade = approach(this.zoneFade, this.zoneShown ? 1 : 0, dt * FADE_RATE);

    const angleBefore = followed ? Math.atan2(followed.anchor.position.z, followed.anchor.position.x) : 0;
    this.placeBodies(seconds);
    this.measureSmall();
    if (followed) {
      // The camera turns with the planet around the star so that its day side stays in view.
      const angle = Math.atan2(followed.anchor.position.z, followed.anchor.position.x);
      this.azimuth += wrapAngle(angle - angleBefore);
    }

    const aspect = viewport.width / viewport.height;
    if (!this.fitted) {
      this.fitted = true;
      if (!this.followedGlobe()) this.zoomGoal = this.overviewZoom(aspect);
      this.zoom = this.zoomGoal * 1.25;
    }
    const [low, high] = this.zoomLimits();
    this.zoomGoal = clamp(this.zoomGoal, low, high);
    this.zoom *= (this.zoomGoal / this.zoom) ** (1 - Math.exp(-dt * 4.5));
    this.lag.multiplyScalar(Math.exp(-dt * 4.5));
    this.swing *= Math.exp(-dt * 4.5);
    this.focusPoint(this.target).add(this.lag);

    const distance = this.zoom * this.reference();
    const cos = Math.cos(this.elevation);
    const azimuth = this.azimuth + this.swing;
    this.camera.aspect = aspect;
    this.camera.near = distance * 0.02;
    this.camera.far = distance * 2 + this.extent * 12 * this.zoneReach(this.trueScale);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(
      this.target.x + distance * cos * Math.cos(azimuth),
      this.target.y + distance * Math.sin(this.elevation),
      this.target.z + distance * cos * Math.sin(azimuth),
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();

    // Sizes depend on the camera, because nothing may shrink below a few pixels in the true scale.
    const pixelsPerUnit = viewport.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const starAway = this.camera.position.length();
    const starDrawn = Math.max(this.starRadius, (MIN_PIXELS * 1.6 * starAway) / pixelsPerUnit);
    this.star.scale.setScalar(starDrawn);
    this.glow.scale.setScalar(starDrawn * 9);
    this.glow.quaternion.copy(this.camera.quaternion);
    if (this.smallGlobe) {
      const point = this.smallPoint(this.spot);
      this.smallGlobe.visible = point !== null && this.stage > 0.002;
      if (point) {
        this.smallGlobe.position.copy(point);
        const away = point.distanceTo(this.camera.position);
        this.smallGlobe.scale.setScalar(Math.max(this.smallSize, (MIN_PIXELS * away) / pixelsPerUnit) * Math.max(this.stage, 1e-4));
        // Small moons near their planet are locked like the large ones; one face is turned to it.
        const planet = this.focusedBody()!.anchor.position;
        this.smallGlobe.rotation.set(0, Math.atan2(planet.x - point.x, planet.z - point.z), 0);
      }
    }
    for (const body of this.bodies) {
      if (!body.axis.visible) continue;
      this.sizeOnScreen(body, pixelsPerUnit, body.presence);
      if (body.moons && body.layout.index === this.focused) {
        for (const moon of body.moons) if (moon.plane.visible) this.sizeOnScreen(moon, pixelsPerUnit, this.stage);
      }
    }
    this.scene.updateMatrixWorld();

    // Each shader works in its object's local space, so the light and camera positions are converted.
    const origin = new Vector3();
    const place = (object: Mesh<BufferGeometry, RawShaderMaterial>) => {
      const { uLightObject, uCameraObject } = object.material.uniforms;
      if (uLightObject) object.worldToLocal((uLightObject.value as Vector3).copy(origin));
      if (uCameraObject) object.worldToLocal((uCameraObject.value as Vector3).copy(this.camera.position));
    };
    for (const body of this.bodies) {
      if (!body.axis.visible) continue;
      place(body.ball);
      if (body.ring) place(body.ring);
      if (body.haze) place(body.haze);
      if (body.moon) place(body.moon);
      for (const moon of body.moons ?? []) {
        if (!moon.plane.visible) continue;
        place(moon.ball);
        if (moon.haze) place(moon.haze);
      }
    }
    if (this.smallGlobe?.visible) place(this.smallGlobe);
    place(this.star);
    this.star.material.uniforms.uTime.value = seconds;
    this.belts?.update(this.clock, viewport, this.trueScale, 1 - this.stage);
    this.zone?.update(this.trueScale, this.zoneFade * (1 - this.stage), this.camera.position);
    for (const body of this.bodies) {
      const shown = body.layout.index === this.focused && this.moonsShown ? this.stage : 0;
      body.smallMoons?.update(this.moonClock, viewport, body.size, this.trueScale, shown);
    }
    this.traceOrbits();
  }

  /** Lays the haze of faint lines over the picture, if any are shown (see HazeLayer). */
  renderHaze(renderer: WebGLRenderer, viewport: Viewport): void {
    if (this.bodies.some((body) => body.smallMoons?.group.visible)) this.haze.render(renderer, this.scene, this.camera, viewport);
  }

  /**
   * Draws the orbits of the followed planet and moon as traces around them (see OrbitTrace) in place of
   * their fixed polygons, which miss them in the true scale.
   */
  private traceOrbits(): void {
    const body = this.focusedBody();
    if (body && body.orbit.visible) {
      body.orbit.visible = false;
      const { layout } = body;
      const anomaly = layout.phase + (this.clock / layout.period) * 2 * Math.PI;
      this.planetTrace.update((offset, out) => {
        const [x, y] = orbitPoint(body.semiMajor, layout.eccentricity, layout.periapsis, anomaly + offset);
        return out.set(x, 0, -y);
      }, body.orbit.material.opacity);
    } else {
      this.planetTrace.hide();
    }

    const moon = this.followedMoon();
    const small = this.followedSmall();
    for (const other of body?.moons ?? []) other.orbit.visible = other !== moon;
    if (moon?.plane.visible) {
      const { layout } = moon;
      const anomaly = layout.phase + (this.moonClock / layout.period) * 2 * Math.PI;
      this.moonTrace.update((offset, out) => {
        const [x, y] = orbitPoint(moon.semiMajor, layout.eccentricity, layout.periapsis, anomaly + offset);
        return out.set(x, 0, -y).applyMatrix4(moon.plane.matrixWorld);
      }, moon.orbit.material.opacity);
    } else if (body?.smallMoons && small !== null) {
      const view = body.smallMoons;
      const period = view.period(small);
      this.moonTrace.update(
        (offset, out) =>
          view
            .place(small, this.moonClock + (offset * period) / (2 * Math.PI), this.trueScale, out)
            .multiplyScalar(body.size)
            .applyMatrix4(body.anchor.matrixWorld),
        0.6 * this.stage,
      );
    } else {
      this.moonTrace.hide();
    }
  }

  /** Returns a sphere's screen centre and radius in CSS pixels, or null if it is behind the camera. */
  private project(position: Vector3, radius: number, viewport: Viewport): [number, number, number] | null {
    const point = this.scratch.copy(position).project(this.camera);
    if (point.z > 1 || point.z < -1) return null;
    const pixelsPerUnit = viewport.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    return [
      (point.x * 0.5 + 0.5) * viewport.width,
      (0.5 - point.y * 0.5) * viewport.height,
      (radius * pixelsPerUnit) / position.distanceTo(this.camera.position),
    ];
  }

  /** The moons that are shown, with their planet's payload index and their own index. */
  private shownMoons(): { moon: Moon; planet: number; index: number }[] {
    const body = this.focusedBody();
    if (!body?.moons || this.stage < 0.5) return [];
    return body.moons
      .map((moon, index) => ({ moon, planet: body.layout.index, index }))
      .filter(({ moon }) => moon.plane.visible && moon.anchor.visible);
  }

  /** The planets that are shown: not still loading, and not given way to a moon system. */
  private shownBodies(): Body[] {
    return this.bodies.filter((body) => body.anchor.visible && body.presence >= 0.5);
  }

  /** Returns the planet, moon or star under the point (x, y) in CSS pixels, if any. */
  pick(x: number, y: number, viewport: Viewport): SystemHit | null {
    let best: SystemHit | null = null;
    let bestOffset = Infinity;
    const consider = (position: Vector3, size: number, hit: SystemHit) => {
      const point = this.project(position, size, viewport);
      if (!point) return;
      const offset = Math.hypot(point[0] - x, point[1] - y);
      if (offset < Math.max(point[2], 14) && offset < bestOffset) {
        bestOffset = offset;
        best = hit;
      }
    };
    for (const body of this.shownBodies()) {
      consider(body.anchor.position, body.axis.scale.x, { kind: "planet", index: body.layout.index });
    }
    for (const { moon, planet, index } of this.shownMoons()) {
      consider(moon.anchor.getWorldPosition(this.spot), moon.axis.scale.x, { kind: "moon", planet, moon: index });
    }
    if (best) return best;
    const star = this.project(this.star.position, this.star.scale.x, viewport);
    if (star && Math.hypot(star[0] - x, star[1] - y) < Math.max(star[2], 14)) return { kind: "star" };
    return null;
  }

  drawLabels(labels: LabelLayer, viewport: Viewport): void {
    const star = this.project(this.star.position, this.star.scale.x, viewport);
    if (star) labels.put(this.payload.star.name, star[0], star[1], "plain", star[2] + 8);
    for (const body of this.shownBodies()) {
      const point = this.project(body.anchor.position, body.axis.scale.x, viewport);
      if (!point) continue;
      const strong = body.layout.index === this.focused && this.focusedMoon === null;
      const reach = body.ring ? point[2] * 2.3 : point[2];
      labels.put(body.name, point[0], point[1], strong ? "strong" : "plain", reach + 7);
    }
    for (const { moon, index } of this.shownMoons()) {
      const point = this.project(moon.anchor.getWorldPosition(this.spot), moon.axis.scale.x, viewport);
      if (point) labels.put(moon.name, point[0], point[1], index === this.focusedMoon ? "strong" : "plain", point[2] + 6);
    }
    const small = this.followedSmall();
    if (small !== null && this.smallGlobe?.visible) {
      const point = this.project(this.smallGlobe.position, this.smallGlobe.scale.x, viewport);
      const name = this.payload.planets[this.focusedBody()!.layout.index].smallMoons[small][0];
      if (point) labels.put(name, point[0], point[1], "strong", point[2] + 6);
    }
  }

  dispose(): void {
    for (const body of this.bodies) this.globes.disposeBody(body);
    this.belts?.dispose();
    this.zone?.dispose();
    if (this.smallGlobe) this.globes.disposeInvented(this.smallGlobe);
    this.star.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.ballGeometry.dispose();
    this.sky.dispose();
    this.planetTrace.dispose();
    this.moonTrace.dispose();
    this.haze.dispose();
  }
}
