"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lays the moving image of a planet over its still image. The still image comes with the page and
 * shows at once; the moving one needs JavaScript and WebGL and fades in after its first frame.
 * Where it cannot run, the still image simply stays.
 */
export function Globe({
  spec,
  className = "",
  children,
}: {
  /** The planet as a JSON GlobeSpec, so the effect only restarts when it changes. */
  spec: string;
  className?: string;
  /** The still image, which gives the globe its size. */
  children: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    // The drawing code is only loaded by browsers that get this far.
    import("./cards").then(({ mountCard }) => {
      if (cancelled || !canvas.current) return;
      stop = mountCard(canvas.current, JSON.parse(spec), () => setMoving(true));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [spec]);

  return (
    <span className={`relative inline-block align-top ${className}`}>
      <span
        className={`block transition-opacity duration-500 ${moving ? "opacity-0" : "opacity-100"}`}
      >
        {children}
      </span>
      <canvas
        ref={canvas}
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${moving ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
