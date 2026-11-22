import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pager } from "@/shared/Pager";
import { pageCount, parsePage } from "@/shared/paging";
import { planetAppearance } from "./appearance";
import { countText, emptyText, rangeText } from "./listText";
import { PAGE_SIZE, type ListSort, listHref, parseFilter, parseSort } from "./paging";
import { PlanetDot } from "./PlanetDot";
import { PlanetFilter } from "./PlanetFilter";
import { isFiltered, parseTypeFilter, type TypeFilter } from "./typeFilter";
import { TypeFilters } from "./TypeFilters";
import { listPlanets } from "./queries";

export const metadata: Metadata = {
  title: "All planets",
  description:
    "Every known exoplanet and the planets of the solar system in one list, sorted by name or by year of discovery, and narrowed to one kind such as temperate rocky planets or hot gas giants.",
};

type Props = PageProps<"/planets">;
type SearchParams = Props["searchParams"];

export default function PlanetListPage({ searchParams }: Props) {
  // The page shell is static. Filter, kind of planet, sort order and page come from the URL, which is only
  // known at request time, so the field, the chips and the list stream in. They suspend separately so the
  // field and the chips keep their place while a new list loads.
  return (
    <main className="group mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">All planets</h1>
      <Suspense
        fallback={
          <>
            <PlanetFilter disabled />
            <TypeFilters />
          </>
        }
      >
        <Filter searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <PlanetList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Filter({ searchParams }: { searchParams: SearchParams }) {
  const { q, sort: sortParam, type: typeParam, climate } = await searchParams;
  const filter = parseFilter(q);
  const sort = parseSort(sortParam);
  const type = parseTypeFilter(typeParam, climate);
  return (
    <>
      <PlanetFilter initial={filter} sort={sort} type={type} />
      {/* Another kind of planet starts on page 1 and keeps the text and the order. */}
      <TypeFilters filter={type} href={(next) => listHref(filter, 1, sort, next)} />
    </>
  );
}

/** Column classes of a row. The header above the list uses the same widths. */
const STAR_COLUMN = "hidden w-52 shrink-0 truncate sm:block";
const YEAR_COLUMN = "w-20 shrink-0 text-right tabular-nums";

async function PlanetList({ searchParams }: { searchParams: SearchParams }) {
  const { q, page: pageParam, sort: sortParam, type: typeParam, climate } = await searchParams;
  const filter = parseFilter(q);
  const sort = parseSort(sortParam);
  const type = parseTypeFilter(typeParam, climate);
  const { planets, total, page } = await listPlanets(filter, parsePage(pageParam), sort, type);

  if (total === 0) {
    return (
      <p className="text-muted">
        {!isFiltered(type)
          ? `No planet matches “${filter}”. Try a shorter part of the name, for example “Kepler-22” or “TRAPPIST”.`
          : emptyText(type, filter)}
      </p>
    );
  }

  const pages = pageCount(total, PAGE_SIZE);

  return (
    // The list dims while the filter field waits for the server (PlanetFilter sets data-pending).
    <section className="flex flex-col gap-5 transition-opacity group-has-data-pending:opacity-50">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-muted">
          {countText(type, total, filter)}
          {rangeText(page, PAGE_SIZE, planets.length, total)}
        </p>
        <SortSwitch filter={filter} sort={sort} type={type} />
      </div>

      <Pager page={page} pages={pages} label="Pages, top" href={(target) => listHref(filter, target, sort, type)} />

      <div>
        <div className="flex items-center gap-3 border-b border-line pb-2 text-xs tracking-wide text-muted uppercase">
          {/* This spacer is as wide as the image, so "Planet" lines up with the names. */}
          <span className="w-7 shrink-0" />
          <span className="min-w-0 flex-1">Planet</span>
          <span className={STAR_COLUMN}>Star</span>
          <span className={YEAR_COLUMN}>Discovered</span>
        </div>
        <ul>
          {planets.map((planet) => (
            <li key={planet.slug} className="border-b border-line/50">
              {/* With 200 links per page, prefetching is off so no link loads its target before a click. */}
              <Link
                href={`/planets/${planet.slug}`}
                prefetch={false}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface"
              >
                <PlanetDot appearance={planetAppearance(planet)} />
                <span className="min-w-0 flex-1 truncate">{planet.name}</span>
                <span className={`${STAR_COLUMN} text-sm text-muted`}>{planet.starName}</span>
                <span className={`${YEAR_COLUMN} text-sm text-muted`}>
                  {planet.discoveryYear ?? <span title="Known since antiquity">–</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center">
        <Pager page={page} pages={pages} label="Pages, bottom" href={(target) => listHref(filter, target, sort, type)} />
      </div>
    </section>
  );
}

const SORTS: { sort: ListSort; label: string }[] = [
  { sort: "name", label: "Name" },
  { sort: "discovery", label: "Discovery year" },
];

/** Switches between sorting by name and by discovery year, newest first. A new order starts on page 1 and keeps the filters. */
function SortSwitch({ filter, sort, type }: { filter: string; sort: ListSort; type: TypeFilter }) {
  return (
    <nav aria-label="Sort order" className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sort by</span>
      <div className="flex rounded-md border border-line p-0.5">
        {SORTS.map((option) =>
          option.sort === sort ? (
            <span
              key={option.sort}
              aria-current="true"
              className="rounded bg-surface px-2.5 py-1 font-medium text-foreground"
            >
              {option.label}
            </span>
          ) : (
            <Link
              key={option.sort}
              href={listHref(filter, 1, option.sort, type)}
              prefetch={false}
              scroll={false}
              className="rounded px-2.5 py-1 text-muted transition-colors hover:text-foreground"
            >
              {option.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading the list">
      {Array.from({ length: 24 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-line/50 py-2">
          <div className="size-7 shrink-0 rounded-full bg-surface" />
          <div className="h-4 w-1/3 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
