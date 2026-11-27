import type { Metadata } from "next";
import { Suspense } from "react";
import { planetAppearance } from "@/app/planets/appearance";
import { rangeText } from "@/app/planets/listText";
import { PAGE_SIZE, type ListSort, listHref, parseFilter, parseSort } from "@/app/planets/paging";
import { PlanetDot } from "@/app/planets/PlanetDot";
import { PlanetFilter } from "@/app/planets/PlanetFilter";
import { listPlanets } from "@/app/planets/queries";
import { isFiltered, parseTypeFilter, type TypeFilter } from "@/app/planets/typeFilter";
import { TypeFilters } from "@/app/planets/TypeFilters";
import { Link } from "@/i18n/client";
import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { Pager } from "@/shared/Pager";
import { pageCount, parsePage } from "@/shared/paging";

export async function generateMetadata(): Promise<Metadata> {
  const { list } = await getMessages();
  return { title: list.title, description: list.description };
}

type Props = PageProps<"/[lang]/planets">;
type SearchParams = Props["searchParams"];

export default async function PlanetListPage({ searchParams }: Props) {
  const { list } = await getMessages();
  // The page shell is static. Filter, kind of planet, sort order and page come from the URL, which is only
  // known at request time, so the field, the chips and the list stream in. They suspend separately so the
  // field and the chips keep their place while a new list loads.
  return (
    <main className="group mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{list.title}</h1>
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
      <Suspense fallback={<ListSkeleton label={list.loading} />}>
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
  const m = await getMessages();
  const { list } = m;
  const { planets, total, page } = await listPlanets(filter, parsePage(pageParam), sort, type);

  if (total === 0) {
    return <p className="text-muted">{!isFiltered(type) ? list.noMatch(filter) : list.empty(type, filter)}</p>;
  }

  const pages = pageCount(total, PAGE_SIZE);

  return (
    // The list dims while the filter field waits for the server (PlanetFilter sets data-pending).
    <section className="flex flex-col gap-5 transition-opacity group-has-data-pending:opacity-50">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-muted">
          {list.count(type, total, filter)}
          {rangeText(m, page, PAGE_SIZE, planets.length, total)}
        </p>
        <SortSwitch filter={filter} sort={sort} type={type} />
      </div>

      <Pager page={page} pages={pages} label={list.pagesTop} href={(target) => listHref(filter, target, sort, type)} />

      <div>
        <div className="flex items-center gap-3 border-b border-line pb-2 text-xs tracking-wide text-muted uppercase">
          {/* This spacer is as wide as the image, so "Planet" lines up with the names. */}
          <span className="w-7 shrink-0" />
          <span className="min-w-0 flex-1">{list.planet}</span>
          <span className={STAR_COLUMN}>{list.star}</span>
          <span className={YEAR_COLUMN}>{list.discovered}</span>
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
                <span className="min-w-0 flex-1 truncate">{nameOf(m, planet.slug, planet.name)}</span>
                <span className={`${STAR_COLUMN} text-sm text-muted`}>
                  {planet.source === "sol" ? nameOf(m, "sun", planet.starName) : planet.starName}
                </span>
                <span className={`${YEAR_COLUMN} text-sm text-muted`}>
                  {planet.discoveryYear ?? <span title={list.antiquity}>–</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center">
        <Pager page={page} pages={pages} label={list.pagesBottom} href={(target) => listHref(filter, target, sort, type)} />
      </div>
    </section>
  );
}

/** Switches between sorting by name and by discovery year, newest first. A new order starts on page 1 and keeps the filters. */
async function SortSwitch({ filter, sort, type }: { filter: string; sort: ListSort; type: TypeFilter }) {
  const { list } = await getMessages();
  const sorts: { sort: ListSort; label: string }[] = [
    { sort: "name", label: list.byName },
    { sort: "discovery", label: list.byDiscovery },
  ];
  return (
    <nav aria-label={list.sortOrder} className="flex items-center gap-2 text-sm">
      <span className="text-muted">{list.sortBy}</span>
      <div className="flex rounded-md border border-line p-0.5">
        {sorts.map((option) =>
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

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label={label}>
      {Array.from({ length: 24 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 border-b border-line/50 py-2">
          <div className="size-7 shrink-0 rounded-full bg-surface" />
          <div className="h-4 w-1/3 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
