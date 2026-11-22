/**
 * The `Cache-Control` of a JSON answer read from the catalogue, which changes once a day. Browsers and the
 * CDN in front of the site keep it for an hour. After that the CDN may hand out the old answer once more,
 * for up to a day, while it fetches the new one, so no visitor waits for the database.
 */
export const CATALOGUE_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
