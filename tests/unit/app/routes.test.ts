/**
 * When the database fails, the JSON endpoints must not reveal anything about
 * the failure (no message, stack or connection details). The details go to
 * the server log only.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "connect ECONNREFUSED postgres://exofinder:hunter2@db.internal:5432/exofinder";

vi.mock("@/app/search/query", () => ({
  search: vi.fn(async () => {
    throw new Error(SECRET);
  }),
}));
vi.mock("@/app/map/queries", () => ({
  getMapStars: vi.fn(async () => {
    throw new Error(SECRET);
  }),
  getMapSystem: vi.fn(async () => {
    throw new Error(SECRET);
  }),
}));

// connection() only works inside a request that Next.js handles, so it is stubbed here.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

vi.mock("@/db/client", () => ({
  getDb: () => ({
    execute: async () => {
      throw new Error(SECRET);
    },
  }),
}));

const { GET: health } = await import("@/app/health/route");
const { GET: suggest } = await import("@/app/search/suggest/route");
const { GET: getStars } = await import("@/app/map/stars/route");
const { GET: getSystem } = await import("@/app/map/systems/[slug]/route");

describe("JSON endpoints when the database fails", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  async function expectHidden(response: Response) {
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toMatch(/at .+\.(ts|js):\d+/);
    expect(log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ message: SECRET }));
    return JSON.parse(text);
  }

  it("/health answers 503, says only that the database is unreachable, and is not cached", async () => {
    const response = await health();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await expectHidden(response)).toEqual({ status: "error", database: "unreachable", commit: null });
  });

  it("/search/suggest answers 503 with an empty list and is not cached", async () => {
    const response = await suggest(new NextRequest("http://localhost/search/suggest?q=kepler"));
    // A failure must not be kept: the next request has to reach the database again.
    expect(response.headers.get("cache-control")).toBeNull();
    expect(await expectHidden(response)).toEqual({ suggestions: [] });
  });

  it("/map/stars answers 503 with a plain message and is not cached", async () => {
    const response = await getStars();
    expect(response.headers.get("cache-control")).toBeNull();
    expect(await expectHidden(response)).toEqual({
      error: "The star catalogue is not available right now.",
    });
  });

  it("/map/systems/[slug] answers 503 with a plain message and is not cached", async () => {
    const ctx = { params: Promise.resolve({ slug: "sun" }) } as RouteContext<"/map/systems/[slug]">;
    const response = await getSystem(new Request("http://localhost/map/systems/sun"), ctx);
    expect(response.headers.get("cache-control")).toBeNull();
    expect(await expectHidden(response)).toEqual({ error: "The system is not available right now." });
  });
});
