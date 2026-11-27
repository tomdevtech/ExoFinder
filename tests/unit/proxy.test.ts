import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const call = (path: string, acceptLanguage?: string) =>
  proxy(new NextRequest(`http://localhost${path}`, { headers: acceptLanguage ? { "accept-language": acceptLanguage } : {} }));

describe("proxy", () => {
  it("answers 400 for broken percent-encoding, with a language and without one", async () => {
    for (const path of ["/planets/%E0%A4%A", "/de/planets/%E0%A4%A", "/tr/stars/%", "/map/systems/%ZZ"]) {
      const response = call(path);
      expect(response.status, path).toBe(400);
      expect(await response.text()).toMatch(/not encoded correctly/);
    }
  });

  it("lets every correct address with a language through, and the data of the map", () => {
    for (const path of ["/en/planets/kepler-22-b", "/de/stars/sun", "/tr", "/map/systems/trappist-1", "/de/planets/caf%C3%A9"]) {
      // NextResponse.next() sets this header, which tells Next.js to carry on with the request.
      expect(call(path).headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("sends an address without a language to the language the browser asks for", () => {
    const german = call("/planets/kepler-22-b?sort=year", "de-DE,de;q=0.9,en;q=0.8");
    expect(german.status).toBe(307);
    expect(german.headers.get("location")).toBe("http://localhost/de/planets/kepler-22-b?sort=year");
    expect(german.headers.get("vary")).toBe("Accept-Language");
    expect(call("/", "tr").headers.get("location")).toBe("http://localhost/tr");
    expect(call("/map", "tr-TR,tr;q=0.9").headers.get("location")).toBe("http://localhost/tr/map");
  });

  it("falls back to English for a language it does not have, and for a browser that names none", () => {
    expect(call("/stars/sun", "fr-FR,fr;q=0.9").headers.get("location")).toBe("http://localhost/en/stars/sun");
    expect(call("/stars/sun").headers.get("location")).toBe("http://localhost/en/stars/sun");
  });

  it("takes a path that only starts like a language for a page without one", () => {
    expect(call("/dex", "de").headers.get("location")).toBe("http://localhost/de/dex");
  });
});
