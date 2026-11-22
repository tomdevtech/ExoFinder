import type { NextRequest } from "next/server";
import { describePlanet } from "@/app/planets/labels";
import { describeBody } from "@/app/solar-system/bodies";
import { describeStar } from "@/app/stars/summary";
import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";
import { search, type SearchHit } from "../query";

const SUGGESTION_LIMIT = 8;

/** One line in the suggestion list below the search box. */
export interface Suggestion {
  kind: "planet" | "star" | "body";
  name: string;
  href: string;
  detail: string;
}

function toSuggestion(hit: SearchHit): Suggestion {
  if (hit.kind === "body") {
    return {
      kind: "body",
      name: hit.body.name,
      href: `/solar-system/${hit.body.slug}`,
      detail: describeBody(hit.body),
    };
  }
  if (hit.kind === "star") {
    return {
      kind: "star",
      name: hit.star.name,
      href: `/stars/${hit.star.slug}`,
      detail: describeStar(hit.star.planetCount),
    };
  }
  const { planet } = hit;
  return {
    kind: "planet",
    name: planet.name,
    href: `/planets/${planet.slug}`,
    detail: `${describePlanet(planet.planetClass, planet.climateClass)} · ${planet.starName}`,
  };
}

/** GET /search/suggest?q=… answers with the best matches as JSON. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  try {
    const { hits } = await search(query, SUGGESTION_LIMIT);
    return Response.json({ suggestions: hits.map(toSuggestion) }, { headers: { "Cache-Control": CATALOGUE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Search suggestions failed:", error);
    return Response.json({ suggestions: [] }, { status: 503 });
  }
}
