// Tiny hyperscript helper — keeps rendering declarative without a framework runtime.

type Child = Node | string | number | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  html?: string;
  /** data-* attributes */
  data?: Record<string, string | number | undefined>;
  /** plain attributes (aria-*, role, type, etc.) */
  attrs?: Record<string, string | number | boolean | undefined>;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  /** event listeners keyed by event name */
  on?: Partial<Record<keyof HTMLElementEventMap, (e: never) => void>> &
    Record<string, (e: never) => void>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text != null) node.textContent = props.text;
  if (props.html != null) node.innerHTML = props.html;
  if (props.data) {
    for (const [k, v] of Object.entries(props.data)) {
      if (v != null) node.dataset[k] = String(v);
    }
  }
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) {
      if (v === false || v == null) continue;
      node.setAttribute(k, v === true ? "" : String(v));
    }
  }
  if (props.style) {
    // setProperty handles both custom props (--x) and plain kebab props (left, width)
    for (const [k, v] of Object.entries(props.style)) {
      if (v != null) node.style.setProperty(k, String(v));
    }
  }
  if (props.on) {
    for (const [k, fn] of Object.entries(props.on)) {
      node.addEventListener(k, fn as EventListener);
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Build an element from an SVG string (icons). */
export function svg(markup: string, cls?: string): SVGElement {
  const tpl = document.createElement("template");
  tpl.innerHTML = markup.trim();
  const node = tpl.content.firstElementChild as SVGElement;
  if (cls) node.setAttribute("class", cls);
  return node;
}

// Match http(s) URLs, stopping before trailing punctuation so "(see https://x.y)" works.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g;

/** True when the whole string is a single http(s) URL (a pasted link). */
export const isUrl = (s: string): boolean => /^https?:\/\/\S+$/i.test(s.trim());

/**
 * Turn a plain string into text nodes + clickable <a> for any http(s) URLs.
 * The anchors stop pointerdown/click from reaching the card (no drag, no
 * open-detail) so the link just opens. Returns the original text as one node
 * when there are no links.
 */
export function linkify(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    const i = m.index ?? 0;
    if (i > last) out.push(document.createTextNode(text.slice(last, i)));
    const a = document.createElement("a");
    a.href = url;
    a.textContent = url;
    a.className = "link";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.addEventListener("pointerdown", (e) => e.stopPropagation());
    a.addEventListener("click", (e) => e.stopPropagation());
    out.push(a);
    last = i + url.length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

export const uid = (prefix = "id"): string =>
  `${prefix}-${Math.floor(performance.now() * 1000).toString(36)}-${(globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? 0).toString(36)}`;
