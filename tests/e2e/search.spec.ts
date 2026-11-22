import { expect, test, typeUntil } from "@tests/e2e/fixtures";

/** Returns the large search field on the start page, where the header search is hidden. */
function heroSearch(page: import("@playwright/test").Page) {
  const box = page.locator("[data-hero-search]");
  return {
    field: box.getByRole("combobox", { name: "Search planets and stars" }),
    list: box.getByRole("listbox", { name: "Suggestions" }),
  };
}

test.describe("search suggestions", () => {
  test("appear while typing and lead to the page that is clicked", async ({ page }) => {
    await page.goto("/");
    const { field, list } = heroSearch(page);
    await typeUntil(field, "trappist", list);

    await expect(list.getByRole("option")).toHaveCount(8);
    await expect(field).toHaveAttribute("aria-expanded", "true");

    await list.getByRole("option", { name: /TRAPPIST-1 e/ }).click();
    await expect(page).toHaveURL(/\/planets\/trappist-1-e$/);
    await expect(page.getByRole("heading", { level: 1, name: "TRAPPIST-1 e" })).toBeVisible();
  });

  test("find the moons and dwarf planets of the solar system", async ({ page }) => {
    await page.goto("/");
    const { field, list } = heroSearch(page);
    await typeUntil(field, "ganymede", list.getByRole("option").first());
    await list.getByRole("option", { name: /Ganymede.*Moon of Jupiter/ }).click();
    await expect(page).toHaveURL(/\/solar-system\/ganymede$/);
  });

  test("can be chosen with the keyboard", async ({ page }) => {
    await page.goto("/");
    const { field, list } = heroSearch(page);
    await typeUntil(field, "proxima", list.getByRole("option").first());

    await field.press("ArrowDown");
    await expect(list.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/(stars\/proxima-cen|planets\/proxima-cen-b)$/);
  });

  test("close with Escape", async ({ page }) => {
    await page.goto("/");
    const { field, list } = heroSearch(page);
    await typeUntil(field, "kepler", list);
    await field.press("Escape");
    await expect(list).toBeHidden();
  });

  test("need at least two characters", async ({ page }) => {
    await page.goto("/");
    const { field, list } = heroSearch(page);
    await field.fill("k");
    // A fixed wait is needed here because the test checks that nothing appears after the debounce.
    await page.waitForTimeout(400);
    await expect(list).toBeHidden();
  });
});

test.describe("search results page", () => {
  test("Enter without a chosen suggestion opens the results", async ({ page }) => {
    await page.goto("/");
    const { field } = heroSearch(page);
    await field.fill("kepler-22");
    await field.press("Enter");

    await expect(page).toHaveURL(/\/search\?q=kepler-22$/);
    await expect(page.getByText(/matches for “kepler-22”/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Kepler-22 b/ })).toBeVisible();
  });

  test("the header search works on other pages", async ({ page }) => {
    await page.goto("/planets");
    const field = page.getByRole("banner").getByRole("combobox", { name: "Search planets and stars" });
    await field.fill("55 cnc");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=55\+cnc$/);
    await expect(page.getByRole("link", { name: /55 Cnc e/ })).toBeVisible();
  });

  test("offers similar names for typos", async ({ page }) => {
    await page.goto("/search?q=proxma");
    await expect(page.getByText("No name contains “proxma”. These names are similar:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Proxima Cen b/ })).toBeVisible();
  });

  test("says so when nothing matches", async ({ page }) => {
    await page.goto("/search?q=zzqqxxyy");
    await expect(page.getByText(/No planet or star matches “zzqqxxyy”/)).toBeVisible();
  });

  test("explains an empty query", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByText("Type the name of a planet, a moon or a star into the search field.")).toBeVisible();
  });
});

test.describe("search by kind of planet", () => {
  const filters = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Filter by kind of planet" });

  test("lists the planets of a class, and a new query keeps the class", async ({ page }) => {
    await page.goto("/search");
    await filters(page).getByRole("link", { name: "Gas giant" }).click();
    await expect(page).toHaveURL(/\/search\?type=gas_giant$/);
    await expect(filters(page).getByRole("link", { name: "Gas giant" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(/^\d+ gas giants$/)).toBeVisible();
    // The giants of the solar system are listed with the exoplanets; stars and other planets are not.
    await expect(page.getByRole("link", { name: /51 Peg b/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Jupiter/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Kepler-22 b/ })).toHaveCount(0);

    const field = page.getByRole("banner").getByRole("combobox", { name: "Search planets and stars" });
    await field.fill("kepler");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/search\?type=gas_giant&q=kepler$/);
    await expect(page.getByText(/^\d+ gas giants? match(es)? “kepler”$/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Kepler-12 b/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Kepler-22 b/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /51 Peg b/ })).toHaveCount(0);
  });

  test("combines class and climate, and the chosen chip removes its filter", async ({ page }) => {
    await page.goto("/search?type=rocky&climate=temperate");
    await expect(page.getByText(/^\d+ temperate rocky planets$/)).toBeVisible();
    // Anchored, because the chip "Super-Earth" is a link too.
    await expect(page.getByRole("link", { name: /^Earth/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /TRAPPIST-1 e/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /TRAPPIST-1 f/ })).toHaveCount(0);

    await filters(page).getByRole("link", { name: "Temperate" }).click();
    await expect(page).toHaveURL(/\/search\?type=rocky$/);
    await expect(page.getByRole("link", { name: /TRAPPIST-1 f/ })).toBeVisible();
    await filters(page).getByRole("link", { name: "Rocky planet" }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByText(/choose a kind of planet above/)).toBeVisible();
  });

  test("offers similar names of the kind for typos, and says so when nothing matches", async ({ page }) => {
    await page.goto("/search?q=proxma&type=rocky");
    await expect(page.getByText("No rocky planet has “proxma” in its name. These names are similar:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Proxima Cen b/ })).toBeVisible();

    await page.goto("/search?q=zzqqxxyy&type=gas_giant");
    await expect(page.getByText(/No gas giant matches “zzqqxxyy”/)).toBeVisible();
  });

  test("ignores a filter the address spells wrongly", async ({ page }) => {
    await page.goto("/search?q=kepler-22&type=giant&climate=warm");
    await expect(page.getByText(/matches for “kepler-22”/)).toBeVisible();
    await expect(filters(page).locator("[aria-current]")).toHaveCount(0);
  });
});
