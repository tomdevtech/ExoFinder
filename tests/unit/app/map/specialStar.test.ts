import { describe, expect, it } from "vitest";
import { GALACTIC_CENTRE } from "@/app/map/galaxy";
import { SPECIAL_STAR } from "@/app/map/specialStar";
import { isSpecialStar, SPECIAL_STAR_NAME, SPECIAL_STAR_SLUG } from "@/app/stars/my-special-star/star";
import { isSlug } from "@/shared/slug";

describe("the special star", () => {
  it("sits at the centre of the Milky Way, without a temperature and without planets", () => {
    const [slug, name, x, y, z, teffK, planetCount] = SPECIAL_STAR;
    expect([slug, name]).toEqual([SPECIAL_STAR_SLUG, SPECIAL_STAR_NAME]);
    expect([x, y, z]).toEqual([...GALACTIC_CENTRE]);
    expect(teffK).toBeNull();
    expect(planetCount).toBe(0);
  });

  it("is known by its slug, which is an address like any other", () => {
    expect(isSlug(SPECIAL_STAR_SLUG)).toBe(true);
    expect(isSpecialStar(SPECIAL_STAR_SLUG)).toBe(true);
    expect(isSpecialStar("sun")).toBe(false);
    expect(isSpecialStar("")).toBe(false);
  });
});
