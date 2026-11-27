/**
 * The printed catalogue as a file. `npm run catalogue` builds it (scripts/catalogue.ts) and the workflow
 * catalogue.yml publishes it as a file of a GitHub release, which is where the download links lead.
 * Whoever runs a copy of the site names the folder of their own file in CATALOGUE_URL.
 */
export const CATALOGUE = {
  /** The name of the catalogue, as its cover gives it. */
  title: "The catalogue",
  /** What it holds, in a few words. */
  claim: "The solar system and every known exoplanet",
  file: "exofinder-catalogue.pdf",
} as const;

const RELEASE = "https://github.com/tomdevtech/ExoFinder/releases/download/catalogue";

/** The address the catalogue is downloaded from. */
export function catalogueHref(env: Record<string, string | undefined> = process.env): string {
  const folder = env.CATALOGUE_URL?.trim().replace(/\/+$/, "") || RELEASE;
  return `${folder}/${CATALOGUE.file}`;
}
