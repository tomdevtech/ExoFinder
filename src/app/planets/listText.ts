import { formatCount } from "@/shared/format";
import { planetTypeNoun } from "./labels";
import type { TypeFilter } from "./typeFilter";

const kind = (type: TypeFilter, count: number) => planetTypeNoun(type.planetClass, type.climateClass, count);

/** How many planets a list holds and what they match, such as "2,220 gas giants" or "7 planets match “trapp”". */
export function countText(type: TypeFilter, total: number, query: string): string {
  const count = `${formatCount(total)} ${kind(type, total)}`;
  return query === "" ? count : `${count} ${total === 1 ? "matches" : "match"} “${query}”`;
}

/** Which planets of a list its page shows, such as " · showing 201–400". Empty when the list fits on one page. */
export function rangeText(page: number, pageSize: number, shown: number, total: number): string {
  if (total <= pageSize) return "";
  const first = (page - 1) * pageSize + 1;
  return ` · showing ${formatCount(first)}–${formatCount(first + shown - 1)}`;
}

/** What a list narrowed to a kind of planet says when it holds nothing. */
export function emptyText(type: TypeFilter, query: string): string {
  return query === ""
    ? `The catalogue lists no ${kind(type, 0)}. Remove one of the two filters to see more.`
    : `No ${kind(type, 1)} matches “${query}”. Try a shorter part of the name, or remove a filter.`;
}
