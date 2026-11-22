import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GlobeWarmup } from "./globe/GlobeWarmup";
import { SiteHeader } from "./SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ExoFinder", template: "%s · ExoFinder" },
  description:
    "Every known exoplanet: searchable, with a page for each planet and its star, and our own solar system for comparison.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scheme-dark antialiased`}
    >
      {/* The map fills the window below the header: there the page does not scroll and has no footer. */}
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground on-map-page:h-dvh on-map-page:overflow-hidden">
        <SiteHeader />
        {children}
        <footer className="border-t border-line on-map-page:hidden">
          <p className="mx-auto w-full max-w-4xl px-6 pt-5 text-sm leading-6 text-muted">
            Exoplanet data from the{" "}
            <a
              className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
              href="https://exoplanetarchive.ipac.caltech.edu/"
            >
              NASA Exoplanet Archive
            </a>
            . Images of exoplanets are illustrations computed from the data, not photographs. Where every
            picture, map and value comes from is listed under{" "}
            <Link
              className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current"
              href="/credits"
            >
              Credits
            </Link>
            .
          </p>
          {/* The map has no footer and carries these links itself (map/MilkyWayMap.tsx). */}
          <nav
            aria-label="Legal"
            className="mx-auto flex w-full max-w-4xl gap-5 px-6 pt-3 pb-5 text-sm text-muted"
          >
            <Link href="/credits" className="transition-colors hover:text-foreground">
              Credits
            </Link>
            <Link href="/legal/notice" className="transition-colors hover:text-foreground">
              Legal notice
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </footer>
        <GlobeWarmup />
      </body>
    </html>
  );
}
