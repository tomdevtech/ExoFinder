"use client";

import dynamic from "next/dynamic";
import { useClientMessages } from "@/i18n/client";

function Loading() {
  const { map } = useClientMessages();
  return <p className="absolute inset-0 grid place-items-center text-sm text-muted">{map.loading}</p>;
}

/**
 * The map is client-only because it needs WebGL and `window`. Loading it on demand
 * also keeps three.js out of the bundles of all other pages.
 */
const MilkyWayMap = dynamic(() => import("./MilkyWayMap"), { ssr: false, loading: Loading });

export function MapLoader() {
  return <MilkyWayMap />;
}
