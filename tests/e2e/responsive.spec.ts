import { expect, test, type Locator } from "@playwright/test";
import { hasHorizontalOverflow, VIEWPORTS } from "./support";

const TOUCH_TARGET = 44;

async function expectTouchTargets(items: Locator) {
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await items.nth(i).boundingBox();
    expect(box, `item ${i}`).not.toBeNull();
    expect(box!.height, `item ${i} height`).toBeGreaterThanOrEqual(
      TOUCH_TARGET,
    );
    expect(box!.width, `item ${i} width`).toBeGreaterThanOrEqual(TOUCH_TARGET);
  }
}

test.describe("responsive layout", () => {
  test("phone portrait: compact bottom navigation and module menu", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto("/");

    await expect(page.getByTestId("sidebar")).toBeHidden();
    const bar = page.getByTestId("bottom-nav");
    await expect(bar).toBeVisible();
    await expectTouchTargets(bar.locator("a, button"));
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await bar
      .getByRole("button", { name: "Apri il menu con tutti i moduli" })
      .click();
    const menu = page.getByRole("dialog", { name: "Tutti i moduli" });
    await expect(menu).toBeVisible();
    await expect(menu.locator("a[data-module]")).toHaveCount(14);
    await expectTouchTargets(menu.locator("a[data-module]"));

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await bar
      .getByRole("button", { name: "Apri il menu con tutti i moduli" })
      .click();
    await menu.locator('a[data-module="propagation"]').click();
    await expect(page).toHaveURL("/propagation");
    await expect(menu).toBeHidden();
  });

  test("phone landscape: icon sidebar fits without horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phoneLandscape);
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test("tablet portrait: icon rail with accessible names", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tabletPortrait);
    await page.goto("/");

    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
    const link = sidebar.getByRole("link", { name: "Logbook HAM" });
    await expect(link).toBeVisible();
    await expect(link.getByText("Logbook HAM")).toHaveClass(/sr-only/);
    const box = await sidebar.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(96);
    await expectTouchTargets(sidebar.locator("a"));
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test("tablet landscape and desktop: full sidebar with labels", async ({
    page,
  }) => {
    for (const viewport of [VIEWPORTS.tabletLandscape, VIEWPORTS.desktop]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const sidebar = page.getByTestId("sidebar");
      await expect(sidebar.getByText("Logbook HAM")).toBeVisible();
      await expect(sidebar.getByText("Area HAM")).toBeVisible();
      await expect(page.getByTestId("bottom-nav")).toBeHidden();
      expect(await hasHorizontalOverflow(page)).toBe(false);
    }
  });

  test("dashboard cards: favourite toggle and touch targets", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.tabletPortrait);
    await page.goto("/");
    const favorites = page.getByTestId("favorites");
    await expect(favorites.getByTestId("empty-state")).toBeVisible();

    await expectTouchTargets(page.getByTestId("favorite-toggle"));
    await page
      .getByRole("button", { name: "Aggiungi Propagazione ai preferiti" })
      .click();
    await expect(
      favorites.locator('[data-module="propagation"]'),
    ).toBeVisible();
    await expect(favorites.getByTestId("empty-state")).toHaveCount(0);
  });
});
