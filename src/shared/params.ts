/** The value of a search param as Next.js passes it. */
export type Param = string | string[] | undefined;

/** The first value of a search param, trimmed. A param given twice counts once and a missing one is empty. */
export function firstParam(value: Param): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

/**
 * An address with its params in the order given. Whatever is empty is left out, so an address that asks
 * for nothing special stays short and has one spelling.
 */
export function hrefWith(path: string, params: Record<string, string | null | false>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value) search.set(name, value);
  }
  const query = search.toString();
  return query === "" ? path : `${path}?${query}`;
}
