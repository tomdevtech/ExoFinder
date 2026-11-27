import { ACTIVE_EXOPLANETS } from "@tests/support/catalog";
import { expect, test } from "@tests/e2e/fixtures";

test.describe("start page", () => {
  test("shows the intro, featured planets and the catalogue in numbers", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ExoFinder");
    await expect(page.getByRole("heading", { level: 1, name: "ExoFinder" })).toBeVisible();

    const featured = page.locator("section", { has: page.getByRole("heading", { name: "Places to start" }) });
    for (const name of ["Proxima Cen b", "TRAPPIST-1 e", "Kepler-22 b", "Earth", "Jupiter"]) {
      await expect(featured.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }

    const stats = page.getByRole("region", { name: "The catalogue in numbers" });
    await expect(stats).toContainText(String(ACTIVE_EXOPLANETS));
    await expect(stats).toContainText("On top come the 8 planets of our solar system.");
  });

  test("offers the catalogue as a PDF file", async ({ page }) => {
    await page.goto("/");
    const book = page.getByRole("region", { name: "The catalogue as a book" });
    await expect(book.getByRole("link", { name: "Download full catalogue" })).toHaveAttribute("href", /\/exofinder-catalogue\.pdf$/);
  });

  test("leads from a featured planet to its page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /TRAPPIST-1 e/ }).first().click();
    await expect(page).toHaveURL(/\/planets\/trappist-1-e$/);
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1 e" })).toBeVisible();
  });
});

test.describe("header and footer", () => {
  test("the header links lead to the planet list, the map and the solar system", async ({ page }) => {
    await page.goto("/search");
    const nav = page.getByRole("banner").getByRole("navigation");

    await nav.getByRole("link", { name: "Planets" }).click();
    await expect(page).toHaveURL(/\/planets$/);
    await expect(page.getByRole("heading", { level: 1, name: "All planets" })).toBeVisible();

    await nav.getByRole("link", { name: "Solar system" }).click();
    await expect(page).toHaveURL(/\/stars\/sun$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sun" })).toBeVisible();

    await page.getByRole("banner").getByRole("link", { name: "ExoFinder" }).click();
    await expect(page).toHaveURL(/\/$/);

    // The map comes last, because it keeps the software renderer of the test browser busy.
    await nav.getByRole("link", { name: "Map" }).click();
    await expect(page).toHaveURL(/\/map$/);
    await expect(page.getByRole("heading", { name: "Map of the Milky Way" })).toBeAttached();
  });

  test("the header offers the catalogue as a PDF file on every page, where the screen has room for it", async ({ page, isMobile }) => {
    await page.goto("/planets/earth");
    const download = page.getByRole("banner").getByRole("link", { name: /catalogue/i });
    if (isMobile) {
      await expect(download).toBeHidden();
      return;
    }
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute("href", /\/exofinder-catalogue\.pdf$/);
  });

  test("the footer links to the credits, the legal notice and the privacy policy", async ({ page }) => {
    await page.goto("/planets");
    const footer = page.getByRole("contentinfo");

    await footer.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Credits" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Credits" })).toBeVisible();
    await page.goBack();

    await footer.getByRole("link", { name: /legal notice|impressum/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Legal notice" })).toBeVisible();

    await page.getByRole("contentinfo").getByRole("link", { name: /privacy/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });
});

test.describe("credits", () => {
  test("name the source and licence of every picture, map, shape and set of values", async ({ page }) => {
    await page.goto("/credits");
    const main = page.getByRole("main");
    for (const source of [
      "ESO/S. Brunier",
      "NASA/JPL-Caltech/ESO/R. Hurt",
      "Solar System Scope",
      "NASA Exoplanet Archive",
      "JPL Solar System Dynamics",
      "C. M. Ernst et al. 2023, JHU/APL Small Body Mapping Tool",
    ]) {
      // A text name matches any link whose name contains it.
      await expect(main.getByRole("link", { name: source }).first()).toBeVisible();
    }
    await expect(main.getByText(/^Titan:/)).toBeVisible();
    await expect(main.getByRole("link", { name: "CC BY 4.0" }).first()).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  });
});

test.describe("missing pages", () => {
  // The browser logs the 404 response as an error. Planet and star pages call
  // notFound() inside a streamed <Suspense>, so React reports error #419
  // ("switched to client rendering") before it shows the 404 page. That is how
  // Next.js handles it, and the visitor still sees the right page.
  test.use({ allowedErrors: /status of 404|Minified React error #419/ });

  for (const path of ["/does-not-exist", "/planets/no-such-planet", "/stars/no-such-star", "/solar-system/no-such-moon"]) {
    test(`${path} answers 404 with a helpful page`, async ({ page }) => {
      const response = await page.goto(path);
      // Planet and star pages stream, so their status is sent before the database
      // is queried, and only unknown routes can return 404 in the status line.
      if (path === "/does-not-exist") expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Nothing here" })).toBeVisible();
      await page.getByRole("link", { name: "Back to the start page" }).click();
      await expect(page).toHaveURL(/\/$/);
    });
  }
});

test.describe("former names", () => {
  test("an old planet address leads to the current page", async ({ page }) => {
    await page.goto("/planets/koi-87-01");
    await expect(page).toHaveURL(/\/planets\/kepler-22-b$/);
    await expect(page.getByRole("heading", { level: 1, name: "Kepler-22 b" })).toBeVisible();
    await expect(page.getByText("Formerly listed as KOI-87.01.")).toBeVisible();
  });

  test("an old star address leads to the current page", async ({ page }) => {
    await page.goto("/stars/2mass-j23062928-0502285");
    await expect(page).toHaveURL(/\/stars\/trappist-1$/);
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1" })).toBeVisible();
  });
});
