"use client";

import Form from "next/form";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useClientMessages, useLocale, useLocalHref, useLocalRouter } from "@/i18n/client";
import type { Suggestion } from "./suggest/route";

/** The filters of the search page (`TypeFilter` in filters.ts) that a new query keeps. */
const CARRIED = ["type", "climate"] as const;

/** Shorter input gets no suggestions. Matches MIN_QUERY_LENGTH on the server. */
const MIN_LENGTH = 2;
/** Delay after the last key press before the server is asked. */
const DEBOUNCE_MS = 150;

/**
 * The search field with live suggestions.
 *
 * Typing fetches the best matches from /search/suggest. Enter without a selected suggestion submits the form
 * to /search?q=…, which also works before JavaScript has loaded.
 */
export function SearchBox({
  size = "md",
  autoFocus = false,
  className = "",
}: {
  size?: "md" | "lg";
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useLocalRouter();
  const locale = useLocale();
  const local = useLocalHref();
  const text = useClientMessages().search;
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  /** Index of the suggestion picked with the arrow keys, -1 for none. */
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);

  function cancelPending() {
    clearTimeout(timer.current);
    request.current?.abort();
  }

  // Abort pending requests on unmount so that no late response updates the component.
  useEffect(() => cancelPending, []);

  function handleInput(value: string) {
    setQuery(value);
    setActive(-1);
    setOpen(true);
    cancelPending();
    if (value.trim().length < MIN_LENGTH) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(`/search/suggest?q=${encodeURIComponent(value)}&lang=${locale}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body: { suggestions: Suggestion[] } = await response.json();
        setSuggestions(body.suggestions);
      } catch {
        // Aborted because the user kept typing, or the network failed. The
        // form still works, so there is nothing to report.
      }
    }, DEBOUNCE_MS);
  }

  function close() {
    cancelPending();
    setOpen(false);
    setActive(-1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    close();
    // A new query on the search page keeps the kind of planet chosen there. The field sits in the header
    // of every page and cannot subscribe to the address without holding up the static frame, so it reads
    // the filter when the form is sent. Elsewhere the fields are switched off again.
    const filters = window.location.pathname === local("/search") ? new URLSearchParams(window.location.search) : null;
    for (const name of CARRIED) {
      const field = event.currentTarget.elements.namedItem(name);
      if (!(field instanceof HTMLInputElement)) continue;
      field.value = filters?.get(name) ?? "";
      field.disabled = field.value === "";
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Cycles through the suggestions and through "none" at index -1.
      setActive((current) => {
        const count = suggestions.length + 1;
        return ((current + 1 + step + count) % count) - 1;
      });
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      router.push(suggestions[active].href);
      close();
    }
  }

  const showList = open && suggestions.length > 0;
  const large = size === "lg";

  return (
    <div
      className={`relative ${className}`}
      onBlur={(event) => {
        // Close only when the focus leaves both the field and the list.
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <Form action={local("/search")} role="search" onSubmit={handleSubmit}>
        {/* Disabled fields are not sent. `handleSubmit` enables those the search page has a filter for. */}
        {CARRIED.map((name) => (
          <input key={name} type="hidden" name={name} disabled />
        ))}
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          maxLength={80}
          placeholder={text.placeholder}
          aria-label={text.placeholder}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          className={`w-full rounded-lg border border-line bg-surface text-foreground placeholder:text-muted focus:border-accent focus:outline-none ${
            large ? "px-5 py-3.5 text-lg" : "px-3.5 py-2 text-sm"
          }`}
        />
      </Form>
      <div
        id={listId}
        role="listbox"
        aria-label={text.suggestions}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-xl shadow-black/50"
      >
        {suggestions.map((suggestion, index) => (
          <Link
            key={suggestion.href}
            href={suggestion.href}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            onClick={close}
            onMouseEnter={() => setActive(index)}
            className={`flex items-baseline justify-between gap-4 px-3.5 py-2 text-sm ${
              index === active ? "bg-accent/15" : ""
            }`}
          >
            <span className="truncate font-medium">{suggestion.name}</span>
            <span className="shrink-0 text-xs text-muted">{suggestion.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
