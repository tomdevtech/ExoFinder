import { SPECIAL_STAR_NAME, SPECIAL_STAR_SLUG } from "@/app/stars/my-special-star/star";
import { GALACTIC_CENTRE } from "./galaxy";
import type { MapStar } from "./payload";

/** The easter-egg star in the compact form the map uses: at the centre of the Milky Way, without planets. */
export const SPECIAL_STAR: MapStar = [
  SPECIAL_STAR_SLUG,
  SPECIAL_STAR_NAME,
  GALACTIC_CENTRE[0],
  GALACTIC_CENTRE[1],
  GALACTIC_CENTRE[2],
  null,
  0,
];
