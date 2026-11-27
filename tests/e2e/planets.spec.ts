import { ACTIVE_EXOPLANETS } from "@tests/support/catalog";
import { expect, test, waitForGlobe } from "@tests/e2e/fixtures";

const ALL_ACTIVE = ACTIVE_EXOPLANETS + 8;

test.describe("list of all planets", () => {
  test("lists every active planet in natural order", async ({ page }) => {
    await page.goto("/planets");
    await expect(page.getByText(`${ALL_ACTIVE} planets`, { exact: true })).toBeVisible();

    const rows = page.getByRole("main").getByRole("listitem");
    await expect(rows).toHaveCount(ALL_ACTIVE);
    const all = await rows.allInnerTexts();
    const index = (name: string) => all.findIndex((text) => text.startsWith(name));
    expect(index("Kepler-12 b")).toBeLessThan(index("Kepler-22 b"));
    expect(index("Kepler-22 b")).toBeLessThan(index("Kepler-129 b"));
    expect(index("Retracted-1 b")).toBe(-1);
  });

  test("filters while typing and keeps the filter in the address", async ({ page }) => {
    await page.goto("/planets");
    const filter = page.getByRole("searchbox", { name: "Filter planets by name" });
    // The page streams a disabled stand-in first and swaps in the live field once the list is known; typing
    // into the stand-in would be lost, as it would for a visitor.
    await expect(filter).toBeEnabled();
    await filter.pressSequentially("trappist", { delay: 30 });

    await expect(page).toHaveURL(/\/planets\?q=trappist$/);
    await expect(page.getByText("7 planets match “trappist”")).toBeVisible();
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(7);

    // The filter lives in the URL, so the filtered list can be reloaded and shared.
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Filter planets by name" })).toHaveValue("trappist");
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(7);
  });

  test("says so when no planet matches", async ({ page }) => {
    await page.goto("/planets?q=zzqqxx");
    await expect(page.getByText(/No planet matches “zzqqxx”/)).toBeVisible();
  });

  test("sorts by discovery year and keeps the filter", async ({ page }) => {
    await page.goto("/planets?q=kepler");
    await page.getByRole("navigation", { name: "Sort order" }).getByRole("link", { name: "Discovery year" }).click();

    await expect(page).toHaveURL(/\/planets\?q=kepler&sort=discovery$/);
    const rows = page.getByRole("main").getByRole("listitem");
    // Kepler-129 b (2016) is the newest of the four matching planets.
    await expect(rows.first()).toContainText("Kepler-129 b");
    await expect(rows.first()).toContainText("2016");
  });

  test("narrows the list to a kind of planet, and the filter and the order keep it", async ({ page }) => {
    const chips = page.getByRole("navigation", { name: "Filter by kind of planet" });
    const rows = page.getByRole("main").getByRole("listitem");
    await page.goto("/planets");
    await chips.getByRole("link", { name: "Gas giant" }).click();
    await expect(page).toHaveURL(/\/planets\?type=gas_giant$/);
    await expect(chips.getByRole("link", { name: "Gas giant" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(/^\d+ gas giants$/)).toBeVisible();
    // The giants of the solar system are listed with the exoplanets.
    await expect(rows.filter({ hasText: "51 Peg b" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Jupiter" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Kepler-22 b" })).toHaveCount(0);

    await page.getByRole("navigation", { name: "Sort order" }).getByRole("link", { name: "Discovery year" }).click();
    await expect(page).toHaveURL(/\/planets\?type=gas_giant&sort=discovery$/);
    const filter = page.getByRole("searchbox", { name: "Filter planets by name" });
    await expect(filter).toBeEnabled();
    await filter.pressSequentially("kepler", { delay: 30 });
    await expect(page).toHaveURL(/\/planets\?q=kepler&type=gas_giant&sort=discovery$/);
    await expect(page.getByText(/^\d+ gas giants? match(es)? “kepler”$/)).toBeVisible();
    await expect(rows.filter({ hasText: "Kepler-12 b" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "51 Peg b" })).toHaveCount(0);
  });

  test("combines class and climate, and the chosen chip removes its filter", async ({ page }) => {
    const chips = page.getByRole("navigation", { name: "Filter by kind of planet" });
    const rows = page.getByRole("main").getByRole("listitem");
    await page.goto("/planets?type=rocky&climate=temperate");
    await expect(page.getByText(/^\d+ temperate rocky planets$/)).toBeVisible();
    await expect(rows.filter({ hasText: "Earth" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "TRAPPIST-1 e" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "TRAPPIST-1 f" })).toHaveCount(0);

    await chips.getByRole("link", { name: "Temperate" }).click();
    await expect(page).toHaveURL(/\/planets\?type=rocky$/);
    await expect(rows.filter({ hasText: "TRAPPIST-1 f" })).toHaveCount(1);
    await chips.getByRole("link", { name: "Rocky planet" }).click();
    await expect(page).toHaveURL(/\/planets$/);
    await expect(page.getByText(`${ALL_ACTIVE} planets`, { exact: true })).toBeVisible();
  });

  test("says so when no planet of the kind matches, and ignores a kind the address spells wrongly", async ({ page }) => {
    await page.goto("/planets?q=zzqqxx&type=gas_giant");
    await expect(page.getByText(/No gas giant matches “zzqqxx”/)).toBeVisible();
    await page.goto("/planets?type=super_earth&climate=frozen");
    await expect(page.getByText(/The catalogue lists no frozen super-Earths/)).toBeVisible();
    await page.goto("/planets?type=giant&climate=warm");
    await expect(page.getByText(`${ALL_ACTIVE} planets`, { exact: true })).toBeVisible();
  });

  test("is one click away from the numbers on the start page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Super-Earths" }).click();
    await expect(page).toHaveURL(/\/planets\?type=super_earth$/);
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "55 Cnc e" })).toHaveCount(1);
  });

  test("ignores nonsense in the address", async ({ page }) => {
    await page.goto("/planets?page=-5&sort=evil");
    await expect(page.getByText(`${ALL_ACTIVE} planets`, { exact: true })).toBeVisible();
    await page.goto("/planets?page=99999");
    await expect(page.getByRole("main").getByRole("listitem").first()).toBeVisible();
  });
});

test.describe("planet page", () => {
  test("shows the planet, its 3D model and the way to its star", async ({ page }) => {
    await page.goto("/planets/trappist-1-e");
    await expect(page).toHaveTitle("TRAPPIST-1 e · ExoFinder");
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1 e" })).toBeVisible();
    for (const section of ["Planet", "Orbit", "Discovery"]) {
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    await waitForGlobe(page);

    await page.getByRole("main").getByRole("link", { name: "TRAPPIST-1", exact: true }).first().click();
    await expect(page).toHaveURL(/\/stars\/trappist-1$/);
    await expect(page.getByText("with 7 known planets")).toBeVisible();
  });

  // A lava world, a Neptune-like planet and a gas giant cover each kind of base map.
  for (const slug of ["55-cnc-e", "k2-18-b", "51-peg-b"]) {
    test(`draws the 3D model of ${slug} from its base map`, async ({ page }) => {
      const baseMap = page.waitForResponse((response) =>
        /\/textures\/presets\/[a-z-]+-lg\.webp$/.test(response.url()),
      );
      await page.goto(`/planets/${slug}`);
      expect((await baseMap).status()).toBe(200);
      await waitForGlobe(page);
    });
  }

  // Earth and Mars have lit relief, which uses a shader program of its own.
  for (const slug of ["earth", "mars"]) {
    test(`draws the 3D model of ${slug} from its real map`, async ({ page }) => {
      const realMap = page.waitForResponse((response) => response.url().endsWith(`/textures/planets/${slug}-lg.jpg`));
      await page.goto(`/planets/${slug}`);
      expect((await realMap).status()).toBe(200);
      await waitForGlobe(page);
    });
  }

  test("lets the browser keep the maps of the planets for a day", async ({ request }) => {
    for (const path of [
      "/textures/presets/continents-sm.webp",
      "/textures/planets/earth-lg.jpg",
      "/textures/sky/galaxy.jpg",
      "/shapes/vesta.bin",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );
    }
  });

  test("the 3D model reacts to its buttons", async ({ page }) => {
    await page.goto("/planets/jupiter");
    await waitForGlobe(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("group", { name: /3D model of Jupiter/ })).toBeVisible();
  });

  test("marks a planet that NASA withdrew", async ({ page }) => {
    await page.goto("/planets/retracted-1-b");
    await expect(page.getByText(/NASA no longer lists this planet/)).toBeVisible();
    await expect(page.getByRole("link", { name: "See it on its orbit in 3D" })).toHaveCount(0);
  });

  test("a planet of the solar system has its own page too", async ({ page }) => {
    await page.goto("/planets/earth");
    await expect(page.getByRole("heading", { level: 1, name: "Earth" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Sun", exact: true }).first()).toBeVisible();
  });
});

test.describe("star page", () => {
  test("lists the planets of the star", async ({ page }) => {
    await page.goto("/stars/trappist-1");
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1" })).toBeVisible();
    for (const letter of ["b", "e", "h"]) {
      await expect(page.getByRole("link", { name: new RegExp(`TRAPPIST-1 ${letter}`) }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "View the system in 3D" })).toHaveAttribute(
      "href",
      "/en/map?system=trappist-1",
    );
  });

  test("the Sun shows the eight planets", async ({ page }) => {
    await page.goto("/stars/sun");
    await expect(page.getByText("Our own star with 8 known planets")).toBeVisible();
  });

  test("the Sun lists its dwarf planets apart from the planets", async ({ page }) => {
    await page.goto("/stars/sun");
    await expect(page.getByRole("heading", { name: "Dwarf planets" })).toBeVisible();
    await page.getByRole("link", { name: /^Ceres/ }).click();
    await expect(page).toHaveURL(/\/solar-system\/ceres$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ceres" })).toBeVisible();
  });
});

test.describe("moon and dwarf planet pages", () => {
  test("show the moon, its real map and the way to its planet", async ({ page }) => {
    const realMap = page.waitForResponse((response) => response.url().endsWith("/textures/planets/europa-lg.jpg"));
    await page.goto("/solar-system/europa");
    await expect(page).toHaveTitle("Europa · ExoFinder");
    await expect(page.getByRole("heading", { level: 1, name: "Europa" })).toBeVisible();
    for (const section of ["Moon", "Orbit", "Discovery", "Other large moons of Jupiter"]) {
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    expect((await realMap).status()).toBe(200);
    await waitForGlobe(page);
    await expect(page.getByText("Galileo Galilei")).toBeVisible();
    await expect(page.getByRole("link", { name: "See it on its orbit in 3D" })).toHaveAttribute(
      "href",
      "/en/map?system=sun&planet=jupiter&moon=europa",
    );
    await page.getByRole("main").getByRole("link", { name: "Jupiter", exact: true }).click();
    await expect(page).toHaveURL(/\/planets\/jupiter$/);
  });

  test("a planet lists its large moons and, on request, every known moon", async ({ page }) => {
    await page.goto("/planets/saturn");
    await expect(page.getByRole("heading", { name: "Moons", exact: true })).toBeVisible();
    for (const name of ["Mimas", "Titan", "Iapetus"]) {
      await expect(page.getByRole("link", { name: new RegExp(`^${name}`) }).first()).toBeVisible();
    }
    const all = page.getByText(/^All 293 known moons of Saturn/);
    await expect(page.getByRole("cell", { name: "S/2009 S1" })).toBeHidden();
    await all.click();
    await expect(page.getByRole("cell", { name: "S/2009 S1" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Pan", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /^Titan/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Titan" })).toBeVisible();
  });

  test("an irregular body shows its real shape with its map, or its colour where no map exists", async ({ page }) => {
    const shape = page.waitForResponse((response) => response.url().endsWith("/shapes/phobos.bin"));
    const map = page.waitForResponse((response) => response.url().endsWith("/textures/planets/phobos-lg.jpg"));
    await page.goto("/solar-system/phobos");
    expect((await shape).status()).toBe(200);
    expect((await map).status()).toBe(200);
    await expect(page.getByRole("group", { name: /3D model of Phobos/ }).getByRole("button", { name: "Reset" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^Shape:/)).toBeVisible();

    await page.goto("/solar-system/hyperion");
    await expect(page.getByText(/No spacecraft has mapped its whole surface/)).toBeVisible();
    await expect(page.getByRole("group", { name: /3D model of Hyperion/ }).getByRole("button", { name: "Reset" })).toBeVisible({ timeout: 30_000 });
  });

  test("Mars lists its two small moons, which have pages of their own", async ({ page }) => {
    await page.goto("/planets/mars");
    await expect(page.getByRole("heading", { name: "Moons", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Phobos/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Deimos/ })).toBeVisible();
  });

  test("a dwarf planet shows its moon, and the Moon its ancient discovery", async ({ page }) => {
    await page.goto("/solar-system/pluto");
    await expect(page.getByText("Dwarf planet orbiting the")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Charon/ })).toBeVisible();
    await page.goto("/solar-system/moon");
    await expect(page.getByText(/Known since antiquity/)).toBeVisible();
  });

  test("a small moon has a page with its values and a made-up model, reached from its planet's table", async ({ page }) => {
    await page.goto("/planets/saturn");
    await page.getByText(/^All 293 known moons of Saturn/).click();
    await page.getByRole("cell", { name: "S/2009 S1" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/solar-system\/s-2009-s1$/);
    await expect(page).toHaveTitle("S/2009 S1 · ExoFinder");
    await expect(page.getByRole("heading", { level: 1, name: "S/2009 S1" })).toBeVisible();
    for (const section of ["Moon", "Orbit", "Discovery"]) {
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/the model is an illustration/)).toBeVisible();
    await expect(page.getByText("Cassini Imaging Science Team")).toBeVisible();
    await expect(page.getByRole("group", { name: /3D model of S\/2009 S1/ }).getByRole("button", { name: "Reset" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "See it on its orbit in 3D" })).toHaveAttribute(
      "href",
      "/en/map?system=sun&planet=saturn&moon=s-2009-s1",
    );
    await page.getByRole("link", { name: "All moons of Saturn" }).click();
    await expect(page).toHaveURL(/\/planets\/saturn$/);
  });
});

test.describe("browsing the catalogue", () => {
  const browse = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Browse the catalogue" });

  test("leads through a system from the inside out and on to the next farther system", async ({ page }) => {
    await page.goto("/planets/trappist-1-g");
    await expect(browse(page).getByText(/^No\. [\d,]+ of [\d,]+$/)).toBeVisible();
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toContainText("TRAPPIST-1 f");
    await browse(page).getByRole("link", { name: /Next/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1 h" })).toBeVisible();

    // 55 Cnc is the next star after TRAPPIST-1 by distance, and e is its only planet in the test catalogue.
    const next = browse(page).getByRole("link", { name: /Next/ });
    await expect(next).toContainText("55 Cnc e");
    await expect(next).toContainText("55 Cnc · 41 light-years");
    await next.click();
    await expect(page).toHaveURL(/\/planets\/55-cnc-e$/);
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toContainText("TRAPPIST-1 h");
  });

  test("takes the moons of the solar system along, and skips them on request", async ({ page }) => {
    await page.goto("/planets/earth");
    await browse(page).getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/solar-system\/moon$/);
    await browse(page).getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\/planets\/mars$/);

    await page.goto("/planets/saturn");
    await expect(browse(page).getByRole("link", { name: /Next/ })).toContainText("Pan");
    await browse(page).getByRole("link", { name: "on to Uranus" }).click();
    await expect(page).toHaveURL(/\/planets\/uranus$/);
    await browse(page).getByRole("link", { name: "back to Saturn" }).click();
    await expect(page).toHaveURL(/\/planets\/saturn$/);
  });

  test("starts at Mercury and leads from the last moon of Pluto to the nearest exoplanet", async ({ page }) => {
    await page.goto("/planets/mercury");
    await expect(browse(page).getByText(/^No\. 1 of [\d,]+$/)).toBeVisible();
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toHaveCount(0);

    await page.goto("/solar-system/hydra");
    const next = browse(page).getByRole("link", { name: /Next/ });
    await expect(next).toContainText("Proxima Cen b");
    await next.click();
    await expect(page).toHaveURL(/\/planets\/proxima-cen-b$/);
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toContainText("Solar system");

    // The star at an unknown distance comes last.
    await page.goto("/planets/nodist-1-b");
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toContainText("Kepler-12 b");
    await expect(browse(page).getByRole("link", { name: /Next/ })).toHaveCount(0);
  });

  test("the arrow keys browse, unless the 3D model has the focus", async ({ page }) => {
    await page.goto("/planets/trappist-1-b");
    await waitForGlobe(page);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/planets\/trappist-1-c$/);
    // The keys follow the links of the page that is shown, so those have to be in place first.
    await expect(browse(page).getByRole("link", { name: /Previous/ })).toContainText("TRAPPIST-1 b");
    await waitForGlobe(page);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/planets\/trappist-1-b$/);

    await expect(browse(page).getByRole("link", { name: /Next/ })).toContainText("TRAPPIST-1 c");
    await waitForGlobe(page);
    await page.getByRole("group", { name: /3D model of TRAPPIST-1 b/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1 b" })).toBeVisible();
    await expect(page).toHaveURL(/\/planets\/trappist-1-b$/);
  });

  test("leaves out a planet that NASA withdrew", async ({ page }) => {
    await page.goto("/planets/retracted-1-b");
    await expect(page.getByText(/NASA no longer lists this planet/)).toBeVisible();
    await expect(browse(page)).toHaveCount(0);
  });
});
