import { expect, test, type Page } from "playwright/test";

async function openMockSave(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fm27scout.language.v1", "en");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open last save" }).click();
}

async function scrollTableToBottom(page: Page, testId: string) {
  const scroll = page.getByTestId(testId);
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  return scroll;
}

test("player table returns to the top when the page changes", async ({ page }) => {
  await openMockSave(page);

  const firstPage = page.getByRole("button", { name: "First page" });
  await expect(firstPage).toBeDisabled();

  const scroll = await scrollTableToBottom(page, "player-table-scroll");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);

  await expect(firstPage).toBeEnabled();
  await scrollTableToBottom(page, "player-table-scroll");
  await firstPage.click();
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
});

test("staff table returns to the top when the page changes", async ({ page }) => {
  await openMockSave(page);
  await page.getByRole("button", { name: "Staff", exact: true }).click();

  const firstPage = page.getByRole("button", { name: "First page" });
  const scroll = await scrollTableToBottom(page, "staff-table-scroll");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);

  await expect(firstPage).toBeEnabled();
  await scrollTableToBottom(page, "staff-table-scroll");
  await firstPage.click();
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
});
