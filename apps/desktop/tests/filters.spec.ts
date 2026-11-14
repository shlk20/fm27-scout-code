import { expect, test } from "playwright/test";

test("gender filter offers only men and women", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("fm27scout.language.v1", "en");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open last save" }).click();

  await expect(page.getByTestId("gender-all")).toContainText("320");
  await expect(page.getByTestId("gender-men")).toContainText("256");
  await expect(page.getByTestId("gender-women")).toContainText("64");
  await expect(page.getByTestId("gender-unknown")).toHaveCount(0);

  await page.getByTestId("gender-women").click();
  await expect(page.getByText("64 players", { exact: true })).toBeVisible();
});
