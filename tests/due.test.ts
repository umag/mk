import { describe, expect, it } from "vitest";
import { dueLabel, dueStateOf } from "../src/core/due";

// Fixed "now" = Mon Jun 22 2026, local midnight-ish, to keep assertions tz-stable.
const NOW = new Date(2026, 5, 22, 10, 0, 0).getTime();

describe("dueStateOf", () => {
  it("classifies relative to today", () => {
    expect(dueStateOf(null, NOW)).toBe("none");
    expect(dueStateOf("2026-06-20", NOW)).toBe("overdue");
    expect(dueStateOf("2026-06-22", NOW)).toBe("today");
    expect(dueStateOf("2026-06-25", NOW)).toBe("soon"); // within a week
    expect(dueStateOf("2026-08-01", NOW)).toBe("none"); // far future = no urgency
  });
  it("treats a malformed date as none", () => {
    expect(dueStateOf("nope", NOW)).toBe("none");
  });
});

describe("dueLabel", () => {
  it("renders a short date, or 'today'", () => {
    expect(dueLabel(null, NOW)).toBe("");
    expect(dueLabel("2026-06-22", NOW)).toBe("today");
    expect(dueLabel("2026-06-23", NOW)).toBe("Jun 23");
    expect(dueLabel("2026-12-01", NOW)).toBe("Dec 1");
  });
});
