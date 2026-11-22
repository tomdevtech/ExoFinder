import type { Metadata } from "next";
import { Suspense } from "react";
import { planetTypeNoun } from "@/app/planets/labels";
import { countText, emptyText, rangeText } from "@/app/planets/listText";
import { PlanetCard } from "@/app/planets/PlanetCard";
import { isFiltered, parseTypeFilter, type TypeFilter } from "@/app/planets/typeFilter";
import { TypeFilters } from "@/app/planets/TypeFilters";
import { BodyCard } from "@/app/solar-system/BodyCard";
import { StarCard } from "@/app/stars/StarCard";
import { Pager } from "@/shared/Pager";
import { pageCount, parsePage } from "@/shared/paging";
import { firstParam } from "@/shared/params";
import { searchHref } from "./filters";
import { MIN_QUERY_LENGTH, search, searchByType } from "./query";

/** The most hits of a search by name, and the size of a page of a search by type. */
const RESULT_LIMIT = 60;

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search all known exoplanets, their host stars and the moons and dwarf planets of the solar system by name, or list the planets of one kind, such as temperate rocky planets or hot gas giants.",
};

type Props = PageProps<"/search">;
type SearchParams = Props["searchParams"];

export default function SearchPage({ searchParams }: Props) {
  // The page shell is static. The query and the filter in the URL are only known at request time, so
  // everything that depends on them streams in. The chips suspend apart from the results, so they are
  // there at once and keep their place while the results load.
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <Suspense fallback={<TypeFilters />}>
        <Filters searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
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

  if (query === "") {
    return (
      <p className="text-muted">
        Type the name of a planet, a moon or a star into the search field. Or choose a kind of planet above to
        list all planets of that kind.
      </p>
    );
  }

  const { hits, similarOnly, hasMore } = await search(query, RESULT_LIMIT);

  if (hits.length === 0) {
    return (
      <p className="text-muted">
        No planet or star matches “{query}”.
        {query.length < MIN_QUERY_LENGTH
          ? ` Type at least ${MIN_QUERY_LENGTH} characters.`
          : " Try a shorter part of the name, for example “Kepler-22” or “TRAPPIST”."}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted">
        {similarOnly
          ? `No name contains “${query}”. These names are similar:`
          : hasMore
            ? `The first ${hits.length} matches for “${query}”. Type more of the name to narrow it down.`
            : `${hits.length === 1 ? "1 match" : `${hits.length} matches`} for “${query}”.`}
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
  const result = await searchByType(query, filter, page, RESULT_LIMIT);
  const { planets, total, similarOnly } = result;
  const kind = (count: number) => planetTypeNoun(filter.planetClass, filter.climateClass, count);

  if (planets.length === 0) {
    return (
      <p className="text-muted">
        {query !== "" && query.length < MIN_QUERY_LENGTH
          ? `Type at least ${MIN_QUERY_LENGTH} characters, or clear the search field to list all ${kind(0)}.`
          : emptyText(filter, query)}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted">
        {similarOnly
          ? `No ${kind(1)} has “${query}” in its name. These names are similar:`
          : countText(filter, total, query)}
        {rangeText(result.page, RESULT_LIMIT, planets.length, total)}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {planets.map((planet) => (
          <li key={planet.slug}>
            <PlanetCard planet={planet} showStar />
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <Pager page={result.page} pages={pageCount(total, RESULT_LIMIT)} label="Pages" href={(target) => searchHref(query, filter, target)} />
      </div>
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div
      className="grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2"
      aria-busy="true"
      aria-label="Searching"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-20 rounded-lg bg-surface" />
      ))}
    </div>
  );
}
