import type { NextRequest } from "next/server";
import { bodyName, describeBody } from "@/app/solar-system/bodies";
import { DEFAULT_LOCALE, hasLocale } from "@/i18n/locales";
import { messagesFor, nameOf, type Messages } from "@/i18n/messages";
import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";
import { search, type SearchHit } from "../query";

const SUGGESTION_LIMIT = 8;

/** One line in the suggestion list below the search box. */
export interface Suggestion {
  kind: "planet" | "star" | "body";
  name: string;
  /** The address of the page, without a language: the search box adds the one of its page. */
  href: string;
  detail: string;
}

function toSuggestion(hit: SearchHit, m: Messages): Suggestion {
  if (hit.kind === "body") {
    return {
      kind: "body",
      name: bodyName(hit.body, m),
      href: `/solar-system/${hit.body.slug}`,
      detail: describeBody(hit.body, m),
    };
  }
  if (hit.kind === "star") {
    return {
      kind: "star",
      name: nameOf(m, hit.star.slug, hit.star.name),
      href: `/stars/${hit.star.slug}`,
      detail: m.card.star(hit.star.planetCount),
    };
  }
  const { planet } = hit;
  const star = planet.source === "sol" ? nameOf(m, "sun", planet.starName) : planet.starName;
  return {
    kind: "planet",
    name: nameOf(m, planet.slug, planet.name),
    href: `/planets/${planet.slug}`,
    detail: `${m.classes.describe(planet.planetClass, planet.climateClass)} · ${star}`,
  };
}

/** GET /search/suggest?q=…&lang=… answers with the best matches as JSON, described in the language asked for. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const lang = request.nextUrl.searchParams.get("lang") ?? undefined;
  const locale = hasLocale(lang) ? lang : DEFAULT_LOCALE;
  try {
    const { hits } = await search(query, SUGGESTION_LIMIT, locale);
    const m = messagesFor(locale);
    return Response.json(
      { suggestions: hits.map((hit) => toSuggestion(hit, m)) },
      { headers: { "Cache-Control": CATALOGUE_CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("Search suggestions failed:", error);
    return Response.json({ suggestions: [] }, { status: 503 });
  }
}
