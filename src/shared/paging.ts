import { firstParam, type Param } from "./params";

/** The page number from `?page=`. Anything that is not a whole number of 1 or more counts as page 1. */
export function parsePage(value: Param): number {
  const text = firstParam(value);
  if (!/^\d{1,9}$/.test(text)) return 1;
  return Math.max(1, Number(text));
}

/** Number of pages for `total` entries. An empty list still has one page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The nearest page that exists, so `?page=999` shows the last page instead of nothing. */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/**
 * The page numbers the pager shows: the first, the last and the ones around
 * the current page. "gap" stands for the numbers left out in between.
 *
 * Page 5 of 33 gives 1, gap, 4, 5, 6, gap, 33.
 */
export function pageLinks(current: number, count: number): (number | "gap")[] {
  const shown = new Set([1, count, current - 1, current, current + 1]);
  // A gap that would hide a single number shows that number instead.
  if (current - 2 === 2) shown.add(2);
  if (current + 2 === count - 1) shown.add(count - 1);

  const pages = [...shown].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  const links: (number | "gap")[] = [];
  for (const page of pages) {
    const previous = links.at(-1);
    if (typeof previous === "number" && page - previous > 1) links.push("gap");
    links.push(page);
  }
  return links;
}
