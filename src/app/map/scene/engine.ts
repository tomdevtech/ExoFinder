import { LinearFilter, RepeatWrapping, WebGLRenderer, type Texture } from "three";
import type { MapStar, MapSystemPayload } from "../payload";
import { GalaxyView, type Viewport } from "./galaxyView";
import { LabelLayer } from "./labels";
import { loadTexture } from "./picture";
import { ShaderGate } from "./shaderGate";
import { SystemView } from "./systemView";
import { TextureStore } from "./textureStore";

/** Callbacks through which the map notifies the page. */
export interface MapEvents {
  onSelect(index: number): void;
  /** A planet or one of its moons was clicked, or the star (`null`) to show the whole system again. */
  onFocus(planet: number | null, moon: number | null): void;
  onEscape(): void;
  /** The camera started (true) or stopped (false) orbiting the galactic centre. */
  onOrbit?(orbiting: boolean): void;
}

const SKY_LARGE = "/textures/sky/milky-way-lg.jpg";
const SKY_SMALL = "/textures/sky/milky-way-sm.jpg";
const GALAXY_PICTURE = "/textures/sky/galaxy.jpg";
/** The duration of the curtain fade, which must match the `duration-320` class. */
const FADE_MS = 320;
const CURSORS = {
  grab: "cursor-grab",
  grabbing: "cursor-grabbing",
  pointer: "cursor-pointer",
} as const;
/** A press that moves less than this many pixels counts as a click rather than a drag. */
const CLICK_SLACK = 5;
const DOUBLE_CLICK_MS = 400;
/** Keys that move the camera. Their default action is prevented so the page does not scroll. */
const FLIGHT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "KeyC",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

/**
 * Runs the map independently of React. It owns the WebGL canvas, renders either the galaxy or a star
 * system each frame and turns pointer and keyboard input into camera moves.
 */
export class MapEngine {
  /** True when the user prefers reduced motion, in which case flights and fades happen instantly. */
  readonly reducedMotion: boolean;

  private readonly renderer: WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly curtain: HTMLDivElement;
  private cursor: keyof typeof CURSORS = "grab";
  private readonly labels: LabelLayer;
  private readonly textures: TextureStore;
  private readonly skyTexture: Texture;
  private readonly galaxy: GalaxyView;
  private system: SystemView | null = null;
  private readonly systemGate = new ShaderGate();

  private readonly viewport: Viewport = { width: 1, height: 1, pixelRatio: 1 };
  private readonly resizeObserver: ResizeObserver;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private travelled = 0;
  private pinch = 0;
  private lastClick = { time: 0, star: -1 };
  private frame = 0;
  private lastTime = 0;
  private seconds = 0;
  private pendingSwap: (() => void) | null = null;
  private swapTimer = 0;
  private disposed = false;

  /** Returns null when the browser cannot draw the map (no WebGL 2). */
  static create(container: HTMLElement, events: MapEvents): MapEngine | null {
    try {
      return new MapEngine(container, events);
    } catch (error) {
      console.warn("The map could not start.", error);
      return null;
    }
  }

  private constructor(
    private readonly container: HTMLElement,
    private readonly events: MapEvents,
  ) {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.canvas = document.createElement("canvas");
    this.canvas.className = `absolute inset-0 block h-full w-full touch-none ${CURSORS[this.cursor]}`;
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 1);

    container.append(this.canvas);
    this.labels = new LabelLayer(container);
    this.curtain = document.createElement("div");
    // The curtain starts closed. Its `duration-320` class must match FADE_MS.
    this.curtain.className =
      "pointer-events-none absolute inset-0 bg-black transition-opacity duration-320 ease-[ease] motion-reduce:transition-none";
    container.append(this.curtain);

    // Mipmaps are disabled because they draw a seam where the left and right edges of the sky photo meet.
    const large = this.renderer.capabilities.maxTextureSize >= 4096 && window.innerWidth > 700;
    const raise = () => {
      if (!this.pendingSwap) this.closeCurtain(false);
    };
    this.skyTexture = loadTexture(large ? SKY_LARGE : SKY_SMALL, raise, raise);
    this.skyTexture.generateMipmaps = false;
    this.skyTexture.minFilter = LinearFilter;
    this.skyTexture.magFilter = LinearFilter;
    this.skyTexture.wrapS = RepeatWrapping;

    this.textures = new TextureStore(Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8));
    this.galaxy = new GalaxyView(this.skyTexture, GALAXY_PICTURE);
    this.galaxy.onOrbitChange = (orbiting) => this.events.onOrbit?.(orbiting);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    container.addEventListener("keydown", this.onKeyDown);
    container.addEventListener("keyup", this.onKeyUp);
    container.addEventListener("blur", this.onBlur);

    this.frame = requestAnimationFrame(this.tick);
  }

  setStars(stars: MapStar[]): void {
    this.galaxy.setStars(stars);
  }

  select(index: number | null): void {
    this.galaxy.selected = index;
  }

  flyToStar(index: number, instantly = false): void {
    this.galaxy.flyToStar(index, instantly || this.reducedMotion);
  }

  flyHome(instantly = false): void {
    this.galaxy.flyHome(instantly || this.reducedMotion);
  }

  flyToOverview(instantly = false): void {
    this.galaxy.flyToOverview(instantly || this.reducedMotion);
  }

  /** Switches between orbiting the galactic centre and free flight. */
  setOrbit(on: boolean): void {
    this.galaxy.setOrbit(on, this.reducedMotion);
  }

  /** Switches from the galaxy to a star system, optionally focused on `planet` or one of its moons. */
  showSystem(
    payload: MapSystemPayload,
    planet: number | null,
    moon: number | null,
    options: { paused: boolean; trueScale: boolean; moons: boolean; zone: boolean },
  ): void {
    this.swap(() => {
      this.system?.dispose();
      this.system = new SystemView(payload, this.textures, this.skyTexture);
      this.system.paused = options.paused;
      this.system.setTrueScale(options.trueScale, true);
      this.system.setMoonsShown(options.moons);
      this.system.setHabitableZoneShown(options.zone, true);
      if (planet !== null) this.system.focus(planet, moon);
      this.keys.clear();
      this.setCursor("grab");
    });
  }

  showGalaxy(): void {
    this.swap(() => {
      this.system?.dispose();
      this.system = null;
      this.setCursor("grab");
    });
  }

  focusPlanet(planet: number | null, moon: number | null = null): void {
    this.system?.focus(planet, moon);
  }

  setPaused(paused: boolean): void {
    if (this.system) this.system.paused = paused;
  }

  /** Switches the system between the compressed and the true scale; the change glides unless motion is reduced. */
  setTrueScale(on: boolean): void {
    this.system?.setTrueScale(on, this.reducedMotion);
  }

  setMoonsShown(shown: boolean): void {
    this.system?.setMoonsShown(shown);
  }

  /** Shows or hides the habitable zone of the system's star; it fades unless motion is reduced. */
  setHabitableZoneShown(shown: boolean): void {
    this.system?.setHabitableZoneShown(shown, this.reducedMotion);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.swapTimer);
    this.resizeObserver.disconnect();
    this.container.removeEventListener("keydown", this.onKeyDown);
    this.container.removeEventListener("keyup", this.onKeyUp);
    this.container.removeEventListener("blur", this.onBlur);
    this.system?.dispose();
    this.galaxy.dispose();
    this.textures.dispose();
    this.skyTexture.dispose();
    this.labels.dispose();
    this.renderer.dispose();
    // Browsers allow only a few WebGL contexts at a time, so this one is released explicitly.
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.curtain.remove();
  }

  private readonly tick = (now: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    // The step is clamped so that time does not jump ahead after a pause, for example in a background tab.
    const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.1);
    this.lastTime = now;
    this.seconds += dt;
    if (document.hidden || this.viewport.width < 2 || this.viewport.height < 2) return;

    this.labels.begin();
    if (this.system) {
      this.system.update(dt, this.seconds, this.viewport);
      this.systemGate.render(this.renderer, this.system.scene, this.system.camera);
      this.system.renderHaze(this.renderer, this.viewport);
      this.system.drawLabels(this.labels, this.viewport);
    } else {
      this.galaxy.update(dt, this.keys, this.viewport);
      this.galaxy.render(this.renderer, this.viewport);
      this.galaxy.drawLabels(this.labels, this.viewport);
    }
    this.labels.end();
  };

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width < 2 || height < 2) return;
    this.viewport.width = width;
    this.viewport.height = height;
    this.viewport.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.viewport.pixelRatio);
    this.renderer.setSize(width, height, false);
  }

  /** Applies a view change behind a short fade to black, so that nothing pops. */
  private swap(change: () => void): void {
    // A change still waiting behind the curtain is applied now, so that none gets lost.
    window.clearTimeout(this.swapTimer);
    this.pendingSwap?.();
    this.pendingSwap = null;
    if (this.reducedMotion) {
      change();
      return;
    }
    this.pendingSwap = change;
    this.closeCurtain(true);
    this.swapTimer = window.setTimeout(() => {
      this.pendingSwap = null;
      change();
      this.closeCurtain(false);
    }, FADE_MS);
  }

  private closeCurtain(closed: boolean): void {
    this.curtain.classList.toggle("opacity-0", !closed);
  }

  private setCursor(cursor: keyof typeof CURSORS): void {
    if (cursor === this.cursor) return;
    this.canvas.classList.replace(CURSORS[this.cursor], CURSORS[cursor]);
    this.cursor = cursor;
  }

  private place(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this.container.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, this.place(event));
    if (this.pointers.size === 1) this.travelled = 0;
    if (this.pointers.size === 2) {
      this.pinch = this.pointerSpread();
      // A two-finger gesture is never a click.
      this.travelled = Infinity;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const now = this.place(event);
    const before = this.pointers.get(event.pointerId);
    if (!before) {
      this.hover(now.x, now.y);
      return;
    }
    this.pointers.set(event.pointerId, now);

    if (this.pointers.size === 2) {
      const spread = this.pointerSpread();
      if (this.pinch > 0 && spread > 0) this.push(Math.log(spread / this.pinch) * 6);
      this.pinch = spread;
      return;
    }
    if (this.pointers.size > 2) return;

    const dx = now.x - before.x;
    const dy = now.y - before.y;
    this.travelled += Math.abs(dx) + Math.abs(dy);
    if (this.travelled <= CLICK_SLACK) return;
    this.setCursor("grabbing");
    if (this.system) this.system.drag(dx, dy);
    else this.galaxy.drag(dx, dy);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.delete(event.pointerId)) return;
    const { x, y } = this.place(event);
    if (this.pointers.size === 0 && this.travelled <= CLICK_SLACK) this.click(x, y);
    this.hover(x, y);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.setCursor("grab");
  };

  private readonly onPointerLeave = (): void => {
    if (this.pointers.size === 0) this.galaxy.hovered = null;
  };

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    // Depending on the browser and device, the wheel reports lines (deltaMode 1) or pixels.
    const pixels = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    this.push(Math.max(-3, Math.min(3, -pixels / 100)));
  };

  /** Moves the camera closer for positive amounts and away for negative ones. */
  private push(amount: number): void {
    if (this.system) this.system.push(amount);
    else this.galaxy.push(amount);
  }

  private hover(x: number, y: number): void {
    if (this.pointers.size > 0) return;
    if (this.system) {
      this.setCursor(this.system.pick(x, y, this.viewport) ? "pointer" : "grab");
      return;
    }
    this.galaxy.hovered = this.galaxy.pick(x, y, this.viewport);
    this.setCursor(this.galaxy.hovered !== null ? "pointer" : "grab");
  }

  private click(x: number, y: number): void {
    if (this.pendingSwap) return;
    if (this.system) {
      const hit = this.system.pick(x, y, this.viewport);
      if (!hit) return;
      const planet = hit.kind === "planet" ? hit.index : hit.kind === "moon" ? hit.planet : null;
      const moon = hit.kind === "moon" ? hit.moon : null;
      this.system.focus(planet, moon);
      this.events.onFocus(planet, moon);
      return;
    }
    const star = this.galaxy.pick(x, y, this.viewport);
    if (star === null) return;
    const now = performance.now();
    const again = this.lastClick.star === star && now - this.lastClick.time < DOUBLE_CLICK_MS;
    this.lastClick = { time: now, star };
    this.galaxy.selected = star;
    this.events.onSelect(star);
    if (again) this.flyToStar(star);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Only keys pressed on the map itself are handled, so typing in a form field does not move the camera.
    if (event.target !== this.container) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape") {
      this.events.onEscape();
      return;
    }
    if (event.code === "Equal" || event.code === "NumpadAdd") this.push(1);
    if (event.code === "Minus" || event.code === "NumpadSubtract") this.push(-1);
    if (!FLIGHT_KEYS.has(event.code)) return;
    if (!event.code.startsWith("Shift")) event.preventDefault();
    if (!this.system) this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
  };
}
