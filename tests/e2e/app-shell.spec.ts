import { expect, test } from "@playwright/test";
import { trackErrors } from "./support";

test.describe("app shell", () => {
  test("loads the production build without runtime errors", async ({
    page,
  }) => {
    const errors = trackErrors(page);

    await page.goto("/");

    await expect(page).toHaveTitle("Ham Radio Toolbox");
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByTestId("connection-status")).toHaveText(/Online/);
    await expect(page.getByTestId("utc-clock").locator("time")).toHaveText(
      /^\d{2}:\d{2}:\d{2}$/,
    );
    expect(errors).toEqual([]);
  });

  test("reports the offline state", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await expect(page.getByTestId("connection-status")).toHaveText(/Offline/);
    await context.setOffline(false);
    await expect(page.getByTestId("connection-status")).toHaveText(/Online/);
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    // The app mounts once the stored preferences are read (≤ 500 ms).
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", {
      name: "Vai al contenuto principale",
    });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});
