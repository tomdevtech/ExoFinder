import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { PlanetCard } from "@/app/planets/PlanetCard";
import { getPlanetsOfStar } from "@/app/planets/queries";
import { SUN_BODIES } from "@/app/solar-system/bodies";
import { BodyCard } from "@/app/solar-system/BodyCard";
import { findStarSlugByAlias, getStar, getStarFormerNames } from "@/app/stars/queries";
import { StarImage } from "@/app/stars/StarImage";
import { Link } from "@/i18n/client";
import { localHref } from "@/i18n/locales";
import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { parsecToLightYears } from "@/shared/format";
import { Fact, Facts, PageSkeleton, Section } from "@/shared/ui";

type Props = PageProps<"/[lang]/stars/[slug]">;

const LINK = "text-accent underline-offset-4 underline decoration-current/40 hover:decoration-current";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMessages();
  const star = await getStar(slug);
  if (!star) return { title: m.star.notFound };
  const name = nameOf(m, star.slug, star.name);
  return { title: name, description: m.star.description(name, star.planetCount) };
}

export default function StarPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Suspense fallback={<PageSkeleton />}>
        <StarContent params={params} />
      </Suspense>
    </main>
  );
}

async function StarContent({ params }: { params: Props["params"] }) {
  const { slug } = await params;
  const m = await getMessages();
  const { star: text, facts, fmt } = m;
  const star = await getStar(slug);
  if (!star) {
    // The star may have been renamed, so old URLs redirect to the new page.
    const currentSlug = await findStarSlugByAlias(slug);
    if (currentSlug) permanentRedirect(localHref(m.locale, `/stars/${currentSlug}`));
    notFound();
  }

  const [planets, formerNames] = await Promise.all([getPlanetsOfStar(star.id), getStarFormerNames(star.id)]);
  const active = planets.filter((planet) => planet.status === "active");
  const removed = planets.filter((planet) => planet.status === "removed");
  const isSun = star.source === "sol";
  const identifiers = [star.hd, star.hip, star.gaiaId].filter((value) => value !== null);
  const lightYears = star.distPc !== null ? fmt.number(parsecToLightYears(star.distPc)) : null;

  return (
    <article className="flex flex-col gap-12">
      <header className="flex flex-col items-center gap-8 sm:flex-row">
        <StarImage teffK={star.teffK} size={160} className="shrink-0" />
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">{nameOf(m, star.slug, star.name)}</h1>
          <p className="text-lg text-muted">{text.headline(isSun, lightYears, active.length)}</p>
          {formerNames.length > 0 && <p className="text-sm text-muted">{text.formerly(formerNames.join(", "))}</p>}
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {active.length > 0 && (
              <Link href={`/map?system=${star.slug}`} className={LINK}>
                {text.viewSystem}
              </Link>
            )}
            {star.x !== null && (
              <Link href={`/map?star=${star.slug}`} className={LINK}>
                {isSun ? text.openMap : text.findOnMap}
              </Link>
            )}
          </p>
          {!isSun && star.x === null && <p className="text-sm text-muted">{text.noPosition}</p>}
        </div>
      </header>

      <Section title={text.planets(active.length)}>
        {active.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {active.map((planet) => (
              <li key={planet.slug}>
                <PlanetCard planet={planet} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{text.noneListed}</p>
        )}
        {removed.length > 0 && (
          <>
            <h3 className="mt-2 text-sm text-muted">{text.noLongerListed}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {removed.map((planet) => (
                <li key={planet.slug}>
                  <PlanetCard planet={planet} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {isSun && (
        <Section title={text.dwarfs}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUN_BODIES.map((body) => (
              <li key={body.slug}>
                <BodyCard body={body} showParent />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={text.section}>
        <Facts>
          <Fact label={facts.spectralType} value={star.spectralType} />
          <Fact label={facts.temperature} value={star.teffK !== null ? `${fmt.number(star.teffK)} K` : null} />
          <Fact label={facts.radius} value={star.radiusSun !== null ? facts.timesSun(fmt.number(star.radiusSun)) : null} />
          <Fact label={facts.mass} value={star.massSun !== null ? facts.timesSun(fmt.number(star.massSun)) : null} />
          <Fact label={facts.brightness} value={star.vmag !== null ? `${fmt.number(star.vmag)} ${facts.mag}` : null} />
          {!isSun && (
            <Fact
              label={facts.distance}
              value={star.distPc !== null && lightYears !== null ? text.distanceValue(lightYears, fmt.number(star.distPc)) : null}
            />
          )}
        </Facts>
        <p className="text-sm leading-6 text-muted">{text.magnitudeNote}</p>
      </Section>

      {!isSun && (
        <Section title={text.position}>
          <Facts>
            <Fact label={text.rightAscension} value={star.ra !== null ? `${star.ra.toFixed(4)}°` : null} />
            <Fact label={text.declination} value={star.dec !== null ? `${star.dec.toFixed(4)}°` : null} />
            <Fact label={text.catalogueNames} value={identifiers.length > 0 ? identifiers.join(", ") : null} />
          </Facts>
        </Section>
      )}
    </article>
  );
}
