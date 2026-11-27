"use client";

import { isSpecialStar, SPECIAL_STAR_SLUG } from "@/app/stars/my-special-star/star";
import { Link, useClientMessages, useFormat } from "@/i18n/client";
import { fill } from "@/shared/format";
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
  const { map: text } = useClientMessages();
  const fmt = useFormat();
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
          aria-label={text.clear}
          className="-mt-1 -mr-1 shrink-0 rounded px-2 py-1 text-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <p className="text-sm leading-6 text-muted">
        {isSun ? text.ownStar : distanceText(Math.hypot(x, y, z), text, fmt)}
        <br />
        {isSun ? fill(text.sunPlanets, { n: planetCount }) : planetsText(planetCount, text)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY} onClick={onEnter} disabled={entering}>
          {entering ? text.entering : text.enter}
        </button>
        <button type="button" className={BUTTON} onClick={onFly}>
          {text.fly}
        </button>
        <Link className={`${TEXT_LINK} ml-1`} href={`/stars/${slug}`}>
          {text.starPage}
        </Link>
      </div>
      {failed && (
        <p className="text-sm text-warning" role="alert">
          {text.systemFailed}
        </p>
      )}
    </section>
  );
}

/** Panel for the easter-egg star, which has no system to enter and only links to its info page. */
function SpecialStarPanel({ name, onFly, onClose }: { name: string; onFly: () => void; onClose: () => void }) {
  const { map: text } = useClientMessages();
  return (
    <section
      className={`${PANEL} flex flex-col gap-3 border-[#ff9ccf]/50 p-4 shadow-[0_0_24px_rgba(255,156,207,0.25)]`}
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg leading-6 font-semibold wrap-break-word text-[#ff9ccf]">{name} ♥</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={text.clear}
          className="-mt-1 -mr-1 shrink-0 rounded px-2 py-1 text-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <p className="text-sm leading-6 text-muted">
        {text.specialWhere}
        <br />
        {text.specialWhat}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/stars/${SPECIAL_STAR_SLUG}`}
          className="rounded-md bg-[#ff9ccf] px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {text.specialOpen}
        </Link>
        <button type="button" className={BUTTON} onClick={onFly}>
          {text.fly}
        </button>
      </div>
    </section>
  );
}
