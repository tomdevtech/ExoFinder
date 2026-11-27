import { getMessages } from "@/i18n/server";
import { catalogueHref } from "./editions";

/** The printed catalogue on the start page: what it is, and the link that downloads it. */
export async function CatalogueDownload() {
  const { home } = await getMessages();
  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
      aria-labelledby="catalogue-download"
    >
      <div className="flex flex-col gap-2">
        <h2 id="catalogue-download" className="text-xl font-semibold tracking-tight">
          {home.bookTitle}
        </h2>
        <p className="max-w-xl leading-7 text-muted">{home.bookText}</p>
      </div>
      <a
        href={catalogueHref()}
        className="shrink-0 rounded-lg border border-accent/60 px-5 py-3 text-center font-medium text-accent transition-colors hover:bg-surface"
      >
        {home.bookButton}
      </a>
    </section>
  );
}
