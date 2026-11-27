/**
 * Lower-cases and strips accents, so "Proxima Centauri" and "Próxima Centauri" fold to the same text. The
 * Turkish dotless ı is a letter of its own that no accent rule covers, so it is folded by name.
 */
function fold(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("ı", "i");
}

/** Turns a name into a URL segment, so "Kepler-22 b" becomes `kepler-22-b`. */
export function slugify(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whether `value` can be a slug at all. URLs come from outside, so anything else (a null byte, a slash,
 * 5,000 characters) is answered as "not found" without asking the database, which would reject some of it with an error.
 */
export function isSlug(value: string): boolean {
  return value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/** Longer queries are cut off before they are searched for; no name in the catalogue comes close to this length. */
export const MAX_QUERY_LENGTH = 80;

/** Search key without spaces or punctuation, so "Kepler-22 b", "kepler 22b" and "Kepler22b" all become `kepler22b`. */
export function searchKey(name: string): string {
  return fold(name).replace(/[^a-z0-9]+/g, "");
}

/** Appends -2, -3 … until the slug is free, then reserves it in `taken`. */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name) || "unnamed";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}
