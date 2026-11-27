"use client";

import { useMemo, useState, type FormEvent } from "react";
import { isSpecialStar } from "@/app/stars/my-special-star/star";
import { useClientMessages } from "@/i18n/client";
import { findStars, MIN_LENGTH } from "./findStars";
import { PANEL } from "./panelStyles";
import { planetsText } from "./panelText";
import type { MapStar } from "./payload";

/** Search field that finds a star on the map by name. */
export function Finder({ stars, onChoose }: { stars: MapStar[]; onChoose: (index: number) => void }) {
  const { map: text } = useClientMessages();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => findStars(stars, query), [query, stars]);

  const choose = (index: number) => {
    setQuery("");
    onChoose(index);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (matches.length > 0) choose(matches[0]);
  };

  return (
    <form onSubmit={submit} role="search" className={`${PANEL} shrink-0`}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={text.find}
        aria-label={text.find}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted focus-visible:ring-1 focus-visible:ring-accent"
      />
      {matches.length > 0 && (
        <ul className="border-t border-line py-1">
          {matches.map((index) => (
            <li key={stars[index][0]}>
              <button
                type="button"
                onClick={() => choose(index)}
                className="flex w-full items-baseline justify-between gap-3 px-4 py-1.5 text-left text-sm hover:bg-surface"
              >
                <span className="truncate">{stars[index][1]}</span>
                <span className="shrink-0 text-xs text-muted">
                  {isSpecialStar(stars[index][0]) ? text.galacticCentre : planetsText(stars[index][6], text)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= MIN_LENGTH && matches.length === 0 && (
        <p className="border-t border-line px-4 py-2 text-sm text-muted">{text.noStar}</p>
      )}
    </form>
  );
}
