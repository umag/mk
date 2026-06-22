import { expect, test } from "@playwright/test";

// Feature: core board-canvas behaviours (capture, focus, delete, bounded canvas).

test.describe("Board canvas flows", () => {
  test("capturing a card focuses it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible(); // let the reconcile settle
    const title = `Focus ${Date.now()}`;
    await page.keyboard.press("n");
    await page.locator(".capture-row input").fill(title);
    await page.keyboard.press("Enter");
    // Then the new card carries the focus treatment
    await expect(page.locator(".card.focus", { hasText: title })).toBeVisible();
  });

  test("deleting a focused card removes it permanently", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const title = `Delete ${Date.now()}`;
    await page.keyboard.press("n");
    await page.locator(".capture-row input").fill(title);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    const card = page.locator(".card", { hasText: title });
    await expect(card).toBeVisible();
    await card.click();
    await page.keyboard.press("Escape"); // close detail, keep focus
    await page.keyboard.press("Backspace"); // delete focused card
    await expect(card).toHaveCount(0);

    // And it stays gone after a reload (persisted deletion)
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator(".card", { hasText: title })).toHaveCount(0);
  });

  test("dragging a board onto another leaves no overlap", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".board")).not.toHaveCount(0);

    // When I drag one board's header on top of another
    const src = page.locator(".board", { hasText: "Mortgage" }).first();
    const dst = page.locator(".board", { hasText: "Inbox" }).first();
    const sh = await src.locator(".board-head").boundingBox();
    const db = await dst.boundingBox();
    await page.mouse.move(sh!.x + 40, sh!.y + 12);
    await page.mouse.down();
    await page.mouse.move(db!.x + 60, db!.y + 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Then no two boards overlap (each pair is separated on at least one axis)
    const overlap = await page.locator(".board").evaluateAll((boards) => {
      const r = boards.map((b) => b.getBoundingClientRect());
      for (let i = 0; i < r.length; i++) {
        for (let j = i + 1; j < r.length; j++) {
          const a = r[i], c = r[j];
          if (a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top) return true;
        }
      }
      return false;
    });
    expect(overlap).toBe(false);
  });

  test("the canvas is bounded — extreme panning never empties the view", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".board")).not.toHaveCount(0);
    const vp = page.locator(".canvas-viewport");
    for (let i = 0; i < 40; i++) await vp.dispatchEvent("wheel", { deltaX: 300, deltaY: 300 });
    await page.waitForTimeout(300);
    // Then at least one board is still within the viewport (no infinite void)
    const anyBoardVisible = await page.locator(".board").evaluateAll((boards, vh) => {
      return boards.some((b) => {
        const r = b.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh && r.right > 0;
      });
    }, 860);
    expect(anyBoardVisible).toBe(true);
  });

  test("setting a due date via the picker persists across reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const card = page.locator(".card", { hasText: "Drag a card between boards" });
    await card.click();
    await page.locator(".due-field input[type='date']").fill("2026-07-15");
    await page.keyboard.press("Escape");
    await expect(card.locator(".due")).toBeVisible();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator(".card", { hasText: "Drag a card between boards" }).locator(".due")).toBeVisible();
  });

  test("moving a column to another board persists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const dev = page.locator(".board", { hasText: "micro-kaiten · Dev" });
    const head = page.locator(".board", { hasText: "Mortgage" }).locator(".col-head", { hasText: "Waiting" });
    const ch = await head.boundingBox();
    const dcols = await dev.locator(".board-cols").boundingBox();
    await page.mouse.move(ch!.x + 30, ch!.y + 10);
    await page.mouse.down();
    await page.mouse.move(ch!.x + 70, ch!.y + 10, { steps: 4 });
    await page.mouse.move(dcols!.x + 80, dcols!.y + 40, { steps: 12 });
    await page.mouse.up();
    await expect(dev.locator(".col-name", { hasText: "Waiting" })).toBeVisible();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator(".board", { hasText: "micro-kaiten · Dev" }).locator(".col-name", { hasText: "Waiting" })).toBeVisible();
  });

});
