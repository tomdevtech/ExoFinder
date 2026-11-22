"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { listHref, type ListSort } from "./paging";
import { NO_FILTER, type TypeFilter } from "./typeFilter";

/** Delay after the last key press before the list is filtered. */
const DEBOUNCE_MS = 250;

/**
 * The filter field above the planet list.
 *
 * The filter lives in the URL (`/planets?q=…`) and the server renders the matching page, so a filtered list
 * can be shared and reloaded. A new text keeps the sort order and the kind of planet chosen with the chips. It is a plain form, so Enter works before JavaScript has loaded. While the
 * server responds, the form carries `data-pending`, which the page uses to dim the list.
 */
export function PlanetFilter({
  initial = "",
  sort = "name",
  type = NO_FILTER,
  disabled = false,
}: {
  /** The filter from the URL. */
  initial?: string;
  /** The sort order from the URL. A new filter keeps it. */
  sort?: ListSort;
  /** The kind of planet from the URL. A new filter keeps it. */
  type?: TypeFilter;
  /** Used by the placeholder that shows until the URL is known. */
  disabled?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [pending, startTransition] = useTransition();

  // Nothing may fire after the component is gone.
  useEffect(() => () => clearTimeout(timer.current), []);

  // Back and forward navigation changes the URL without typing, so the field follows it
  // unless the visitor is typing in it right now.
  useEffect(() => {
    const field = input.current;
    if (field && document.activeElement !== field) field.value = initial;
  }, [initial]);

  function handleInput(value: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        // A new filter starts on page 1. `replace` avoids one history entry per key press,
        // and `scroll: false` keeps the scroll position.
        router.replace(listHref(value.trim(), 1, sort, type), { scroll: false });
      });
    }, DEBOUNCE_MS);
  }

  return (
    <Form
      action="/planets"
      role="search"
      onSubmit={() => clearTimeout(timer.current)}
      data-pending={pending ? "" : undefined}
    >
      <input
        ref={input}
        type="search"
        name="q"
        defaultValue={initial}
        onChange={(event) => handleInput(event.target.value)}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        maxLength={80}
        placeholder="Filter planets by name"
        aria-label="Filter planets by name"
        className="w-full rounded-lg border border-line bg-surface px-5 py-3.5 text-lg text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {/* Keep the kind of planet and the sort order when the form is submitted with Enter. */}
      {type.planetClass && <input type="hidden" name="type" value={type.planetClass} />}
      {type.climateClass && <input type="hidden" name="climate" value={type.climateClass} />}
      {sort !== "name" && <input type="hidden" name="sort" value={sort} />}
    </Form>
  );
}
