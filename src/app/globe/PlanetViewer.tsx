"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { GlobeRenderer } from "./renderer";
import { globeRadius, type GlobeSpec } from "./spec";
import { surfaceDefines } from "./uniforms";
import { MAX_PIXEL_RATIO } from "./view";
import { useViewer, ViewerFrame } from "./ViewerFrame";

/**
 * The interactive 3D model of a planet. It turns by itself, can be turned by hand to see every side
 * including the night side, and can be zoomed. `children` is the still image, which shows until the
 * first frame is drawn and stays where WebGL is not available. It must have the same 280 px size.
 */
export function PlanetViewer({
  spec,
  name,
  children,
}: {
  /** The planet as a JSON GlobeSpec, so the effect only restarts when it changes. */
  spec: string;
  name: string;
  children: ReactNode;
}) {
  const globe = useMemo<GlobeSpec>(() => JSON.parse(spec), [spec]);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useViewer(frame, canvas, {
    fullscreen: true,
    dragRadius: (element) => (Math.min(element.clientWidth, element.clientHeight) / 2) * globeRadius(globe),
  });
  const { start, redraw } = viewer;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const pixelSize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      return {
        width: Math.round(element.clientWidth * ratio),
        height: Math.round(element.clientHeight * ratio),
      };
    };
    // The canvas is sized before the context exists, because a resize while the shader is being
    // built would wait for it and freeze the page.
    const initial = pixelSize();
    element.width = initial.width;
    element.height = initial.height;
    const renderer = GlobeRenderer.create(element, "lg", redraw);
    if (!renderer) return;
    // Building the shader starts now rather than once the model is on screen.
    renderer.prepare(surfaceDefines(globe));

    const stop = start(({ seconds, yaw, pitch, zoom }) => {
      // Resizing the canvas while the shader is being built would freeze the page.
      if (!renderer.ready(globe)) return false;

      const { width, height } = pixelSize();
      if (width === 0 || height === 0) return false;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      return renderer.draw(globe, { seconds, yaw, pitch, zoom, flow: true }, { x: 0, y: 0, width, height });
    });

    return () => {
      stop();
      renderer.dispose();
    };
  }, [globe, start, redraw]);

  return (
    <ViewerFrame frame={frame} canvas={canvas} viewer={viewer} name={name}>
      {children}
    </ViewerFrame>
  );
}
