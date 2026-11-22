import { GlobeRenderer } from "./renderer";
import { ALL_SURFACE_DEFINES } from "./uniforms";

const POLL_MS = 250;

let started = false;

/**
 * Builds every planet program once in a hidden canvas, so a planet page opened later finds its
 * shader ready. The browser caches built programs while it runs and reuses them for any canvas with
 * the same shader code. Runs once per visit.
 */
export function warmUpGlobes(): void {
  if (started) return;
  started = true;

  const canvas = document.createElement("canvas");
  // The canvas is sized before the context exists, because a later resize would wait for the builds.
  canvas.width = 1;
  canvas.height = 1;
  const renderer = GlobeRenderer.create(canvas, "sm");
  if (!renderer) return;
  // Without background builds, waiting for the programs would freeze the page.
  if (!renderer.buildsInBackground) {
    renderer.dispose();
    return;
  }

  for (const defines of ALL_SURFACE_DEFINES) renderer.prepare(defines);
  const finish = () => {
    if (renderer.busy()) {
      setTimeout(finish, POLL_MS);
      return;
    }
    renderer.dispose();
    // This frees the context at once instead of waiting for the garbage collector.
    canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
  };
  setTimeout(finish, POLL_MS);
}
