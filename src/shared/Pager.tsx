import { Link } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { pageLinks } from "./paging";

const PAGER_ITEM = "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm";
const PAGER_LINK = `${PAGER_ITEM} border border-line text-muted transition-colors hover:border-accent/60 hover:text-foreground`;

/** Previous and next links with the page numbers in between. Renders nothing when everything fits on one page. */
export async function Pager({
  page,
  pages,
  label,
  href,
}: {
  page: number;
  pages: number;
  /** Tells two pagers on one page apart for screen readers. */
  label: string;
  /** The address of a page of the list this pager belongs to. */
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const { list } = await getMessages();

  const step = (target: number, text: string, name: string) =>
    target >= 1 && target <= pages ? (
      <Link href={href(target)} prefetch={false} aria-label={name} className={PAGER_LINK}>
        {text}
      </Link>
    ) : (
      <span aria-hidden className={`${PAGER_ITEM} border border-line/50 text-muted/40`}>
        {text}
      </span>
    );

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {step(page - 1, "‹", list.previousPage)}
      {pageLinks(page, pages).map((link, index) =>
        link === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className="px-0.5 text-sm text-muted">
            …
          </span>
        ) : link === page ? (
          <span
            key={link}
            aria-current="page"
            className={`${PAGER_ITEM} border border-accent/60 bg-surface font-medium text-foreground`}
          >
            {link}
          </span>
        ) : (
          <Link key={link} href={href(link)} prefetch={false} aria-label={list.page(link)} className={PAGER_LINK}>
            {link}
          </Link>
        ),
      )}
      {step(page + 1, "›", list.nextPage)}
    </nav>
  );
}
