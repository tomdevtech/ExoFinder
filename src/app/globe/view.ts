/**
 * How a visitor looks at a 3D model: from where, how close, and whether it turns by itself. The planets
 * and the irregular bodies are drawn in different ways but are turned and zoomed by the same rules.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Stops just short of looking straight down on a pole, where left and right would flip. */
export const MAX_PITCH = 1.45;
/** A sharper picture is not visible at the size of the models and only costs time. */
export const MAX_PIXEL_RATIO = 2;

/** How fast the zoom glides to its goal: it covers this share of the way per second, at most all of it per frame. */
const GLIDE_RATE = 12;
/** A model drawn smaller than this on screen still turns as if it had this radius, so a drag never spins it wildly. */
const MIN_DRAG_RADIUS = 40;

/** The state the draw loop reads. It changes many times per second, so it is not React state. */
export interface View {
  /** The viewer's position around the model, in radians. */
  yaw: number;
  pitch: number;
  /** A zoom of 1 shows the whole model. */
  zoom: number;
  /** The zoom glides towards this value. */
  targetZoom: number;
  /** Seconds the model has been turning by itself. */
  seconds: number;
  paused: boolean;
  /** Set when something changed, so a paused image has to be drawn again. */
  dirty: boolean;
}

export function createView(pitch = 0): View {
  return { yaw: 0, pitch, zoom: 1, targetZoom: 1, seconds: 0, paused: false, dirty: true };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function turnView(view: View, yaw: number, pitch: number): void {
  view.yaw += yaw;
  view.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, view.pitch + pitch));
  view.dirty = true;
}

/** Zooms by a factor. The zoom glides there, or is there `atOnce` for a pinch that the picture has to follow. */
export function zoomView(view: View, factor: number, atOnce = false): void {
  view.targetZoom = clampZoom(view.targetZoom * factor);
  if (atOnce) {
    view.zoom = view.targetZoom;
    view.dirty = true;
  }
}

/** Returns to the first view. The model keeps turning from where it is. */
export function resetView(view: View, pitch = 0): void {
  view.yaw = 0;
  view.pitch = pitch;
  view.targetZoom = 1;
  view.dirty = true;
}

/**
 * Moves the view on by the time since the last frame and tells whether there is anything new to draw: a
 * paused model that nobody touched keeps its picture.
 */
export function advanceView(view: View, elapsed: number): boolean {
  if (!view.paused) view.seconds += elapsed;
  const zoomBefore = view.zoom;
  view.zoom += (view.targetZoom - view.zoom) * Math.min(1, elapsed * GLIDE_RATE);
  if (Math.abs(view.targetZoom - view.zoom) < 0.002) view.zoom = view.targetZoom;
  return !view.paused || view.dirty || view.zoom !== zoomBefore;
}

/** Radians per pixel of a drag: dragging by the radius of the model on screen turns the view by one radian. */
export function dragStep(radius: number, zoom: number): number {
  return 1 / Math.max(radius * zoom, MIN_DRAG_RADIUS);
}

/**
 * Applies a key to the view: the arrows turn it, plus and minus zoom, zero resets. Returns false for
 * any other key, which then keeps its usual meaning.
 */
export function pressKey(view: View, key: string, restPitch = 0): boolean {
  // The closer the view, the smaller the step, so a key moves the picture about as far at any zoom.
  const step = 0.2 / view.zoom;
  if (key === "ArrowLeft") turnView(view, -step, 0);
  else if (key === "ArrowRight") turnView(view, step, 0);
  else if (key === "ArrowUp") turnView(view, 0, -step);
  else if (key === "ArrowDown") turnView(view, 0, step);
  else if (key === "+" || key === "=") zoomView(view, 1.4);
  else if (key === "-") zoomView(view, 1 / 1.4);
  else if (key === "0") resetView(view, restPitch);
  else return false;
  return true;
}
