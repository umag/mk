import { el } from "./dom";

let region: HTMLElement;

export function initToast() {
  region = el("div", { class: "toast-region", attrs: { "aria-live": "polite" } });
  document.body.appendChild(region);
}

export function toast(msg: string, opts: { undo?: () => void } = {}) {
  const node = el("div", { class: "toast", data: { testid: "toast" } });
  node.innerHTML = msg; // callers pass small, trusted markup (e.g. <b>)
  if (opts.undo) {
    const u = el("button", { class: "undo", data: { testid: "toast-undo" }, text: "Undo" });
    u.addEventListener("click", () => {
      opts.undo?.();
      dismiss(node);
    });
    node.appendChild(u);
  }
  region.appendChild(node);
  const timer = setTimeout(() => dismiss(node), 3400);
  node.addEventListener("pointerenter", () => clearTimeout(timer));
}

function dismiss(node: HTMLElement) {
  node.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px)" }],
    { duration: 180, easing: "ease-in", fill: "forwards" },
  ).finished.then(() => node.remove()).catch(() => node.remove());
}
