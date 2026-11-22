import { firstParam, hrefWith, type Param } from "@/shared/params";
import { NO_FILTER, type TypeFilter } from "./typeFilter";

/** How many planets one page of the list shows. */
export const PAGE_SIZE = 200;

/** The orders the list offers: by name, or by year of discovery with the newest first. */
export type ListSort = "name" | "discovery";

/** The trimmed filter text from `?q=`. */
export function parseFilter(value: Param): string {
  return firstParam(value);
}

/** The order from `?sort=`. Anything but `discovery` means by name. */
export function parseSort(value: Param): ListSort {
  return firstParam(value) === "discovery" ? "discovery" : "name";
}

/**
 * URL of a list page. Page 1, an empty filter, an open kind of planet and the name order are left out so
 * that `/planets` stays short.
 */
export function listHref(filter: string, page = 1, sort: ListSort = "name", type: TypeFilter = NO_FILTER): string {
  return hrefWith("/planets", {
    q: filter,
    type: type.planetClass,
    climate: type.climateClass,
    sort: sort !== "name" && sort,
    page: page > 1 && String(page),
  });
}
