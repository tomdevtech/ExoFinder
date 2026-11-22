import { PlanetImage } from "@/app/planets/PlanetImage";
import { formatNumber } from "@/shared/format";
import { ListCard } from "@/shared/ui";
import { bodyAppearance, describeBody, type SolarBody } from "./bodies";

/** A moon or dwarf planet as a list entry: small image, name and what it orbits. Links to its page. */
export function BodyCard({ body, showParent = false }: { body: SolarBody; showParent?: boolean }) {
  return (
    <ListCard
      href={`/solar-system/${body.slug}`}
      // A spinning sphere would misrepresent an irregular body, and some of them have no map to spin.
      image={<PlanetImage appearance={bodyAppearance(body)} size={56} className="shrink-0" animated={!body.shape} />}
      name={body.name}
    >
      {showParent ? describeBody(body) : `${formatNumber(body.radiusKm * 2)} km across`}
    </ListCard>
  );
}
