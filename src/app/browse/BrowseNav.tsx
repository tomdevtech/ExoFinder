import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { formatCount } from "@/shared/format";
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
export function BrowseNav({ href }: { href: string }) {
  const known = solarPlace(href, null);
  return (
    <Suspense fallback={known ? <BrowseBar place={known} /> : <div className="min-h-14" aria-hidden="true" />}>
      <LoadedBrowseNav href={href} />
    </Suspense>
  );
}

async function LoadedBrowseNav({ href }: { href: string }) {
  // The pages of the moons are built ahead of time, and the build has to work without a database.
  // `io()` has to stay outside the try block.
  await io();

  if (solarPlace(href, null)) {
    let start: ExoplanetStart | null = null;
    try {
      start = await getExoplanetStart();
    } catch (error) {
      // A page of the solar system needs nothing else from the database, so it stays up without it.
      console.error("Could not load where the exoplanets start:", error);
    }
    const place = solarPlace(href, start);
    return place && <BrowseBar place={place} />;
  }

  const slug = href.startsWith("/planets/") ? href.slice("/planets/".length) : "";
  const neighbours = await getExoplanetNeighbours(slug);
  return neighbours && <BrowseBar place={exoplanetPlace(neighbours)} />;
}

function BrowseBar({ place }: { place: Place }) {
  const { position, total, previous, next, skipBack, skipAhead } = place;
  return (
    // BrowseKeys looks for the attribute, so that the arrow keys keep browsing while a link here has the focus.
    <nav
      aria-label="Browse the catalogue"
      data-browse-nav=""
      className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center"
    >
      <BrowseKeys previous={previous?.href ?? null} next={next?.href ?? null} />
      {previous ? <StepLink step={previous} direction="previous" /> : <span />}
      {/* On a narrow screen the number stands above the two links, which then share a row. */}
      <div className="order-first col-span-2 flex flex-col items-center gap-0.5 text-muted sm:order-0 sm:col-span-1 sm:px-2">
        <p className="tabular-nums">
          No. {formatCount(position)}
          {total !== null && ` of ${formatCount(total)}`}
        </p>
        {(skipBack || skipAhead) && (
          <p className="flex flex-wrap justify-center gap-x-3 text-xs">
            <span>Skip the moons:</span>
            {skipBack && (
              <Link className={SKIP} href={skipBack.href}>
                back to {skipBack.name}
              </Link>
            )}
            {skipAhead && (
              <Link className={SKIP} href={skipAhead.href}>
                on to {skipAhead.name}
              </Link>
            )}
          </p>
        )}
      </div>
      {next ? <StepLink step={next} direction="next" /> : <span />}
    </nav>
  );
}

function StepLink({ step, direction }: { step: Step; direction: "previous" | "next" }) {
  const back = direction === "previous";
  return (
    <Link
      href={step.href}
      rel={back ? "prev" : "next"}
      aria-keyshortcuts={back ? "ArrowLeft" : "ArrowRight"}
      className={`${STEP} ${back ? "" : "items-end text-right"}`}
    >
      <span className="text-xs text-muted">{back ? "Previous" : "Next"}</span>
      <span className="max-w-full truncate font-medium">{step.name}</span>
      {step.system && <span className="max-w-full truncate text-xs text-muted">{step.system}</span>}
    </Link>
  );
}
