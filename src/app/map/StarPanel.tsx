"use client";

import Link from "next/link";
import { isSpecialStar, SPECIAL_STAR_SLUG } from "@/app/stars/my-special-star/star";
import { BUTTON, PANEL, PRIMARY, TEXT_LINK } from "./panelStyles";
import { distanceText, planetsText } from "./panelText";
import type { MapStar } from "./payload";

/** What the map says about the selected star, with the ways on from there. */
export function StarPanel({
  star,
  entering,
  failed,
  onFly,
  onEnter,
  onClose,
}: {
  star: MapStar;
  entering: boolean;
  failed: boolean;
  onFly: () => void;
  onEnter: () => void;
  onClose: () => void;
}) {
  const [slug, name, x, y, z, , planetCount] = star;
  const isSun = slug === "sun";
  if (isSpecialStar(slug)) return <SpecialStarPanel name={name} onFly={onFly} onClose={onClose} />;
  return (
    <section className={`${PANEL} flex flex-col gap-3 p-4`} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg leading-6 font-semibold wrap-break-word">{name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear the selection"
          className="-mt-1 -mr-1 shrink-0 rounded px-2 py-1 text-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <p className="text-sm leading-6 text-muted">
        {isSun ? "Our own star" : distanceText(Math.hypot(x, y, z))}
        <br />
        {isSun ? `${planetCount} planets` : planetsText(planetCount)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY} onClick={onEnter} disabled={entering}>
          {entering ? "Loading…" : "Enter system"}
        </button>
        <button type="button" className={BUTTON} onClick={onFly}>
          Fly there
        </button>
        <Link className={`${TEXT_LINK} ml-1`} href={`/stars/${slug}`}>
          Star page
        </Link>
      </div>
      {failed && (
        <p className="text-sm text-warning" role="alert">
          This system could not be loaded.
        </p>
      )}
    </section>
  );
}

/** Panel for the easter-egg star, which has no system to enter and only links to its info page. */
function SpecialStarPanel({
  name,
  onFly,
  onClose,
}: {
  name: string;
  onFly: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className={`${PANEL} flex flex-col gap-3 border-[#ff9ccf]/50 p-4 shadow-[0_0_24px_rgba(255,156,207,0.25)]`}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg leading-6 font-semibold wrap-break-word text-[#ff9ccf]">
          {name} ♥
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear the selection"
          className="-mt-1 -mr-1 shrink-0 rounded px-2 py-1 text-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <p className="text-sm leading-6 text-muted">
        At the very heart of the Milky Way
        <br />
        The brightest star in the whole galaxy
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/stars/${SPECIAL_STAR_SLUG}`}
          className="rounded-md bg-[#ff9ccf] px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Open the info page
        </Link>
        <button type="button" className={BUTTON} onClick={onFly}>
          Fly there
        </button>
      </div>
    </section>
  );
}
