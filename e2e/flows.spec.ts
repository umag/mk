import { expect, test } from "@playwright/test";

// Feature: core board-canvas behaviours (capture, focus, delete, bounded canvas).

test.describe("Board canvas flows", () => {
  test("capturing a card focuses it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible(); // let the reconcile settle
    const title = `Focus ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByTestId("capture-input").fill(title);
    await page.keyboard.press("Enter");
    // Then the new card carries the focus treatment
    await expect(page.locator(".card.focus", { hasText: title })).toBeVisible();
  });

  test("deleting a focused card removes it permanently", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const title = `Delete ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByTestId("capture-input").fill(title);
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
    // No due set → add one via the "+" menu, then pick a day in the bespoke picker
    await page.getByTestId("card-detail-add").click();
    await page.getByTestId("menu-item-due-date").click();
    await expect(page.getByTestId("calendar")).toBeVisible();
    await page.getByTestId("calendar-today").click(); // deterministic pick = today
    await page.keyboard.press("Escape"); // close detail, keep focus
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

  test("a label added in the detail sheet shows on the card and persists", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const card = page.locator(".card", { hasText: "Drag a card between boards" });
    await card.click();
    // Add a label via the "+" menu → bespoke input
    await page.getByTestId("card-detail-add").click();
    await page.getByTestId("menu-item-label").click();
    await page.getByTestId("card-detail-label-input").fill("spike");
    await page.getByTestId("card-detail-label-input").press("Enter");
    // chip appears in the sheet…
    await expect(page.getByTestId("card-detail-labels").getByText("spike")).toBeVisible();
    await page.keyboard.press("Escape"); // exit add mode
    await page.keyboard.press("Escape"); // close detail
    // …and on the card facade, and survives a reload (persisted)
    await expect(card.getByTestId("card-labels").getByText("spike")).toBeVisible();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.locator(".card", { hasText: "Drag a card between boards" }).getByText("spike")).toBeVisible();
  });

  test("filtering by a label narrows the canvas to matching cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    // 'Groceries' is labelled home; 'Drag a card between boards' is not.
    await page.getByTestId("filter-button").click();
    await expect(page.getByTestId("filter-popover")).toBeVisible();
    await page.getByTestId("filter-option").filter({ hasText: "home" }).click();

    await expect(page.locator(".card", { hasText: "Groceries + pharmacy run" })).toBeVisible();
    await expect(page.locator(".card", { hasText: "Drag a card between boards" })).toHaveCount(0);
    await expect(page.getByTestId("filter-bar")).toBeVisible();

    await page.keyboard.press("Escape"); // close popover
    await page.getByTestId("filter-clear").click();
    await expect(page.locator(".card", { hasText: "Drag a card between boards" })).toBeVisible();
  });

  test("a comment posts with ⌘/Ctrl-Enter and shows in the right-hand panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    await page.locator(".card", { hasText: "Reply to bank" }).click();
    const input = page.getByTestId("comment-input");
    await input.click();
    // discard + send reveal only once the field is focused
    await expect(page.getByTestId("comment-send")).toBeVisible();
    await input.fill("Chased the broker again");
    await input.press("Control+Enter"); // ⌘/Ctrl-Enter sends
    await expect(page.getByTestId("card-detail-comments").getByText("Chased the broker again")).toBeVisible();
  });

  test("a board folds to its header (persisted) and unfolds again", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".sync-dot.online")).toBeVisible();
    const lae = () => page.locator(".board", { hasText: "Life & Errands" });
    await expect(lae().locator(".board-cols")).toBeVisible();

    await lae().hover();
    await lae().getByTestId("board-collapse").click();
    // folded: columns gone, but title + card count still shown
    await expect(lae().locator(".board-cols")).toHaveCount(0);
    await expect(lae().getByTestId("board-title")).toBeVisible();
    await expect(lae().getByTestId("board-count")).toBeVisible();

    // the fold persists across a reload
    await page.waitForTimeout(700);
    await page.reload();
    await expect(lae().locator(".board-cols")).toHaveCount(0);

    // unfold restores the columns
    await lae().getByTestId("board-collapse").click();
    await expect(lae().locator(".board-cols")).toBeVisible();
  });

});
