import { describe, expect, it } from "vitest";
import { CATALOGUE, catalogueHref } from "@/app/catalog/editions";

describe("catalogueHref", () => {
  it("leads to the file of the release that the workflow fills", () => {
    expect(catalogueHref({})).toBe(`https://github.com/tomdevtech/ExoFinder/releases/download/catalogue/${CATALOGUE.file}`);
    expect(catalogueHref({ CATALOGUE_URL: "  " })).toBe(catalogueHref({}));
  });

  it("leads to the folder a copy of the site names instead", () => {
    expect(catalogueHref({ CATALOGUE_URL: "https://example.org/files/" })).toBe(`https://example.org/files/${CATALOGUE.file}`);
    expect(catalogueHref({ CATALOGUE_URL: "/catalogue" })).toBe(`/catalogue/${CATALOGUE.file}`);
  });
});
