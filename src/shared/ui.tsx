import Link from "next/link";
import type { ReactNode } from "react";

/** A titled block on a detail page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** A grid of labelled values. Takes `Fact` elements as children. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">{children}</dl>
  );
}

/**
 * One labelled value. Without a value it reads "unknown", so the reader can
 * tell a missing measurement from a forgotten row.
 */
export function Fact({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode | null;
  /** A short remark on the value, for example "calculated". */
  note?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right">
        {value === null ? (
          <span className="text-muted">unknown</span>
        ) : (
          <span className="font-mono tabular-nums">{value}</span>
        )}
        {value !== null && note && (
          <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs text-muted">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/** A list entry that links to a page: a small image, a name and one line about it. */
export function ListCard({
  href,
  image,
  name,
  children,
}: {
  href: string;
  image: ReactNode;
  name: string;
  /** The line below the name. */
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-line p-3 transition-colors hover:border-accent/60 hover:bg-surface"
    >
      {image}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-sm text-muted">{children}</span>
      </span>
    </Link>
  );
}

/** Placeholder shown while the content of a detail page is loading. */
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-8">
        <div className="size-40 shrink-0 rounded-full bg-surface" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-10 w-2/3 rounded bg-surface" />
          <div className="h-5 w-1/2 rounded bg-surface" />
        </div>
      </div>
      <div className="h-64 rounded-lg bg-surface" />
    </div>
  );
}

/** A notice across the page, for example when a planet is no longer listed. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-6">
      {children}
    </p>
  );
}
