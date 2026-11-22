import { describe, expect, it } from "vitest";
import {
  advanceView,
  clampZoom,
  createView,
  dragStep,
  MAX_PITCH,
  MAX_ZOOM,
  MIN_ZOOM,
  pressKey,
  resetView,
  turnView,
  zoomView,
} from "@/app/globe/view";

/** A view whose first picture has been drawn. */
function drawnView(pitch = 0) {
  const view = createView(pitch);
  view.dirty = false;
  return view;
}

describe("createView", () => {
  it("starts in front of the model, zoomed out, turning and due for its first picture", () => {
    expect(createView()).toEqual({ yaw: 0, pitch: 0, zoom: 1, targetZoom: 1, seconds: 0, paused: false, dirty: true });
  });

  it("starts at the pitch it is given", () => {
    expect(createView(0.25).pitch).toBe(0.25);
  });
});

describe("clampZoom", () => {
  it("keeps the zoom between the whole model and eight times closer", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(3)).toBe(3);
    expect(clampZoom(40)).toBe(MAX_ZOOM);
    expect([MIN_ZOOM, MAX_ZOOM]).toEqual([1, 8]);
  });
});

describe("turnView", () => {
  it("turns the view and asks for a new picture", () => {
    const view = drawnView();
    turnView(view, 0.5, 0.25);
    expect(view.yaw).toBe(0.5);
    expect(view.pitch).toBe(0.25);
    expect(view.dirty).toBe(true);
  });

  it("goes round the model as often as the visitor likes", () => {
    const view = drawnView();
    for (let i = 0; i < 10; i++) turnView(view, 1, 0);
    expect(view.yaw).toBe(10);
  });

  it("stops short of the poles, where left and right would flip", () => {
    const view = drawnView();
    turnView(view, 0, 5);
    expect(view.pitch).toBe(MAX_PITCH);
    turnView(view, 0, -50);
    expect(view.pitch).toBe(-MAX_PITCH);
    expect(MAX_PITCH).toBeLessThan(Math.PI / 2);
  });
});

describe("zoomView", () => {
  it("sets a goal the zoom glides to, within its limits", () => {
    const view = drawnView();
    zoomView(view, 1.5);
    expect(view.targetZoom).toBe(1.5);
    expect(view.zoom).toBe(1);
    zoomView(view, 100);
    expect(view.targetZoom).toBe(MAX_ZOOM);
    zoomView(view, 0.001);
    expect(view.targetZoom).toBe(MIN_ZOOM);
  });

  it("is there at once for a pinch, and asks for a new picture", () => {
    const view = drawnView();
    zoomView(view, 2, true);
    expect(view.zoom).toBe(2);
    expect(view.targetZoom).toBe(2);
    expect(view.dirty).toBe(true);
  });
});

describe("resetView", () => {
  it("returns to the first view and lets the model turn on from where it is", () => {
    const view = drawnView();
    turnView(view, 2, 1);
    zoomView(view, 4, true);
    view.seconds = 12;
    view.dirty = false;
    resetView(view);
    expect(view).toMatchObject({ yaw: 0, pitch: 0, targetZoom: 1, seconds: 12, dirty: true });
    // The zoom glides back like any other change of zoom.
    expect(view.zoom).toBe(4);
  });

  it("returns to the pitch of a model that starts tilted", () => {
    const view = drawnView(0.25);
    turnView(view, 0, 1);
    resetView(view, 0.25);
    expect(view.pitch).toBe(0.25);
  });
});

describe("advanceView", () => {
  it("lets the model turn on and always has a new picture while it turns", () => {
    const view = drawnView();
    expect(advanceView(view, 0.016)).toBe(true);
    expect(advanceView(view, 0.016)).toBe(true);
    expect(view.seconds).toBeCloseTo(0.032, 10);
  });

  it("keeps the picture of a paused model that nobody touched", () => {
    const view = drawnView();
    view.paused = true;
    expect(advanceView(view, 0.016)).toBe(false);
    expect(view.seconds).toBe(0);
  });

  it("draws a paused model again when it was turned", () => {
    const view = drawnView();
    view.paused = true;
    turnView(view, 0.1, 0);
    expect(advanceView(view, 0.016)).toBe(true);
    expect(view.seconds).toBe(0);
  });

  it("glides to a new zoom, also while paused, and then rests", () => {
    const view = drawnView();
    view.paused = true;
    zoomView(view, 2);
    let frames = 0;
    while (advanceView(view, 0.016)) {
      frames++;
      expect(view.zoom).toBeGreaterThan(1);
      expect(view.zoom).toBeLessThanOrEqual(2);
      if (frames > 200) throw new Error("The zoom never arrived.");
    }
    expect(view.zoom).toBe(2);
    expect(frames).toBeGreaterThan(5);
  });

  it("arrives in one step after a long pause between frames instead of overshooting", () => {
    const view = drawnView();
    zoomView(view, 3);
    advanceView(view, 0.1);
    expect(view.zoom).toBe(3);
  });
});

describe("dragStep", () => {
  it("turns the view by one radian for a drag as long as the model's radius on screen", () => {
    expect(140 * dragStep(140, 1)).toBeCloseTo(1, 10);
    expect(280 * dragStep(140, 2)).toBeCloseTo(1, 10);
  });

  it("gets finer the closer the view is", () => {
    expect(dragStep(140, 4)).toBeLessThan(dragStep(140, 1));
  });

  it("treats a small model as 40 pixels in radius, so a drag never spins it wildly", () => {
    expect(dragStep(10, 1)).toBe(1 / 40);
    expect(dragStep(0, 1)).toBe(1 / 40);
  });
});

describe("pressKey", () => {
  it("turns the view with the arrow keys", () => {
    const view = drawnView();
    expect(pressKey(view, "ArrowRight")).toBe(true);
    expect(view.yaw).toBeCloseTo(0.2, 10);
    pressKey(view, "ArrowLeft");
    pressKey(view, "ArrowLeft");
    expect(view.yaw).toBeCloseTo(-0.2, 10);
    pressKey(view, "ArrowDown");
    expect(view.pitch).toBeCloseTo(0.2, 10);
    pressKey(view, "ArrowUp");
    expect(view.pitch).toBeCloseTo(0, 10);
  });

  it("takes smaller steps the closer the view is", () => {
    const view = drawnView();
    zoomView(view, 4, true);
    pressKey(view, "ArrowRight");
    expect(view.yaw).toBeCloseTo(0.05, 10);
  });

  it("zooms with plus, the equals sign that shares its key, and minus", () => {
    const view = drawnView();
    expect(pressKey(view, "+")).toBe(true);
    expect(view.targetZoom).toBeCloseTo(1.4, 10);
    pressKey(view, "=");
    expect(view.targetZoom).toBeCloseTo(1.96, 10);
    pressKey(view, "-");
    expect(view.targetZoom).toBeCloseTo(1.4, 10);
  });

  it("resets with zero, to the pitch the model rests at", () => {
    const view = drawnView(0.25);
    turnView(view, 1, 1);
    expect(pressKey(view, "0", 0.25)).toBe(true);
    expect(view).toMatchObject({ yaw: 0, pitch: 0.25, targetZoom: 1 });
  });

  it("leaves every other key alone, so Tab and the page's shortcuts keep working", () => {
    const view = drawnView();
    for (const key of ["Tab", "Enter", " ", "a", "Escape", "PageDown"]) {
      expect(pressKey(view, key), key).toBe(false);
    }
    expect(view).toEqual(drawnView());
  });
});
