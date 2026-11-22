/**
 * Calls the three JSON endpoints the way Next.js does, against the test
 * database. The browser tests in e2e/ also call them over HTTP.
 */
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/health/route";
import { GET as getStars } from "@/app/map/stars/route";
import { GET as getSystem } from "@/app/map/systems/[slug]/route";
import { GET as suggest, type Suggestion } from "@/app/search/suggest/route";
import { CATALOGUE_CACHE_CONTROL } from "@/shared/cache";

// connection() only works inside a request that Next.js handles, so it is stubbed here.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

async function suggestions(q: string | null) {
  const url = new URL("http://localhost/search/suggest");
  if (q !== null) url.searchParams.set("q", q);
  const response = await suggest(new NextRequest(url));
  return { status: response.status, body: (await response.json()) as { suggestions: Suggestion[] } };
}

function system(slug: string) {
  const ctx = { params: Promise.resolve({ slug }) } as RouteContext<"/map/systems/[slug]">;
  return getSystem(new Request(`http://localhost/map/systems/${encodeURIComponent(slug)}`), ctx);
}

describe("GET /search/suggest", () => {
  it("suggests planets and stars with links to their pages", async () => {
    const { status, body } = await suggestions("trappist");
    expect(status).toBe(200);
    expect(body.suggestions).toHaveLength(8);
    expect(body.suggestions[0]).toEqual(
      expect.objectContaining({ kind: "star", name: "TRAPPIST-1", href: "/stars/trappist-1" }),
    );
    for (const suggestion of body.suggestions) {
      expect(suggestion.href).toMatch(/^\/(planets|stars)\/[a-z0-9-]+$/);
    }
  });

  it("caps the list at eight suggestions", async () => {
    // "st" occurs in ten names (TRAPPIST-1 and its seven planets, Nodist-1 and its planet), so the cap applies.
    const { body } = await suggestions("st");
    expect(body.suggestions).toHaveLength(8);
  });

  it("needs at least two characters", async () => {
    expect((await suggestions("e")).body.suggestions).toEqual([]);
  });

  it("answers with an empty list without a query", async () => {
    expect(await suggestions(null)).toEqual({ status: 200, body: { suggestions: [] } });
    expect(await suggestions("")).toEqual({ status: 200, body: { suggestions: [] } });
  });

  it.each([
    "' OR 1=1 --",
    "'; DROP TABLE stars; --",
    "%",
    "<script>alert(1)</script>",
    "\u0000",
    "a".repeat(100_000),
    "../../../../etc/passwd",
  ])("answers 200 with few or no suggestions for %j", async (q) => {
    const { status, body } = await suggestions(q);
    expect(status).toBe(200);
    expect(body.suggestions.length).toBeLessThanOrEqual(8);
  });

  it("does not echo markup back", async () => {
    const response = await suggest(
      new NextRequest("http://localhost/search/suggest?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E"),
    );
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await response.text()).not.toContain("<script>");
  });

  it("lets browsers and the CDN keep its answer, so a prefix typed again does not ask the database", async () => {
    const response = await suggest(new NextRequest("http://localhost/search/suggest?q=trappist"));
    expect(response.headers.get("cache-control")).toBe(CATALOGUE_CACHE_CONTROL);
  });
});

describe("GET /health", () => {
  it("answers 200 and is never cached when the database is reachable", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ status: "ok", database: "ok", commit: null });
  });
});

describe("GET /map/stars", () => {
  it("answers with every star that has a position, cacheable for an hour", async () => {
    const response = await getStars();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CATALOGUE_CACHE_CONTROL);
    const body = await response.json();
    expect(body.stars.length).toBe(11);
  });
});

describe("GET /map/systems/[slug]", () => {
  it("answers with the star and its planets", async () => {
    const response = await system("trappist-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).toContain("TRAPPIST-1 e");
  });

  it("lets browsers and the CDN keep a system, but not the answer for a star that does not exist yet", async () => {
    expect((await system("trappist-1")).headers.get("cache-control")).toBe(CATALOGUE_CACHE_CONTROL);
    expect((await system("nope")).headers.get("cache-control")).toBeNull();
  });

  it.each(["nope", "../../etc/passwd", "trappist-1' or '1'='1", "%00", "x".repeat(5_000)])(
    "answers 404 for %j",
    async (slug) => {
      const response = await system(slug);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "There is no star with this address." });
    },
  );
});
