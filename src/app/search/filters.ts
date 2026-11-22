import { NO_FILTER, type TypeFilter } from "@/app/planets/typeFilter";
import { hrefWith } from "@/shared/params";

/** URL of a search. Whatever is empty is left out, and so is page 1, so that `/search?q=kepler` stays short. */
export function searchHref(query: string, filter: TypeFilter = NO_FILTER, page = 1): string {
  return hrefWith("/search", {
    q: query,
    type: filter.planetClass,
    climate: filter.climateClass,
    page: page > 1 && String(page),
  });
}
