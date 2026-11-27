import { nameOf } from "@/i18n/messages";
import { getMessages } from "@/i18n/server";
import { ListCard } from "@/shared/ui";
import { StarImage } from "./StarImage";
import type { StarSummary } from "./summary";

/** A star as a list entry that links to its page. */
export async function StarCard({ star }: { star: StarSummary }) {
  const m = await getMessages();
  return (
    <ListCard
      href={`/stars/${star.slug}`}
      image={<StarImage teffK={star.teffK} size={56} className="shrink-0" />}
      name={nameOf(m, star.slug, star.name)}
    >
      {m.card.star(star.planetCount)}
    </ListCard>
  );
}
