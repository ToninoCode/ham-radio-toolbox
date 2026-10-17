import { expect, test } from "@playwright/test";
import { MODULE_PATHS, trackErrors, VIEWPORTS } from "./support";

test.describe("navigation", () => {
  for (const [id, path] of Object.entries(MODULE_PATHS)) {
    if (id === "dashboard") continue;

    test(`deep link ${path} opens the "In sviluppo" page`, async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      const content = page.getByTestId("under-development");
      await expect(content).toBeVisible();
      await expect(content.getByText("In sviluppo")).toBeVisible();
      await expect(content.getByText(/^Milestone M\d+$/)).toBeVisible();
      await expect(page).toHaveTitle(/ · Ham Radio Toolbox$/);
      expect(errors).toEqual([]);
    });
  }

  test("every module card on the dashboard leads to its page and back", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/");
    const cards = page.locator("[data-area] [data-testid=module-card]");
    await expect(cards).toHaveCount(13);

    for (const [id, path] of Object.entries(MODULE_PATHS)) {
      if (id === "dashboard") continue;
      await page
        .locator(`[data-area] [data-module="${id}"]`)
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(path);
      await expect(page.getByTestId("under-development")).toBeVisible();
      await page.getByRole("link", { name: "Torna alla dashboard" }).click();
      await expect(page.getByTestId("dashboard")).toBeVisible();
    }
  });

  test("unknown paths show the not-found page", async ({ page }) => {
    await page.goto("/questa/pagina/non-esiste");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Torna alla dashboard" }).click();
    await expect(page).toHaveURL("/");
  });

  test("browser back and forward keep the app in sync", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto("/");
    const nav = page.getByTestId("sidebar");
    await nav.locator('a[data-module="propagation"]').click();
    await expect(page).toHaveURL("/propagation");
    await nav.locator('a[data-module="swl-logbook"]').click();
    await expect(page).toHaveURL("/swl-logbook");

    await page.goBack();
    await expect(page).toHaveURL("/propagation");
    await expect(nav.locator('a[data-module="propagation"]')).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goForward();
    await expect(
      page.getByRole("heading", { level: 1, name: "Logbook SWL" }),
    ).toBeVisible();
  });
});
