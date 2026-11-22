"use client";

import { useEffect } from "react";

/** Builds the planet shaders in the background once the page is idle (see warmup.ts). Renders nothing. */
export function GlobeWarmup() {
  useEffect(() => {
    const start = () => {
      void import("./warmup").then(({ warmUpGlobes }) => warmUpGlobes());
    };
    // Safari has no requestIdleCallback.
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
