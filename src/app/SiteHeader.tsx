import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { LanguageSwitch } from "./LanguageSwitch";
import { Logo } from "./Logo";
import { SearchBox } from "./search/SearchBox";

/**
 * The bar at the top of every page, with the name, the search, links to the planet list, the map and the
 * solar system, and the switch between the languages.
 */
export async function SiteHeader() {
  const { nav } = (await getMessages()).site;
  return (
    <header className="border-b border-line">
      {/*
        Everything stands in one row only where the search field keeps a useful width. Below that it gets
        a row of its own, and on a phone the links do too: in German and Turkish they are too long to
        stand next to the name, which shares its row with the language switch there.
      */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2.5 px-6 py-3">
        <Link href="/" className="order-1 flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          ExoFinder
        </Link>
        <div className="order-5 min-w-0 basis-full on-start-page:invisible max-md:on-start-page:hidden md:order-2 md:max-w-sm md:flex-1 md:basis-0">
          <SearchBox />
        </div>
        <nav className="order-3 flex shrink-0 gap-4 text-sm max-sm:basis-full sm:ml-auto">
          <Link href="/planets" className="text-muted transition-colors hover:text-foreground">
            {nav.planets}
          </Link>
          <Link href="/map" className="text-muted transition-colors hover:text-foreground">
            {nav.map}
          </Link>
          <Link href="/stars/sun" className="text-muted transition-colors hover:text-foreground">
            {nav.solarSystem}
          </Link>
        </nav>
        {/* Beside the links a fine line sets the languages apart from the pages. */}
        <LanguageSwitch className="order-2 max-sm:ml-auto sm:order-4 sm:border-l sm:border-line sm:pl-4" />
      </div>
    </header>
  );
}
