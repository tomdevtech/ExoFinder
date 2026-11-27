import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./locales";
import { messagesFor, type Messages } from "./messages";

/** The language of the page that is being rendered, from the first part of its address. */
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  // The proxy only lets addresses through that start with a language, so this guards a mistake in it.
  if (!hasLocale(locale)) notFound();
  return locale;
}

/** The texts of the page that is being rendered, in its language. */
export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
