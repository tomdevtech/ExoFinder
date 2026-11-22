import { ListCard } from "@/shared/ui";
import { StarImage } from "./StarImage";
import { describeStar, type StarSummary } from "./summary";

/** A star as a list entry that links to its page. */
export function StarCard({ star }: { star: StarSummary }) {
  return (
    <ListCard
      href={`/stars/${star.slug}`}
      image={<StarImage teffK={star.teffK} size={56} className="shrink-0" />}
      name={star.name}
    >
      {describeStar(star.planetCount)}
    </ListCard>
  );
}
