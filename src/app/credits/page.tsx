import type { Metadata } from "next";
import { Section } from "@/shared/ui";
import { SOURCE_GROUPS } from "./sources";

export const metadata: Metadata = {
  title: "Credits",
  description: "Where the pictures, maps, shapes and values in ExoFinder come from, and under which licences.",
};

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

/**
 * Every source of a picture, map, shape or value, in one place. The map links here instead of crediting
 * each source on screen, which CC BY 4.0 allows (section 3(a)(2): attribution through a link to a page that
 * holds the required information).
 */
export default function CreditsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Credits</h1>
        <p className="max-w-2xl leading-7 text-muted">
          ExoFinder is built on the work of space agencies, observatories and researchers. Here is where every
          picture, map, shape and value comes from, and under which licence it is used. All pictures were
          scaled down and compressed for the web; other changes are named below.
        </p>
      </header>

      {SOURCE_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.intro && (
            <p className={`max-w-2xl leading-7 ${group.sources.length > 0 ? "text-muted" : ""}`}>{group.intro}</p>
          )}
          {group.sources.length > 0 && (
            <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 leading-7">
              {group.sources.map((source) => (
                <li key={source.subject}>
                  {source.subject}:{" "}
                  <a className={LINK} href={source.url}>
                    {source.credit}
                  </a>
                  {source.licence && (
                    <>
                      ,{" "}
                      {source.licence.url ? (
                        <a className={LINK} href={source.licence.url}>
                          {source.licence.name}
                        </a>
                      ) : (
                        source.licence.name
                      )}
                    </>
                  )}
                  .{source.note && ` ${source.note}`}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
    </main>
  );
}
