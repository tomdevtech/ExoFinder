import { PlanetImage } from "@/app/planets/PlanetImage";
import { getMessages } from "@/i18n/server";
import { ListCard } from "@/shared/ui";
import { bodyAppearance, bodyName, describeBody, type SolarBody } from "./bodies";

/** A moon or dwarf planet as a list entry: small image, name and what it orbits. Links to its page. */
export async function BodyCard({ body, showParent = false }: { body: SolarBody; showParent?: boolean }) {
  const m = await getMessages();
  return (
    <ListCard
      href={`/solar-system/${body.slug}`}
      // A spinning sphere would misrepresent an irregular body, and some of them have no map to spin.
      image={<PlanetImage appearance={bodyAppearance(body)} size={56} className="shrink-0" animated={!body.shape} />}
      name={bodyName(body, m)}
    >
      {showParent ? describeBody(body, m) : m.card.across(m.fmt.number(body.radiusKm * 2))}
    </ListCard>
  );
}
