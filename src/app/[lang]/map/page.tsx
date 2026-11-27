import type { Metadata } from "next";
import { MapLoader } from "@/app/map/MapLoader";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { map } = await getMessages();
  return { title: map.title, description: map.description };
}

/**
 * Renders the static shell of the map page. The map itself runs in the browser and fetches its
 * data from /map/stars and /map/systems/[slug].
 */
export default async function MapPage() {
  const { map } = await getMessages();
  return (
    <main data-map className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <h1 className="sr-only">{map.heading}</h1>
      <MapLoader />
      <noscript>
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">{map.noScript}</p>
      </noscript>
    </main>
  );
}
