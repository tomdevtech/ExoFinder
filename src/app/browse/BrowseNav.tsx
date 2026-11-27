import { io } from "next/cache";
import { Suspense } from "react";
import { Link } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { BrowseKeys } from "./BrowseKeys";
import { exoplanetPlace, solarPlace, type Place, type Step } from "./place";
import { getExoplanetNeighbours, getExoplanetStart, type ExoplanetStart } from "./queries";

const STEP =
  "flex min-w-0 flex-col gap-0.5 rounded-lg border border-line px-3 py-2 transition-colors hover:border-accent/60 hover:bg-surface";
const SKIP = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

/**
 * The links that browse the catalogue from the page of a body at `href`: to the body before it and after
 * it, with its number. A body of the solar system shows its links at once, from the order in the code;
 * what the database adds (the total, and the first exoplanet after the last moon) streams in.
 */
export async function BrowseNav({ href }: { href: string }) {
  const m = await getMessages();
  const known = solarPlace(href, null, m);
  return (
    <Suspense fallback={known ? <BrowseBar place={known} m={m} /> : <div className="min-h-14" aria-hidden="true" />}>
      <LoadedBrowseNav href={href} m={m} />
    </Suspense>
  );
}

async function LoadedBrowseNav({ href, m }: { href: string; m: Messages }) {
  // The pages of the moons are built ahead of time, and the build has to work without a database.
  // `io()` has to stay outside the try block.
  await io();

  if (solarPlace(href, null, m)) {
    let start: ExoplanetStart | null = null;
    try {
      start = await getExoplanetStart();
    } catch (error) {
      // A page of the solar system needs nothing else from the database, so it stays up without it.
      console.error("Could not load where the exoplanets start:", error);
    }
    const place = solarPlace(href, start, m);
    return place && <BrowseBar place={place} m={m} />;
  }

  const slug = href.startsWith("/planets/") ? href.slice("/planets/".length) : "";
  const neighbours = await getExoplanetNeighbours(slug);
  return neighbours && <BrowseBar place={exoplanetPlace(neighbours, m)} m={m} />;
}

function BrowseBar({ place, m }: { place: Place; m: Messages }) {
  const { position, total, previous, next, skipBack, skipAhead } = place;
  const text = m.browse;
  return (
    // BrowseKeys looks for the attribute, so that the arrow keys keep browsing while a link here has the focus.
    <nav
      aria-label={text.label}
      data-browse-nav=""
      className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center"
    >
      <BrowseKeys previous={previous?.href ?? null} next={next?.href ?? null} />
      {previous ? <StepLink step={previous} label={text.previous} back /> : <span />}
      {/* On a narrow screen the number stands above the two links, which then share a row. */}
      <div className="order-first col-span-2 flex flex-col items-center gap-0.5 text-muted sm:order-0 sm:col-span-1 sm:px-2">
        <p className="tabular-nums">{text.number(m.fmt.count(position), total === null ? null : m.fmt.count(total))}</p>
        {(skipBack || skipAhead) && (
          <p className="flex flex-wrap justify-center gap-x-3 text-xs">
            <span>{text.skip}</span>
            {skipBack && (
              <Link className={SKIP} href={skipBack.href}>
                {text.backTo(skipBack.name)}
              </Link>
            )}
            {skipAhead && (
              <Link className={SKIP} href={skipAhead.href}>
                {text.onTo(skipAhead.name)}
              </Link>
            )}
          </p>
        )}
      </div>
      {next ? <StepLink step={next} label={text.next} /> : <span />}
    </nav>
  );
}

function StepLink({ step, label, back = false }: { step: Step; label: string; back?: boolean }) {
  return (
    <Link
      href={step.href}
      rel={back ? "prev" : "next"}
      aria-keyshortcuts={back ? "ArrowLeft" : "ArrowRight"}
      className={`${STEP} ${back ? "" : "items-end text-right"}`}
    >
      <span className="text-xs text-muted">{label}</span>
      <span className="max-w-full truncate font-medium">{step.name}</span>
      {step.system && <span className="max-w-full truncate text-xs text-muted">{step.system}</span>}
    </Link>
  );
}
