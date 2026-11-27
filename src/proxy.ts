import { NextResponse, type NextRequest } from "next/server";
import { localHref, matchLocale, splitLocale } from "@/i18n/locales";

/**
 * Does two things before a request reaches a page.
 *
 * It sends an address without a language, such as `/planets/earth`, on to the same page in the language
 * the browser asks for (`/de/planets/earth`), so old links keep working and nobody has to choose a language
 * first. The language then stays part of the address; nothing is stored in the browser.
 *
 * And it answers URLs with broken percent-encoding, such as `/planets/%E0%A4%A`, with 400 Bad Request.
 * Without this, Next.js fails to decode the slug and answers 500, which looks like a server fault.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  try {
    decodeURIComponent(pathname);
  } catch {
    return new NextResponse("Bad request: the address is not encoded correctly.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (splitLocale(pathname).locale || pathname.startsWith("/map/systems/")) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = localHref(matchLocale(request.headers.get("accept-language")), pathname);
  const response = NextResponse.redirect(target, 307);
  // The answer depends on the language the browser asked for, so nothing between may hand it to another.
  response.headers.set("Vary", "Accept-Language");
  return response;
}

export const config = {
  matcher: [
    // Every address without a language, apart from files, the JSON endpoints and what Next.js serves itself.
    "/((?!en$|en/|de$|de/|tr$|tr/|_next/|health$|map/stars$|map/systems/|search/suggest$|textures/|shapes/|apple-icon|.*\\.[a-z0-9]+$).*)",
    // The routes with a slug in them, whose encoding may be broken.
    "/:lang(en|de|tr)/planets/:path+",
    "/:lang(en|de|tr)/stars/:path+",
    "/:lang(en|de|tr)/solar-system/:path+",
    "/map/systems/:path+",
  ],
};
