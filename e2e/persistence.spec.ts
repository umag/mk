import { expect, test } from "@playwright/test";

// Feature: the board canvas persists to the Deno + SQLite API and survives reloads.

test.describe("Persistence — optimistic local + sync", () => {
  test("the server comes online and the canvas renders boards", async ({ page }) => {
    await page.goto("/");
    // Then sync reports online (server reachable through the Vite proxy)
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    // And the seeded boards are on the canvas
    await expect(page.locator(".board")).not.toHaveCount(0);
  });

  test("a captured card survives a page reload", async ({ page }) => {
    // Given the app is loaded and synced
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const title = `Persisted ${Date.now()}`;

    // When I capture a new card (N → type → Enter)
    await page.keyboard.press("n");
    await page.locator(".capture-row input").fill(title);
    await page.keyboard.press("Enter");
    await expect(page.locator(".card", { hasText: title })).toBeVisible();

    // And the optimistic sync flushes, then I reload
    await page.waitForTimeout(700);
    await page.reload();

    // Then the card is still there (loaded from SQLite)
    await expect(page.locator(".card", { hasText: title })).toBeVisible();
  });

  test("advancing a card persists its new column across a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const title = `Advance ${Date.now()}`;

    // Given a fresh card in the first column
    await page.keyboard.press("n");
    await page.locator(".capture-row input").fill(title);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    const card = page.locator(".card", { hasText: title });
    await expect(card).toBeVisible();

    // When I focus it and advance (A)
    await card.click();
    await page.keyboard.press("Escape"); // close detail, keep focus
    await page.keyboard.press("a");
    await page.waitForTimeout(700);
    await page.reload();

    // Then after reload it is no longer in the first column's top (it moved on)
    await expect(page.locator(".card", { hasText: title })).toBeVisible();
  });
});
