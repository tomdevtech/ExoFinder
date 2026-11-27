import type { Metadata } from "next";
import { Suspense } from "react";
import { rangeText } from "@/app/planets/listText";
import { PlanetCard } from "@/app/planets/PlanetCard";
import { isFiltered, parseTypeFilter, type TypeFilter } from "@/app/planets/typeFilter";
import { TypeFilters } from "@/app/planets/TypeFilters";
import { searchHref } from "@/app/search/filters";
import { MIN_QUERY_LENGTH, search, searchByType } from "@/app/search/query";
import { BodyCard } from "@/app/solar-system/BodyCard";
import { StarCard } from "@/app/stars/StarCard";
import { getMessages } from "@/i18n/server";
import { Pager } from "@/shared/Pager";
import { pageCount, parsePage } from "@/shared/paging";
import { firstParam } from "@/shared/params";

/** The most hits of a search by name, and the size of a page of a search by type. */
const RESULT_LIMIT = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { search: text } = await getMessages();
  return { title: text.title, description: text.description };
}

type Props = PageProps<"/[lang]/search">;
type SearchParams = Props["searchParams"];

export default async function SearchPage({ searchParams }: Props) {
  const { search: text } = await getMessages();
  // The page shell is static. The query and the filter in the URL are only known at request time, so
  // everything that depends on them streams in. The chips suspend apart from the results, so they are
  // there at once and keep their place while the results load.
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
      <Suspense fallback={<TypeFilters />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton label={text.searching} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Filters({ searchParams }: { searchParams: SearchParams }) {
  const { q, type, climate } = await searchParams;
  const query = firstParam(q);
  // A new filter starts on page 1.
  return <TypeFilters filter={parseTypeFilter(type, climate)} href={(filter) => searchHref(query, filter)} />;
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const { q, type, climate, page } = await searchParams;
  const query = firstParam(q);
  const filter = parseTypeFilter(type, climate);
  if (isFiltered(filter)) return <TypedResults query={query} filter={filter} page={parsePage(page)} />;

  const m = await getMessages();
  const text = m.search;
  if (query === "") return <p className="text-muted">{text.hint}</p>;

  const { hits, similarOnly, hasMore } = await search(query, RESULT_LIMIT, m.locale);

  if (hits.length === 0) {
    return (
      <p className="text-muted">
        {text.noMatch(query)}
        {query.length < MIN_QUERY_LENGTH ? text.tooShort(MIN_QUERY_LENGTH) : text.tryShorter}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted">
        {similarOnly
          ? text.similar(query)
          : hasMore
            ? text.firstMatches(hits.length, query)
            : text.matches(hits.length, query)}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hits.map((hit) =>
          hit.kind === "planet" ? (
            <li key={`planet-${hit.planet.slug}`}>
              <PlanetCard planet={hit.planet} showStar />
            </li>
          ) : hit.kind === "body" ? (
            <li key={`body-${hit.body.slug}`}>
              <BodyCard body={hit.body} showParent />
            </li>
          ) : (
            <li key={`star-${hit.star.slug}`}>
              <StarCard star={hit.star} />
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

/** The planets of one kind, all of them or those whose name matches the query, in pages. */
async function TypedResults({ query, filter, page }: { query: string; filter: TypeFilter; page: number }) {
  const m = await getMessages();
  const result = await searchByType(query, filter, page, RESULT_LIMIT);
  const { planets, total, similarOnly } = result;

  if (planets.length === 0) {
    return (
      <p className="text-muted">
        {query !== "" && query.length < MIN_QUERY_LENGTH
          ? m.search.kindTooShort(MIN_QUERY_LENGTH, filter)
          : m.list.empty(filter, query)}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted">
        {similarOnly ? m.search.kindSimilar(filter, query) : m.list.count(filter, total, query)}
        {rangeText(m, result.page, RESULT_LIMIT, planets.length, total)}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {planets.map((planet) => (
          <li key={planet.slug}>
            <PlanetCard planet={planet} showStar />
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <Pager page={result.page} pages={pageCount(total, RESULT_LIMIT)} label={m.list.pages} href={(target) => searchHref(query, filter, target)} />
      </div>
    </section>
  );
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-20 rounded-lg bg-surface" />
      ))}
    </div>
  );
}
