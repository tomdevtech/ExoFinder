import sharp from "sharp";
import { expect, test } from "@tests/e2e/fixtures";
import { difference, expectLook, type Picture } from "@tests/e2e/lab";

/** Waits until the map has loaded its stars. */
async function waitForMap(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "The map needs WebGL 2" })).toHaveCount(0);
  await expect(page.getByText("Loading the stars…")).toBeHidden({ timeout: 45_000 });
}

test.describe("map", () => {
  // A test may end in the middle of a flight, while the browser renders expensive pictures in software.
  // Closing the page then waited for that in CI, and the next test of the worker timed out while its
  // own page was being opened. Leaving the map stops the drawing loop and the workers within the test
  // that started them, so a test that leaves the browser busy fails itself.
  test.afterEach(async ({ page }) => {
    await page.goto("about:blank");
  });

  test("loads the stars and finds one by name", async ({ page }) => {
    await page.goto("/map");
    await waitForMap(page);

    const finder = page.getByRole("searchbox", { name: "Find a star on the map" });
    await finder.fill("trapp");
    await page.getByRole("button", { name: /TRAPPIST-1/ }).click();

    const panel = page.getByRole("heading", { level: 2, name: "TRAPPIST-1" });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "Enter system" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Star page" })).toHaveAttribute("href", "/en/stars/trappist-1");
  });

  test("says so when no star has the name", async ({ page }) => {
    await page.goto("/map");
    await waitForMap(page);
    await page.getByRole("searchbox", { name: "Find a star on the map" }).fill("zzqq");
    await expect(page.getByText("No star with this name.")).toBeVisible();
  });

  test("leaves out stars without a known distance", async ({ page }) => {
    await page.goto("/map");
    await waitForMap(page);
    await page.getByRole("searchbox", { name: "Find a star on the map" }).fill("nodist");
    await expect(page.getByText("No star with this name.")).toBeVisible();
  });

  test("opens a system from the address and goes back to the galaxy", async ({ page }) => {
    await page.goto("/map?system=trappist-1");
    await waitForMap(page);
    const back = page.getByRole("button", { name: "Galaxy", exact: true });
    await expect(back).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 2, name: "TRAPPIST-1" })).toBeVisible();
    await back.click();
    await expect(back).toBeHidden();
  });

  test("opens the planet's system when the map was already open before", async ({ page }) => {
    // Next keeps the map mounted but hidden after it is left. Under `next dev`,
    // its effects once read the address before Next had updated it, which left
    // the visitor in the galaxy. The production build never showed that race,
    // so this test guards the path rather than the exact timing.
    await page.goto("/map");
    await waitForMap(page);
    await page.getByRole("searchbox", { name: "Find a star on the map" }).fill("trapp");
    await page.getByRole("button", { name: /TRAPPIST-1/ }).click();
    await page.getByRole("link", { name: "Star page" }).click();
    await page.getByRole("link", { name: /^TRAPPIST-1 e\b/ }).click();
    await page.getByRole("link", { name: "See it on its orbit in 3D" }).click();

    await expect(page).toHaveURL(/\/map\?system=trappist-1&planet=trappist-1-e$/);
    await expect(page.getByRole("button", { name: "Galaxy", exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 2, name: "TRAPPIST-1" })).toBeVisible();
    await expect(page).toHaveURL(/\/map\?system=trappist-1&planet=trappist-1-e$/);
  });

  test("shows the whole galaxy from outside, on a black sky", async ({ page }) => {
    // The test browser renders in software, so the tens of thousands of galaxy
    // clouds take most of a minute on a two-core CI runner instead of milliseconds.
    test.setTimeout(240_000);
    // The galaxy is built from the artist's impression, and a worker places the clouds from that picture.
    const picture = page.waitForResponse((response) => response.url().endsWith("/textures/sky/galaxy.jpg"));
    const worker = page.waitForEvent("worker");
    // The worker closes once it has handed over the clouds, which tells the test they are ready.
    let cloudsMade = false;
    page.on("worker", (started) => started.on("close", () => (cloudsMade = true)));
    await page.goto("/map?view=galaxy");
    await waitForMap(page);
    expect((await picture).status()).toBe(200);
    expect((await worker).url()).toContain("/_next/");
    // From outside the galaxy, the camera circles its centre.
    await expect(page.getByRole("button", { name: "Fly freely" })).toHaveAttribute("aria-pressed", "true");

    // This measures the brightness around a point given as fractions of the canvas width and height.
    const canvas = page.locator("canvas").first();
    const brightness = async (x: number, y: number) => {
      const { data, info } = await sharp(await canvas.screenshot()).greyscale().raw().toBuffer({ resolveWithObject: true });
      const left = Math.round(info.width * x);
      const top = Math.round(info.height * y);
      let sum = 0;
      for (let dy = 0; dy < 12; dy++) {
        for (let dx = 0; dx < 12; dx++) sum += data[(top + dy) * info.width + left + dx];
      }
      return sum / 144;
    };
    // The flight out takes a few seconds before the galaxy fills the middle of the picture.
    await expect.poll(() => brightness(0.5, 0.6), { timeout: 120_000 }).toBeGreaterThan(60);
    // Outside the galaxy the sky seen from the Sun is gone, so the edge must be black.
    expect(await brightness(0.02, 0.5)).toBeLessThan(6);

    // The screenshot is only stable once the worker's clouds are in place and the camera rests.
    await expect.poll(() => cloudsMade, { timeout: 45_000 }).toBe(true);
    const shot = async (): Promise<Picture> => {
      const { data, info } = await sharp(await canvas.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, data: new Uint8Array(data) };
    };
    let last = await shot();
    await expect
      .poll(
        async () => {
          await page.waitForTimeout(700);
          const now = await shot();
          const change = difference(last, now);
          last = now;
          return change;
        },
        { timeout: 90_000 },
      )
      .toBeLessThan(0.05);
    await expectLook(last, "map-galaxy-from-outside");
  });

  test("names famous sights near the Sun", async ({ page }) => {
    await page.goto("/map");
    await waitForMap(page);
    // The Veil Nebula, 735 parsecs away, is a landmark in view from the Sun.
    await expect(page.getByText("Veil Nebula", { exact: true })).toBeVisible();
  });

  test("circles the centre of the galaxy on request, and flies freely again", async ({ page }) => {
    await page.goto("/map");
    await waitForMap(page);
    const canvas = page.locator("canvas").first();
    const circle = page.getByRole("button", { name: "Orbit centre" });
    await expect(circle).toHaveAttribute("aria-pressed", "false");

    await circle.click();
    const free = page.getByRole("button", { name: "Fly freely" });
    await expect(free).toHaveAttribute("aria-pressed", "true");
    // Dragging turns the view around the centre but must not end the circling.
    const box = await canvas.boundingBox();
    if (!box) throw new Error("The map has no canvas.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await expect(free).toHaveAttribute("aria-pressed", "true");

    // Flying home ends the circling, and so does the button.
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await expect(circle).toHaveAttribute("aria-pressed", "false");
    await circle.click();
    await free.click();
    await expect(circle).toHaveAttribute("aria-pressed", "false");
  });

  test("keeps only the links to the credits and the legal pages in its corner", async ({ page }) => {
    await page.goto("/map?system=sun");
    await waitForMap(page);
    await page.getByRole("link", { name: "Credits" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Credits" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("link", { name: "Legal notice" })).toBeVisible();
    await expect(page.getByText(/Drag to turn/)).toHaveCount(0);
  });

  test("follows a link clicked while a system is still loading", async ({ page }) => {
    // The system arrives only after the click, and the credits page takes a moment, so the map finishes
    // loading in the middle of the navigation. Writing its address then cancelled the navigation.
    let release = () => {};
    const clicked = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/map/systems/sun", async (route) => {
      await clicked;
      await route.continue();
    });
    await page.route("**/credits**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await page.goto("/map?system=sun");
    await waitForMap(page);
    await page.getByRole("link", { name: "Credits" }).click();
    release();
    await expect(page.getByRole("heading", { level: 1, name: "Credits" })).toBeVisible();
    await expect(page).toHaveURL(/\/credits$/);
  });

  test("loads the moons of a planet only when it follows the planet, and follows a moon", async ({ page }) => {
    const moonMaps: string[] = [];
    page.on("request", (request) => {
      const map = /\/textures\/planets\/(io|europa|ganymede|callisto)-(sm|lg)\.jpg$/.exec(request.url());
      if (map) moonMaps.push(`${map[1]}-${map[2]}`);
    });
    await page.goto("/map?system=sun");
    await waitForMap(page);
    await expect(page.getByRole("button", { name: "Galaxy", exact: true })).toBeVisible({ timeout: 45_000 });
    // The dwarf planets join the planets in the order of their orbits.
    const top = async (name: string) => (await page.getByRole("button", { name: new RegExp(`^${name}`) }).boundingBox())!.y;
    expect(await top("Mars")).toBeLessThan(await top("Ceres"));
    expect(await top("Ceres")).toBeLessThan(await top("Jupiter"));
    expect(await top("Neptune")).toBeLessThan(await top("Pluto"));
    expect(moonMaps).toEqual([]);

    await page.getByRole("button", { name: /^Jupiter/ }).click();
    const moons = page.getByRole("list", { name: "Moons of Jupiter" });
    await expect(moons.getByRole("button").first()).toHaveText("Io");
    await expect(moons.getByRole("button")).toHaveCount(4 + 111);
    await expect.poll(() => moonMaps.filter((map) => map.endsWith("-sm")).length).toBe(4);
    expect(moonMaps).not.toContain("io-lg");

    await expect(moons.getByText("111 smaller moons")).toBeVisible();
    // Every moon can be followed, the small ones too, and the address names it.
    await moons.getByRole("button", { name: "Himalia", exact: true }).click();
    await expect(page).toHaveURL(/planet=jupiter&moon=himalia$/);
    await expect(page.getByRole("link", { name: "Page", exact: true }).first()).toHaveAttribute("href", "/en/solar-system/himalia");
    await moons.getByRole("button", { name: "Io", exact: true }).click();
    await expect(page).toHaveURL(/system=sun&planet=jupiter&moon=io$/);
    await expect.poll(() => moonMaps).toContain("io-lg");
    await expect(page.getByRole("link", { name: "Page", exact: true }).first()).toHaveAttribute("href", "/en/solar-system/io");
  });

  test("switches to the true scale and back, names the scale shown, and keeps it in the address", async ({ page }) => {
    await page.goto("/map?system=sun");
    await waitForMap(page);
    await page.getByRole("button", { name: "Compressed", exact: true }).click({ timeout: 45_000 });
    await expect(page).toHaveURL(/system=sun&scale=true$/);
    await page.getByRole("button", { name: "True scale" }).click();
    await expect(page.getByRole("button", { name: "Compressed", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/system=sun$/);
  });

  test("shows the habitable zone on request, marks the planets in it, and keeps it in the address", async ({ page }) => {
    await page.goto("/map?system=trappist-1");
    await waitForMap(page);
    const zone = page.getByRole("button", { name: "Habitable zone", exact: true });
    await expect(zone).toHaveAttribute("aria-pressed", "false", { timeout: 45_000 });
    await expect(page.getByText(/Habitable zone: /)).toHaveCount(0);

    await zone.click();
    await expect(zone).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/system=trappist-1&zone=on$/);
    await expect(page.getByText(/Habitable zone: 0\.0\d+ to 0\.0\d+ AU/)).toBeVisible();
    // Of the seven planets, e, f and g circle within the conservative limits and d at the optimistic edge.
    await expect(page.getByText("In the habitable zone", { exact: true })).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^TRAPPIST-1 e In the habitable zone/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^TRAPPIST-1 d At the edge of the habitable zone/ })).toBeVisible();

    await zone.click();
    await expect(page).toHaveURL(/system=trappist-1$/);
    await expect(page.getByText("In the habitable zone", { exact: true })).toHaveCount(0);
  });

  test("opens a system with its habitable zone from the address", async ({ page }) => {
    await page.goto("/map?system=sun&zone=on");
    await waitForMap(page);
    await expect(page.getByRole("button", { name: "Habitable zone", exact: true })).toHaveAttribute("aria-pressed", "true", { timeout: 45_000 });
    await expect(page.getByRole("button", { name: /^Earth In the habitable zone/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Venus/ })).not.toHaveAccessibleName(/habitable/);
    await expect(page).toHaveURL(/system=sun&zone=on$/);
  });

  test("folds the panel away to show the whole picture, and brings it back", async ({ page }) => {
    await page.goto("/map?system=sun&planet=earth");
    await waitForMap(page);
    await page.getByRole("button", { name: "Hide panel" }).click({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: "Galaxy", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Earth" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show panel" }).click();
    await expect(page.getByRole("button", { name: "Galaxy", exact: true })).toBeVisible();
    // The view itself is unchanged: the planet is still followed.
    await expect(page).toHaveURL(/planet=earth$/);
  });

  test("hides the moons on request, also from the address", async ({ page }) => {
    await page.goto("/map?system=sun&planet=jupiter&moons=off");
    await waitForMap(page);
    const show = page.getByRole("button", { name: "Show moons" });
    await expect(show).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("list", { name: "Moons of Jupiter" })).toHaveCount(0);
    await show.click();
    await expect(page.getByRole("list", { name: "Moons of Jupiter" })).toBeVisible();
    await expect(page).toHaveURL(/planet=jupiter$/);
    await page.getByRole("button", { name: "Hide moons" }).click();
    await expect(page).toHaveURL(/planet=jupiter&moons=off$/);
  });

  test("lets the other planets give way while it follows a planet with moons", async ({ page }) => {
    // The names on the map are HTML over the canvas, so they show which planets are drawn.
    const label = (name: string) => page.locator("div.will-change-transform", { hasText: new RegExp(`^${name}$`) });
    await page.goto("/map?system=sun");
    await waitForMap(page);
    await expect(label("Mars")).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: /^Jupiter/ }).click();
    await expect(label("Io")).toBeVisible();
    await expect(label("Mars")).toBeHidden();
    await page.getByRole("button", { name: "Whole system" }).click();
    await expect(label("Mars")).toBeVisible();
  });

  test("opens a moon from the address", async ({ page }) => {
    await page.goto("/map?system=sun&planet=saturn&moon=titan");
    await waitForMap(page);
    await expect(page.getByRole("button", { name: "Titan", pressed: true })).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(/planet=saturn&moon=titan$/);
  });

  test("draws the planets from their small maps and loads the large map of the one it follows", async ({ page }) => {
    const maps: string[] = [];
    page.on("request", (request) => {
      const map = /\/textures\/presets\/[a-z-]+-(sm|lg)\.webp$/.exec(request.url());
      if (map) maps.push(map[1]);
    });
    await page.goto("/map?system=trappist-1");
    await waitForMap(page);
    await expect(page.getByRole("button", { name: "Galaxy", exact: true })).toBeVisible({ timeout: 45_000 });
    await expect.poll(() => maps.includes("sm")).toBe(true);
    expect(maps).not.toContain("lg");

    await page.getByRole("button", { name: /^TRAPPIST-1 e/ }).click();
    await expect(page).toHaveURL(/planet=trappist-1-e/);
    // A rocky planet is mixed from two base maps, so two large maps are loaded.
    await expect.poll(() => maps.filter((size) => size === "lg")).toHaveLength(2);
  });
});
