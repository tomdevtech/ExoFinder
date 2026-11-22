"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { advanceView, createView, dragStep, pressKey, resetView, turnView, zoomView, type View } from "./view";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export interface ViewerOptions {
  /** The radius of the model on screen at zoom 1, in CSS pixels. Dragging that far turns it by one radian. */
  dragRadius: (canvas: HTMLCanvasElement) => number;
  /** The pitch the model starts at and returns to. */
  pitch?: number;
  /** Offers full screen, where the wheel zooms without Ctrl. */
  fullscreen?: boolean;
  /** Lets a pinch glide to its zoom as the buttons do, instead of following the fingers at once. */
  pinchGlides?: boolean;
}

export interface Viewer {
  /**
   * Starts the draw loop on the canvas and returns a function that stops it. `draw` is called whenever
   * there is something new to draw and tells whether it could draw it; the loop rests while the canvas is
   * off screen.
   */
  start: (draw: (view: View) => boolean) => () => void;
  /** Asks for the picture to be drawn again, for example because a map has arrived. */
  redraw: () => void;
  /** True once the first picture is drawn. */
  live: boolean;
  paused: boolean;
  fullscreen: boolean;
  offersFullscreen: boolean;
  togglePause: () => void;
  toggleFullscreen: () => void;
  zoomBy: (factor: number) => void;
  reset: () => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerEnd: (event: PointerEvent<HTMLCanvasElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Everything a 3D model has in common whatever draws it: it turns by itself unless the visitor asked for
 * less motion, is turned by dragging and the arrow keys, and zooms with the buttons, two fingers, the
 * keyboard and the wheel (with Ctrl, or in full screen). The caller only draws. `frame` and `canvas` are
 * the two elements that `ViewerFrame` renders.
 */
export function useViewer(
  frame: RefObject<HTMLDivElement | null>,
  canvas: RefObject<HTMLCanvasElement | null>,
  { dragRadius, pitch = 0, fullscreen: offersFullscreen = false, pinchGlides = false }: ViewerOptions,
): Viewer {
  const view = useRef<View>(createView(pitch));
  /** Fingers or mouse buttons that are down, with their last position. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const [live, setLive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  /** The visitor's own choice. Until they make one, the reduced-motion setting decides. */
  const [pauseChoice, setPauseChoice] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const paused = pauseChoice ?? reducedMotion;

  useEffect(() => {
    view.current.paused = paused;
  }, [paused]);

  const start = useCallback((draw: (view: View) => boolean) => {
    const element = canvas.current;
    if (!element) return () => {};
    const state = view.current;
    let request = 0;
    let last = 0;
    let shown = false;

    const tick = (now: number) => {
      request = requestAnimationFrame(tick);
      const elapsed = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      if (!advanceView(state, elapsed)) return;
      const drawn = draw(state);
      // A picture that could not be drawn yet, because its shader or its maps are still on their way, stays due.
      state.dirty = !drawn;
      if (drawn && !shown) {
        shown = true;
        setLive(true);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(request);
      request = 0;
      if (entry.isIntersecting) {
        last = 0;
        state.dirty = true;
        request = requestAnimationFrame(tick);
      }
    });
    observer.observe(element);

    // A resize clears the canvas, so a paused image has to be drawn again.
    const resizes = new ResizeObserver(() => {
      state.dirty = true;
    });
    resizes.observe(element);

    // The wheel zooms in full screen or with Ctrl; otherwise it scrolls the page as usual.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && document.fullscreenElement !== frame.current) return;
      event.preventDefault();
      zoomView(state, Math.exp(-event.deltaY * 0.0015));
    };
    element.addEventListener("wheel", onWheel, { passive: false });

    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === frame.current);
      state.dirty = true;
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      resizes.disconnect();
      element.removeEventListener("wheel", onWheel);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [frame, canvas]);

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const now = { x: event.clientX, y: event.clientY };

    if (pointers.current.size === 1) {
      const step = dragStep(dragRadius(event.currentTarget), view.current.zoom);
      turnView(view.current, (now.x - before.x) * step, (now.y - before.y) * step);
    } else if (pointers.current.size === 2) {
      // With two fingers, the change in their distance zooms.
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId);
      if (other) {
        const distanceBefore = Math.hypot(before.x - other[1].x, before.y - other[1].y);
        const distanceNow = Math.hypot(now.x - other[1].x, now.y - other[1].y);
        if (distanceBefore > 0) zoomView(view.current, distanceNow / distanceBefore, !pinchGlides);
      }
    }
    pointers.current.set(event.pointerId, now);
  }

  function onPointerEnd(event: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Keys pressed on one of the buttons belong to that button.
    if (event.target !== event.currentTarget) return;
    if (pressKey(view.current, event.key, pitch)) event.preventDefault();
  }

  // Callers name this in the dependencies of the effect that creates their renderer, so it must not change.
  const redraw = useCallback(() => {
    view.current.dirty = true;
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen().catch(() => {});
  }

  return {
    start,
    redraw,
    live,
    paused,
    fullscreen,
    offersFullscreen,
    togglePause: () => setPauseChoice(!paused),
    toggleFullscreen,
    zoomBy: (factor) => zoomView(view.current, factor),
    reset: () => resetView(view.current, pitch),
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onKeyDown,
  };
}

const BUTTON = "rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground";

/**
 * The canvas of a 3D model with its buttons. `children` show until the first picture is drawn and stay
 * where the model cannot be drawn. They must fit the same 280 px square.
 */
export function ViewerFrame({
  frame,
  canvas,
  viewer,
  name,
  children,
}: {
  frame: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  viewer: Viewer;
  name: string;
  children: ReactNode;
}) {
  const { live, paused, fullscreen } = viewer;
  const canFullscreen = viewer.offersFullscreen && live && typeof document !== "undefined" && document.fullscreenEnabled;

  return (
    <div
      ref={frame}
      tabIndex={live ? 0 : undefined}
      role="group"
      aria-label={`3D model of ${name}. Arrow keys turn it, plus and minus zoom, zero resets.`}
      onKeyDown={viewer.onKeyDown}
      className={`flex shrink-0 flex-col items-center gap-3 rounded-xl bg-background outline-none focus-visible:ring-1 focus-visible:ring-accent ${fullscreen ? "p-4" : "w-70"}`}
    >
      <div className={`relative w-full ${fullscreen ? "min-h-0 flex-1" : "h-70"}`}>
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${live ? "opacity-0" : "opacity-100"}`}
        >
          {children}
        </div>
        <canvas
          ref={canvas}
          aria-hidden
          onPointerDown={viewer.onPointerDown}
          onPointerMove={viewer.onPointerMove}
          onPointerUp={viewer.onPointerEnd}
          onPointerCancel={viewer.onPointerEnd}
          // Outside full screen, touch-pan-y lets a vertical swipe still scroll the page.
          className={`absolute inset-0 h-full w-full cursor-grab transition-opacity duration-500 active:cursor-grabbing ${live ? "opacity-100" : "opacity-0"} ${fullscreen ? "touch-none" : "touch-pan-y"}`}
        />
      </div>

      {/* Always rendered so the layout does not jump when the model appears. */}
      <div className={`flex flex-wrap justify-center gap-1.5 ${live ? "" : "invisible"}`}>
        <button type="button" className={BUTTON} aria-label="Zoom out" onClick={() => viewer.zoomBy(1 / 1.5)}>
          −
        </button>
        <button type="button" className={BUTTON} aria-label="Zoom in" onClick={() => viewer.zoomBy(1.5)}>
          +
        </button>
        <button type="button" className={BUTTON} onClick={viewer.reset}>
          Reset
        </button>
        <button type="button" className={BUTTON} onClick={viewer.togglePause}>
          {paused ? "Spin" : "Pause"}
        </button>
        {canFullscreen && (
          <button type="button" className={BUTTON} onClick={viewer.toggleFullscreen}>
            {fullscreen ? "Close" : "Full screen"}
          </button>
        )}
      </div>
    </div>
  );
}
