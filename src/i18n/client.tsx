"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, type ComponentProps, type ReactNode } from "react";
import { formatters, type Formatters } from "@/shared/format";
import { INTL_LOCALES, localHref, type Locale } from "./locales";
import type { ClientMessages } from "./messages";

const ClientMessagesContext = createContext<{ locale: Locale; messages: ClientMessages } | null>(null);

/**
 * Hands the language of the page and the texts of the browser's components down to them. The layout passes
 * the ones of the page's language, so the browser loads no language but the one it shows.
 */
export function ClientMessagesProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: ClientMessages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <ClientMessagesContext value={value}>{children}</ClientMessagesContext>;
}

function useHandedDown() {
  const value = useContext(ClientMessagesContext);
  if (!value) throw new Error("No texts were handed down: ClientMessagesProvider is missing above this component.");
  return value;
}

/** The texts of the components that run in the browser. */
export function useClientMessages(): ClientMessages {
  return useHandedDown().messages;
}

/**
 * The language of the page. It is handed down instead of read from the address, because a page whose
 * address is not known when the site is built could not be prepared ahead with a component that reads it.
 */
export function useLocale(): Locale {
  return useHandedDown().locale;
}

/** Numbers, dates and periods in the language of the page. */
export function useFormat(): Formatters {
  const locale = useLocale();
  const { units } = useClientMessages();
  return useMemo(() => formatters(INTL_LOCALES[locale], units), [locale, units]);
}

/** Turns an address without a language, such as `/planets/earth`, into the one of the page's language. */
export function useLocalHref(): (href: string) => string {
  const locale = useLocale();
  return (href) => localHref(locale, href);
}

/** A router that takes addresses without a language and leads to them in the language of the page. */
export function useLocalRouter() {
  const router = useRouter();
  const locale = useLocale();
  return useMemo(
    () => ({
      push: (href: string) => router.push(localHref(locale, href)),
      replace: (href: string, options?: { scroll?: boolean }) => router.replace(localHref(locale, href), options),
    }),
    [router, locale],
  );
}

/**
 * A link to a page of the site in the language of the page it stands on. `href` is the address without a
 * language, so the components that link need not know which language they are shown in.
 */
export function Link({ href, ...rest }: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const local = useLocalHref();
  return <NextLink href={local(href)} {...rest} />;
}
