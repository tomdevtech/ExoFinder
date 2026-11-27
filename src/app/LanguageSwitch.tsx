"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useClientMessages, useLocale } from "@/i18n/client";
import { LOCALE_NAMES, LOCALES, localHref, splitLocale } from "@/i18n/locales";

/**
 * The switch in the header that shows the same page in another language. Its items look like the links
 * beside them and show the short code of each language, with the full name for screen readers. They are
 * plain links that load the page anew, because a new language changes everything on it, down to the
 * language the document declares.
 *
 * The address of a page such as a planet's is not known when the site is built, so the part prepared ahead
 * links to the start page of each language, and the links to the page itself follow with the request.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  return (
    <Suspense fallback={<Languages rest="/" className={className} />}>
      <LanguagesOfPage className={className} />
    </Suspense>
  );
}

function LanguagesOfPage({ className }: { className: string }) {
  return <Languages rest={splitLocale(usePathname()).rest} className={className} />;
}

/** `rest` is the address of the page without its language. */
function Languages({ rest, className }: { rest: string; className: string }) {
  const current = useLocale();
  const { language } = useClientMessages();
  return (
    <nav aria-label={language} className={`flex shrink-0 gap-2.5 text-sm ${className}`}>
      {LOCALES.map((locale) =>
        locale === current ? (
          <span key={locale} aria-current="true" title={LOCALE_NAMES[locale]} className="text-foreground">
            {locale.toUpperCase()}
            <span className="sr-only"> {LOCALE_NAMES[locale]}</span>
          </span>
        ) : (
          <a
            key={locale}
            href={localHref(locale, rest)}
            hrefLang={locale}
            title={LOCALE_NAMES[locale]}
            // What follows the question mark of the address is known to the browser alone.
            onClick={(event) => {
              const here = splitLocale(window.location.pathname).rest;
              event.currentTarget.href = localHref(locale, here) + window.location.search;
            }}
            className="text-muted transition-colors hover:text-foreground"
          >
            {locale.toUpperCase()}
            <span className="sr-only" lang={locale}>
              {" "}
              {LOCALE_NAMES[locale]}
            </span>
          </a>
        ),
      )}
    </nav>
  );
}
