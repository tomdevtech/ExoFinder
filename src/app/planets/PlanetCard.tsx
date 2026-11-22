import { ListCard } from "@/shared/ui";
import { planetAppearance } from "./appearance";
import { describePlanet } from "./labels";
import { PlanetImage } from "./PlanetImage";
import type { PlanetSummary } from "./queries";

/** A planet as a list entry: small image, name and a one-line description. Links to its page. */
export function PlanetCard({
  planet,
  showStar = false,
}: {
  planet: PlanetSummary;
  /** Adds the name of the host star, for lists that mix several systems. */
  showStar?: boolean;
}) {
  const description = describePlanet(planet.planetClass, planet.climateClass);
  return (
    <ListCard
      href={`/planets/${planet.slug}`}
      image={<PlanetImage appearance={planetAppearance(planet)} size={56} className="shrink-0" />}
      name={planet.name}
    >
      {description}
      {showStar && ` · ${planet.starName}`}
      {planet.status === "removed" && " · no longer listed"}
    </ListCard>
  );
}
