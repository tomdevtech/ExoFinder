import { catalogueHref } from "./editions";

/** The printed catalogue on the start page: what it is, and the link that downloads it. */
export function CatalogueDownload() {
  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
      aria-labelledby="catalogue-download"
    >
      <div className="flex flex-col gap-2">
        <h2 id="catalogue-download" className="text-xl font-semibold tracking-tight">
          The catalogue as a book
        </h2>
        <p className="max-w-xl leading-7 text-muted">
          Every planet, moon and dwarf planet on a page of its own, with its picture and its values, a table of
          contents, an index and all sources, in one PDF file.
        </p>
      </div>
      <a
        href={catalogueHref()}
        className="shrink-0 rounded-lg border border-accent/60 px-5 py-3 text-center font-medium text-accent transition-colors hover:bg-surface"
      >
        Download full catalogue
      </a>
    </section>
  );
}
