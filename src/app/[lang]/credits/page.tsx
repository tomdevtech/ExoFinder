import type { Metadata } from "next";
import { sourceGroups } from "@/app/credits/sources";
import { getMessages } from "@/i18n/server";
import { Section } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { credits } = await getMessages();
  return { title: credits.title, description: credits.description };
}

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

/**
 * Every source of a picture, map, shape or value, in one place. The map links here instead of crediting
 * each source on screen, which CC BY 4.0 allows (section 3(a)(2): attribution through a link to a page that
 * holds the required information).
 */
export default async function CreditsPage() {
  const m = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{m.credits.title}</h1>
        <p className="max-w-2xl leading-7 text-muted">{m.credits.intro}</p>
      </header>

      {sourceGroups(m).map((group) => (
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
