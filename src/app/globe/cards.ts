import { GlobeRenderer } from "./renderer";
import type { GlobeSpec } from "./spec";
import { surfaceDefines } from "./uniforms";

/**
 * Keeps all the small planet images on a page moving. Browsers allow only a handful of WebGL
 * contexts per page, but a list shows dozens of planets. So one hidden WebGL canvas draws every
 * visible image in turn, and each result is copied into the image's own 2D canvas.
 */

interface Card {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  spec: GlobeSpec;
  onDrawn: () => void;
  visible: boolean;
  drawn: boolean;
}

/** A sharper picture is not visible at the size of the images and only costs time. */
const MAX_PIXEL_RATIO = 2;
/** The planets turn slowly, so 30 frames per second are enough. */
const FRAME_MS = 33;

const cards = new Map<HTMLCanvasElement, Card>();
let renderer: GlobeRenderer | null | undefined;
let surface: HTMLCanvasElement | null = null;
let observer: IntersectionObserver | null = null;
let frame = 0;
let lastFrame = 0;
/** Grows when drawing takes long, so a slow device draws less often. */
let interval = FRAME_MS;
let still = false;

/**
 * Starts drawing the planet into the canvas and returns a function that stops it. `onDrawn` is
 * called once the first frame is there. Does nothing in a browser without WebGL 2.
 */
export function mountCard(
  canvas: HTMLCanvasElement,
  spec: GlobeSpec,
  onDrawn: () => void,
): () => void {
  if (renderer === undefined) start();
  const context = canvas.getContext("2d");
  if (!renderer || !observer || !context) return () => {};

  // The shader is built in the background while the card scrolls into view.
  renderer.prepare(surfaceDefines(spec));
  cards.set(canvas, { canvas, context, spec, onDrawn, visible: false, drawn: false });
  observer.observe(canvas);
  return () => {
    cards.delete(canvas);
    observer?.unobserve(canvas);
  };
}

function start(): void {
  surface = document.createElement("canvas");
  surface.width = 256;
  surface.height = 256;
  renderer = GlobeRenderer.create(surface, "sm", schedule);
  if (!renderer) return;

  // People who asked for less motion get a still image.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  still = reducedMotion.matches;
  reducedMotion.addEventListener("change", (event) => {
    still = event.matches;
    for (const card of cards.values()) card.drawn = false;
    schedule();
  });

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const card = cards.get(entry.target as HTMLCanvasElement);
        if (card) card.visible = entry.isIntersecting;
      }
      schedule();
    },
    { rootMargin: "100px" },
  );
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(tick);
}

function tick(now: number): void {
  frame = 0;
  if (!renderer || !surface) return;

  const waiting = [...cards.values()].filter(
    (card) => card.visible && (!still || !card.drawn),
  );
  if (waiting.length === 0) return;

  if (now - lastFrame >= interval - 4) {
    lastFrame = now;
    const started = performance.now();
    const seconds = still ? 0 : now / 1000;
    for (const card of waiting) draw(card, seconds);
    // Three quarters of the frame time are left to the rest of the page.
    interval = Math.min(500, Math.max(FRAME_MS, (performance.now() - started) * 4));
  }

  // With reduced motion the work is done once every image has been drawn.
  if (!still || waiting.some((card) => !card.drawn)) schedule();
}

function draw(card: Card, seconds: number): void {
  if (!renderer || !surface || !renderer.ready(card.spec)) return;
  const { canvas, context } = card;
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const size = Math.round(canvas.clientWidth * ratio);
  if (size === 0) return;
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  if (surface.width < size || surface.height < size) {
    // Resizing the WebGL canvas while a shader is being built would freeze the page.
    if (renderer.busy()) return;
    surface.width = size;
    surface.height = size;
  }

  const ready = renderer.draw(card.spec, { seconds }, { x: 0, y: 0, width: size, height: size });
  if (!ready) return;
  context.clearRect(0, 0, size, size);
  // WebGL counts rows from the bottom, but the 2D canvas counts them from the top.
  context.drawImage(surface, 0, surface.height - size, size, size, 0, 0, size, size);
  if (!card.drawn) {
    card.drawn = true;
    card.onDrawn();
  }
}
