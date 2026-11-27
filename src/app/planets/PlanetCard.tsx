import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { ListCard } from "@/shared/ui";
import { planetAppearance } from "./appearance";
import { PlanetImage } from "./PlanetImage";
import type { PlanetSummary } from "./queries";

/** A planet as a list entry: small image, name and a one-line description. Links to its page. */
export async function PlanetCard({
  planet,
  showStar = false,
}: {
  planet: PlanetSummary;
  /** Adds the name of the host star, for lists that mix several systems. */
  showStar?: boolean;
}) {
  const m = await getMessages();
  return (
    <ListCard
      href={`/planets/${planet.slug}`}
      image={<PlanetImage appearance={planetAppearance(planet)} size={56} className="shrink-0" />}
      name={nameOf(m, planet.slug, planet.name)}
    >
      {m.classes.describe(planet.planetClass, planet.climateClass)}
      {/* The Sun is the only star with a name of its own in each language. */}
      {showStar && ` · ${planet.source === "sol" ? nameOf(m, "sun", planet.starName) : planet.starName}`}
      {planet.status === "removed" && ` · ${m.card.noLongerListed}`}
    </ListCard>
  );
}
