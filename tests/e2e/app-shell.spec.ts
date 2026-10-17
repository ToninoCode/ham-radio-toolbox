import { expect, test } from "@playwright/test";

test.describe("app shell", () => {
  test("loads the production build without runtime errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/");

    await expect(page).toHaveTitle("Ham Radio Toolbox");
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    await expect(page.locator("#app main#main-content")).toBeAttached();
    expect(errors).toEqual([]);
  });
});
