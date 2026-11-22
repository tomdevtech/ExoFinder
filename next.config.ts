import type { NextConfig } from "next";
import { securityHeaders } from "./src/shared/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The catalogue changes once a day, with the sync, and every read of it is cached ("use cache") without
  // a lifetime of its own. So this profile decides how old an answer may be: an hour, after which the next
  // request still gets the cached answer and refreshes it in the background. An answer nobody asked for
  // in a day is dropped.
  cacheLife: {
    default: { stale: 300, revalidate: 3600, expire: 86400 },
  },
  partialPrefetching: true,
  // The X-Powered-By header would only tell attackers which framework to target.
  poweredByHeader: false,
  async headers() {
    const development = process.env.NODE_ENV === "development";
    return [
      {
        source: "/:path*",
        headers: securityHeaders(development),
      },
      // Textures and shape grids are large and rarely change, but their file names are not hashed.
      // A day of caching plus a week of stale-while-revalidate avoids refetching on
      // every page. Development skips this so that regenerated files show at once.
      ...(development ? [] : ["/textures/:path*", "/shapes/:path*"]).map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
