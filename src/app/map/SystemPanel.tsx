"use client";

import { useMemo, useState } from "react";
import { Link, useClientMessages, useFormat } from "@/i18n/client";
import { fill } from "@/shared/format";
import { slugify } from "@/shared/slug";
import { habitableZone, zonePlace, type ZonePlace } from "./habitableZone";
import { knownAxisAu } from "./orbits";
import { BUTTON, PANEL, TEXT_LINK } from "./panelStyles";
import { distanceText } from "./panelText";
import type { MapSystemPayload } from "./payload";

/**
 * A dot in the colour of the zone on the map: filled for an orbit within the conservative limits, a ring
 * for one that only the optimistic limits take in. With `label` it says so, to the mouse and to screen readers.
 */
function ZoneDot({ place, label = false }: { place: ZonePlace; label?: boolean }) {
  const { map } = useClientMessages();
  const text = place === "conservative" ? map.inZone : map.atZoneEdge;
  return (
    <span
      title={label ? text : undefined}
      className={`inline-block size-2 shrink-0 rounded-full border border-[#4dbd75] ${place === "conservative" ? "bg-[#4dbd75]" : ""}`}
    >
      {label && <span className="sr-only">{text}</span>}
    </span>
  );
}

/** A small moon comes to the map as a row of numbers without an address, so its page is found by its name. */
function smallMoonLink(name: string): { name: string; href: string } {
  return { name, href: `/solar-system/${slugify(name)}` };
}

/** The panel of a system: its switches, its star and the list of its planets and their moons. */
export function SystemPanel({
  system,
  planet,
  moon,
  paused,
  trueScale,
  moons,
  zone,
  onFocus,
  onPause,
  onScale,
  onMoons,
  onZone,
  onLeave,
  onHide,
}: {
  system: MapSystemPayload;
  planet: number | null;
  moon: number | null;
  paused: boolean;
  trueScale: boolean;
  moons: boolean;
  zone: boolean;
  onFocus: (index: number | null, moon: number | null) => void;
  onScale: (trueScale: boolean) => void;
  onMoons: (shown: boolean) => void;
  onZone: (shown: boolean) => void;
  onPause: (paused: boolean) => void;
  onLeave: () => void;
  onHide: () => void;
}) {
  const { star, planets } = system;
  const { map: text } = useClientMessages();
  const fmt = useFormat();
  // On narrow screens the planet list would cover the view, so it can be collapsed there.
  const [listOpen, setListOpen] = useState(false);
  const choose = (index: number | null, moonIndex: number | null = null) => {
    setListOpen(false);
    onFocus(index, moonIndex);
  };
  const followed: { name: string; href: string } | null =
    planet === null
      ? null
      : moon === null
        ? planets[planet]
        : moon < planets[planet].moons.length
          ? planets[planet].moons[moon]
          : smallMoonLink(planets[planet].smallMoons[moon - planets[planet].moons.length][0]);
  const limits = useMemo(() => habitableZone(star), [star]);
  /** For each planet, which part of the shown zone its orbit lies in, if any. */
  const places = useMemo(
    () =>
      planets.map((item) => {
        const axis = knownAxisAu(item, star.massSun);
        return zone && limits && axis !== null ? zonePlace(limits, axis) : null;
      }),
    [planets, star, zone, limits],
  );
  return (
    <section className={`${PANEL} flex min-h-0 flex-col gap-3 p-4`}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} onClick={onLeave}>
          {text.galaxy}
        </button>
        <button type="button" className={BUTTON} onClick={() => onPause(!paused)} aria-pressed={paused}>
          {paused ? text.play : text.pause}
        </button>
        {/* The button names the scale that is shown; a click switches to the other one. */}
        <button
          type="button"
          className={BUTTON}
          onClick={() => onScale(!trueScale)}
          title={trueScale ? text.toCompressed : text.toTrueScale}
        >
          {trueScale ? text.trueScale : text.compressed}
        </button>
        <button
          type="button"
          className={`${BUTTON} aria-pressed:border-accent aria-pressed:text-accent`}
          onClick={() => onZone(!zone)}
          aria-pressed={zone && limits !== null}
          disabled={limits === null}
          title={limits === null ? text.zoneUnknown : text.zoneTitle}
        >
          {text.zone}
        </button>
      </div>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-lg leading-6 font-semibold wrap-break-word">{star.name}</h2>
          <button
            type="button"
            className="shrink-0 rounded-md px-1.5 text-lg leading-6 text-muted hover:text-foreground"
            onClick={onHide}
            aria-label={text.hidePanel}
            title={text.hidePanelTitle}
          >
            «
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-muted">
          {star.isSun ? text.ownStar : star.distPc !== null ? distanceText(star.distPc, text, fmt) : text.unknownDistance}
          {" · "}
          <Link className="text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current" href={`/stars/${star.slug}`}>
            {text.starPage}
          </Link>
        </p>
        {zone && limits && (
          <p className="mt-1 text-sm leading-6 text-muted">
            <ZoneDot place="conservative" /> {fill(text.zoneRange, { inner: fmt.number(limits.inner), outer: fmt.number(limits.outer) })}
            {places.every((place) => place === null) && planets.length > 0 && (
              <>
                <br />
                {text.zoneEmpty}
              </>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 sm:hidden">
        <button
          type="button"
          className={`${BUTTON} flex min-w-0 flex-1 items-center justify-between gap-2`}
          aria-expanded={listOpen}
          onClick={() => setListOpen(!listOpen)}
        >
          <span className="truncate">{followed ? followed.name : text.wholeSystem}</span>
          <span aria-hidden="true">{listOpen ? "▴" : "▾"}</span>
        </button>
        {followed && (
          <Link className={`${TEXT_LINK} shrink-0`} href={followed.href}>
            {text.page}
          </Link>
        )}
      </div>
      <ul
        className={`-mx-2 min-h-0 flex-col overflow-y-auto sm:flex ${listOpen ? "flex" : "hidden"}`}
      >
        <li>
          <button
            type="button"
            onClick={() => choose(null)}
            aria-pressed={planet === null}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface ${planet === null ? "bg-surface text-foreground" : "text-muted"}`}
          >
            {text.wholeSystem}
          </button>
        </li>
        {planets.map((item, index) => (
          <li key={item.slug}>
            <div
              className={`flex items-center justify-between gap-2 rounded-md hover:bg-surface ${planet === index && moon === null ? "bg-surface" : ""}`}
            >
              <button
                type="button"
                onClick={() => choose(index)}
                aria-pressed={planet === index && moon === null}
                className="min-w-0 flex-1 px-2 py-1.5 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{item.name}</span>
                  {places[index] && <ZoneDot place={places[index]} label />}
                </span>
                <span className="block truncate text-xs text-muted">{item.description}</span>
              </button>
              {planet === index && item.moons.length + item.smallMoons.length > 0 && (
                <button
                  type="button"
                  onClick={() => onMoons(!moons)}
                  className="shrink-0 text-xs text-muted hover:text-foreground"
                >
                  {moons ? text.hideMoons : text.showMoons}
                </button>
              )}
              {planet === index && moon === null && (
                <Link className={`${TEXT_LINK} shrink-0 pr-2`} href={item.href}>
                  {text.page}
                </Link>
              )}
            </div>
            {planet === index && moons && item.moons.length + item.smallMoons.length > 0 && (
              <ul className="ml-3 border-l border-line pl-1" aria-label={fill(text.moonsOf, { name: item.name })}>
                {item.moons.map((satellite, moonIndex) => (
                  <li
                    key={satellite.slug}
                    className={`flex items-center justify-between gap-2 rounded-md hover:bg-surface ${moon === moonIndex ? "bg-surface" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => choose(index, moonIndex)}
                      aria-pressed={moon === moonIndex}
                      className="min-w-0 flex-1 truncate px-2 py-1 text-left text-sm"
                    >
                      {satellite.name}
                    </button>
                    {moon === moonIndex && (
                      <Link className={`${TEXT_LINK} shrink-0 pr-2`} href={satellite.href}>
                        {text.page}
                      </Link>
                    )}
                  </li>
                ))}
                {item.smallMoons.length > 0 && (
                  <li className="px-2 pt-2 pb-1 text-xs text-muted">
                    {item.smallMoons.length === 1 ? text.smallerOne : fill(text.smallerOther, { n: item.smallMoons.length })}
                  </li>
                )}
                {item.smallMoons.map(([name], smallIndex) => {
                  const moonIndex = item.moons.length + smallIndex;
                  return (
                    <li key={name} className={`rounded-md hover:bg-surface ${moon === moonIndex ? "bg-surface" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => choose(index, moonIndex)}
                          aria-pressed={moon === moonIndex}
                          className="min-w-0 flex-1 truncate px-2 py-0.5 text-left text-xs"
                        >
                          {name}
                        </button>
                        {moon === moonIndex && (
                          <Link className={`${TEXT_LINK} shrink-0 pr-2`} href={smallMoonLink(name).href}>
                            {text.page}
                          </Link>
                        )}
                      </div>
                      {moon === moonIndex && (
                        <p className="px-2 pb-1 text-xs leading-5 text-muted">
                          {text.illustration}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {planets.length === 0 && (
        <p className="text-sm text-muted">{text.noPlanets}</p>
      )}
    </section>
  );
}
