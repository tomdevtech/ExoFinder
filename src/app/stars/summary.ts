/** The star fields a list entry needs. */
export interface StarSummary {
  slug: string;
  name: string;
  teffK: number | null;
  planetCount: number;
}

/** Describes a star by its planet count, for example "Star · 3 known planets". */
export function describeStar(planetCount: number): string {
  return planetCount === 1 ? "Star · 1 known planet" : `Star · ${planetCount} known planets`;
}
