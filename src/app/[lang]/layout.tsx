import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { GlobeWarmup } from "@/app/globe/GlobeWarmup";
import { SiteHeader } from "@/app/SiteHeader";
import { ClientMessagesProvider, Link } from "@/i18n/client";
import { LOCALES } from "@/i18n/locales";
import { getMessages } from "@/i18n/server";

// Turkish needs letters such as ş, ğ and ı, which the extended subset holds.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

/** Every page is built once per language. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages();
  return {
    title: { default: "ExoFinder", template: "%s · ExoFinder" },
    description: m.site.description,
  };
}

const TEXT_LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const m = await getMessages();
  const [beforeArchive, beforeCredits, afterCredits] = m.site.footer;
  return (
    <html lang={m.locale} className={`${geistSans.variable} ${geistMono.variable} h-full scheme-dark antialiased`}>
      {/* The map fills the window below the header: there the page does not scroll and has no footer. */}
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground on-map-page:h-dvh on-map-page:overflow-hidden">
        <ClientMessagesProvider locale={m.locale} messages={m.client}>
          <SiteHeader />
          {children}
          <footer className="border-t border-line on-map-page:hidden">
            <p className="mx-auto w-full max-w-4xl px-6 pt-5 text-sm leading-6 text-muted">
              {beforeArchive}
              <a className={TEXT_LINK} href="https://exoplanetarchive.ipac.caltech.edu/">
                NASA Exoplanet Archive
              </a>
              {beforeCredits}
              <Link className={TEXT_LINK} href="/credits">
                {m.site.credits}
              </Link>
              {afterCredits}
            </p>
            <div className="mx-auto flex w-full max-w-4xl px-6 pt-3 pb-5 text-sm text-muted">
              {/* The map has no footer and carries these links itself (map/MilkyWayMap.tsx). */}
              <nav aria-label={m.site.legal} className="flex gap-5">
                <Link href="/credits" className="transition-colors hover:text-foreground">
                  {m.site.credits}
                </Link>
                <Link href="/legal/notice" className="transition-colors hover:text-foreground">
                  {m.site.legalNotice}
                </Link>
                <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
                  {m.site.privacy}
                </Link>
              </nav>
            </div>
          </footer>
          <GlobeWarmup />
        </ClientMessagesProvider>
      </body>
    </html>
  );
}
