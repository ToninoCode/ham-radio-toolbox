import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS } from "./support";

/** Basic automated audit (NFR-ACC-03); the full audit is BL-M13-01. */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility (${scheme} theme)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("dashboard", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("dashboard")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test("module in development", async ({ page }) => {
      await page.goto("/satellite-explorer");
      await expect(page.getByTestId("under-development")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test("not-found page", async ({ page }) => {
      await page.goto("/missing");
      await expect(page.getByTestId("not-found")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });

    test("phone module menu", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.phone);
      await page.goto("/");
      await page
        .getByRole("button", { name: "Apri il menu con tutti i moduli" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });
  });
}
