import { describe, expect, it } from "vitest";
import {
  addLabelTo,
  cardMatchesFilter,
  collectLabels,
  labelHue,
  MAX_LABELS_PER_CARD,
  normalizeLabel,
  removeLabelFrom,
  sanitizeLabels,
  toggleInFilter,
} from "../src/core/labels";
import { ARCHIVE_BOARD_ID } from "../src/core/done";
import type { Card, WorldState } from "../src/types";

const card = (id: string, labels: string[] = []): Card => ({
  id, title: id, notes: "", due: null, labels, comments: [], enteredColumnAt: 0,
});

describe("normalizeLabel", () => {
  it("strips a leading #, trims, and collapses whitespace", () => {
    expect(normalizeLabel("  #bug  ")).toBe("bug");
    expect(normalizeLabel("high   priority")).toBe("high priority");
  });
  it("preserves casing", () => {
    expect(normalizeLabel("Mortgage")).toBe("Mortgage");
  });
  it("returns null for empty / punctuation-only input", () => {
    expect(normalizeLabel("   ")).toBeNull();
    expect(normalizeLabel("###")).toBeNull();
  });
  it("caps length", () => {
    expect(normalizeLabel("x".repeat(50))!.length).toBe(24);
  });
});

describe("addLabelTo", () => {
  it("adds a normalized label without mutating the input", () => {
    const a = ["bug"];
    const b = addLabelTo(a, "#urgent");
    expect(b).toEqual(["bug", "urgent"]);
    expect(a).toEqual(["bug"]); // unchanged
  });
  it("dedupes case-insensitively", () => {
    expect(addLabelTo(["Bug"], "bug")).toEqual(["Bug"]);
  });
  it("ignores empty input", () => {
    expect(addLabelTo(["bug"], "  ")).toEqual(["bug"]);
  });
  it("caps the number of labels per card", () => {
    const full = Array.from({ length: MAX_LABELS_PER_CARD }, (_, i) => `l${i}`);
    expect(addLabelTo(full, "extra")).toEqual(full);
  });
});

describe("removeLabelFrom / sanitizeLabels / toggleInFilter", () => {
  it("removes case-insensitively", () => {
    expect(removeLabelFrom(["Bug", "urgent"], "bug")).toEqual(["urgent"]);
  });
  it("sanitizes a raw list (normalize + dedupe + cap)", () => {
    expect(sanitizeLabels(["#bug", "Bug", " urgent "])).toEqual(["bug", "urgent"]);
  });
  it("toggles membership preserving order", () => {
    expect(toggleInFilter(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleInFilter(["a", "b"], "A")).toEqual(["b"]);
  });
});

describe("labelHue", () => {
  it("is deterministic, in range, and case-insensitive", () => {
    expect(labelHue("bug")).toBe(labelHue("BUG"));
    expect(labelHue("bug")).toBeGreaterThanOrEqual(0);
    expect(labelHue("bug")).toBeLessThan(360);
  });
  it("separates distinct names", () => {
    expect(labelHue("bug")).not.toBe(labelHue("feature"));
  });
});

function world(): WorldState {
  return {
    boards: [
      {
        id: "b1", title: "B1", x: 0, y: 0,
        columns: [{ id: "c1", name: "Todo", wip: null, cards: [card("k1", ["bug", "urgent"]), card("k2", ["bug"])] }],
      },
      {
        id: ARCHIVE_BOARD_ID, title: "Archive", x: 0, y: 0,
        columns: [{ id: "ca", name: "Archived", wip: null, cards: [card("ka", ["bug", "ignored"])] }],
      },
    ],
  };
}

describe("collectLabels", () => {
  it("counts distinct labels across real boards, busiest first, skipping the archive", () => {
    const labels = collectLabels(world());
    expect(labels).toEqual([
      { name: "bug", count: 2 },
      { name: "urgent", count: 1 },
    ]);
  });
});

describe("cardMatchesFilter", () => {
  it("matches everything when the filter is empty", () => {
    expect(cardMatchesFilter(card("x"), [])).toBe(true);
  });
  it("matches when the card has ANY selected label (OR), case-insensitive", () => {
    expect(cardMatchesFilter(card("x", ["bug"]), ["BUG", "perf"])).toBe(true);
    expect(cardMatchesFilter(card("x", ["chore"]), ["bug", "perf"])).toBe(false);
  });
});
