/** The languages of the site. The first part of every address names one of them: `/de/planets/earth`. */
export const LOCALES = ["en", "de", "tr"] as const;

export type Locale = (typeof LOCALES)[number];

/** The language of a visitor whose browser asks for none of ours. */
export const DEFAULT_LOCALE: Locale = "en";

/** Each language in its own words, for the links that switch between them. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch", tr: "Türkçe" };

/** The regions whose conventions numbers and dates follow. */
export const INTL_LOCALES: Record<Locale, string> = { en: "en-US", de: "de-DE", tr: "tr-TR" };

export function hasLocale(value: string | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? "");
}

/** The address of a page in a language. `href` is the address without a language, such as `/planets/earth`. */
export function localHref(locale: Locale, href: string): string {
  return href === "/" ? `/${locale}` : `/${locale}${href}`;
}

/** Splits an address into its language, if it starts with one, and the address without it. */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const [, first, ...others] = pathname.split("/");
  if (!hasLocale(first)) return { locale: null, rest: pathname };
  return { locale: first, rest: `/${others.join("/")}` };
}

/**
 * The language a browser asks for with its Accept-Language header, such as `tr-TR,tr;q=0.9,en;q=0.8`:
 * the supported one with the highest weight, or the default. Only the language counts, not the region.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const weight = params.map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1]).find(Boolean);
      // Entries of the same weight keep the order the browser gave them.
      return { language: tag.toLowerCase().split("-")[0], weight: weight === undefined ? 1 : Number(weight), index };
    })
    .filter((entry) => entry.weight > 0 && hasLocale(entry.language))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return (wanted[0]?.language as Locale | undefined) ?? DEFAULT_LOCALE;
}
