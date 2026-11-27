import type { Locale } from "../locales";
import { de } from "./de";
import { en, type Messages } from "./en";
import { tr } from "./tr";

export type { ClientMessages, Messages } from "./en";

const MESSAGES: Record<Locale, Messages> = { en, de, tr };

/** The texts of a language. */
export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** The name of a body in a language: the planets, the Sun and the Moon have names of their own in each. */
export function nameOf(messages: Messages, slug: string, name: string): string {
  return messages.names[slug] ?? name;
}
