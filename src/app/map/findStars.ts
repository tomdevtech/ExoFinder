import type { MapStar } from "./payload";

/** The finder asks for at least this many characters and offers at most `LIMIT` stars. */
export const MIN_LENGTH = 2;
const LIMIT = 8;

/**
 * The stars whose name contains the text, as indices into `stars`: names that start with it first, then
 * the others. The stars arrive sorted by distance, so among equal matches the nearest come first.
 */
export function findStars(stars: MapStar[], query: string): number[] {
  const wanted = query.trim().toLowerCase();
  if (wanted.length < MIN_LENGTH) return [];
  const beginning: number[] = [];
  const inside: number[] = [];
  for (let i = 0; i < stars.length && beginning.length < LIMIT; i++) {
    const name = stars[i][1].toLowerCase();
    if (name.startsWith(wanted)) beginning.push(i);
    else if (inside.length < LIMIT && name.includes(wanted)) inside.push(i);
  }
  return [...beginning, ...inside].slice(0, LIMIT);
}
