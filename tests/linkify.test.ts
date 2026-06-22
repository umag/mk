// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { linkify } from "../src/dom";

const anchorOf = (nodes: Node[]) => nodes.find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement);

describe("linkify", () => {
  it("returns plain text as a single node when there are no links", () => {
    const nodes = linkify("just a card title");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.textContent).toBe("just a card title");
    expect(anchorOf(nodes)).toBeUndefined();
  });

  it("wraps an http(s) URL in a new-tab anchor and preserves the surrounding text", () => {
    const nodes = linkify("see https://example.com/x now");
    const a = anchorOf(nodes)!;
    expect(a.getAttribute("href")).toBe("https://example.com/x");
    expect(a.target).toBe("_blank");
    expect(a.rel).toContain("noopener");
    expect(a.className).toBe("link");
    expect(nodes.map((n) => n.textContent).join("")).toBe("see https://example.com/x now");
  });

  it("excludes trailing punctuation from the link", () => {
    const a = anchorOf(linkify("(see https://example.com)."))!;
    expect(a.getAttribute("href")).toBe("https://example.com");
  });

  it("linkifies multiple URLs", () => {
    const anchors = linkify("a http://a.com/1 b https://b.com/2 c").filter((n) => n instanceof HTMLAnchorElement);
    expect(anchors).toHaveLength(2);
  });

  it("ignores non-http schemes and bare words", () => {
    expect(anchorOf(linkify("ftp://x and mailto:a@b.com and www.x.com"))).toBeUndefined();
  });
});
