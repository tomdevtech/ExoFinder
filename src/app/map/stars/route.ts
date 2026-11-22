import { io } from "next/cache";
import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";
import { toMapStar, type MapStarsPayload } from "../payload";
import { getMapStars } from "../queries";

/** Returns every star with a known position as JSON. */
export async function GET() {
  // The query is cached, and without this Next.js would run it during `next build` and ship that answer
  // with the site. The build has to work without a database.
  await io();
  try {
    const payload: MapStarsPayload = { stars: (await getMapStars()).map(toMapStar) };
    return Response.json(payload, { headers: { "Cache-Control": CATALOGUE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Loading the stars of the map failed:", error);
    return Response.json({ error: "The star catalogue is not available right now." }, { status: 503 });
  }
}
