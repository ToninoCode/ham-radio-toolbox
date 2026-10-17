import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "./support";

test.describe("theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
  });

  test("follows the system colour scheme by default", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
  });

  test("manual override wins over the system preference", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const selector = page
      .getByTestId("app-header")
      .getByTestId("theme-selector");

    await selector.getByTitle("Scuro").click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#0b1120",
    );
    const background = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(background).toBe("rgb(11, 17, 32)");

    await selector.getByTitle("Chiaro").click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);

    await selector.getByTitle("Sistema").click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("the theme selector works from the keyboard", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const selector = page
      .getByTestId("app-header")
      .getByTestId("theme-selector");
    await selector.getByRole("radio", { name: "Sistema" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(selector.getByRole("radio", { name: "Chiaro" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(selector.getByRole("radio", { name: "Scuro" })).toBeChecked();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
});
