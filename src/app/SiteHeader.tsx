import Link from "next/link";
import { catalogueHref } from "./catalog/editions";
import { Logo } from "./Logo";
import { SearchBox } from "./search/SearchBox";

/**
 * The bar at the top of every page, with the name, the search, links to the planet list, the map and the
 * solar system, and the download of the catalogue as a PDF file.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line">
      {/* On a phone the search field gets a row of its own below the name and the links. */}
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2.5 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          ExoFinder
        </Link>
        <div className="order-last min-w-0 basis-full on-start-page:invisible max-sm:on-start-page:hidden sm:order-0 sm:max-w-sm sm:flex-1 sm:basis-0">
          <SearchBox />
        </div>
        <nav className="ml-auto flex shrink-0 gap-4 text-sm">
          <Link href="/planets" className="text-muted transition-colors hover:text-foreground">
            Planets
          </Link>
          <Link href="/map" className="text-muted transition-colors hover:text-foreground">
            Map
          </Link>
          <Link href="/stars/sun" className="text-muted transition-colors hover:text-foreground">
            Solar system
          </Link>
          {/* A phone has no room for it in this row; there the start page offers the download. */}
          <a
            href={catalogueHref()}
            title="The whole catalogue as a PDF file"
            className="text-muted transition-colors hover:text-foreground max-sm:hidden"
          >
            <span className="lg:hidden">Catalogue</span>
            <span className="max-lg:hidden">Download full catalogue</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
