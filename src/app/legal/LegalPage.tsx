import type { ReactNode } from "react";
import { getMessages } from "@/i18n/server";
import type { Operator } from "./operator";

/** The frame of the legal notice and the privacy policy: a heading and a column of text. */
export async function LegalPage({
  title,
  subtitle,
  missing,
  children,
}: {
  title: string;
  /** The German name of the page, for visitors who look for that word. Left out where it is the title. */
  subtitle: string;
  /** Required details that are not set (see operator.ts). The page then shows a warning instead of hiding the gap. */
  missing: string[];
  children: ReactNode;
}) {
  const { legal } = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle !== title && <p className="text-muted">{subtitle}</p>}
      </header>
      {missing.length > 0 && (
        <p
          role="alert"
          className="max-w-2xl rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning"
        >
          {legal.incomplete(missing.join(", "))}
        </p>
      )}
      <div className="flex max-w-2xl flex-col gap-8">{children}</div>
    </main>
  );
}

/** A part of a legal page with its own heading. Paragraphs and lists inside it get their spacing here. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 leading-7 [&_a]:text-accent [&_a]:underline-offset-4 [&_a]:underline [&_a]:decoration-current/40 [&_a:hover]:decoration-current [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Name and postal address, one part per line. Parts that are not set are left out. */
export function OperatorAddress({ operator }: { operator: Operator }) {
  const { name, street, city, country } = operator;
  const complete = name !== "" && street !== "" && city !== "";
  return (
    <address className="not-italic">
      {[name, street, city, complete ? country : ""]
        .filter((line) => line !== "")
        .map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
    </address>
  );
}

/** Contact details of the operator. Renders nothing when none are set. */
export async function OperatorContact({ operator }: { operator: Operator }) {
  const { email, phone } = operator;
  if (email === "" && phone === null) return null;
  const { legal } = await getMessages();
  return (
    <p>
      {email !== "" && (
        <span className="block">
          {legal.email}
          <a href={`mailto:${email}`}>{email}</a>
        </span>
      )}
      {phone !== null && (
        <span className="block">
          {legal.phone}
          {phone}
        </span>
      )}
    </p>
  );
}
