import { el } from "./dom";
import { login } from "./sync/auth";

// Full-screen login gate. Resolves once the user authenticates. Used both at boot
// (auth enabled + not yet authed) and mid-session when the sync client reports a
// 401 (expired session). Matches DESIGN.md — errors use --ink, never --hot.

export function showLogin(root: HTMLElement = document.body): Promise<void> {
  return new Promise((resolve) => {
    const error = el("p", {
      class: "login-error",
      attrs: { role: "alert", "aria-live": "assertive" },
      data: { testid: "login-error" },
    });

    const input = el("input", {
      class: "login-input",
      attrs: {
        id: "mk-passphrase",
        type: "password",
        name: "passphrase",
        autocomplete: "current-password",
        "aria-label": "Passphrase",
        placeholder: "Passphrase",
        required: true,
      },
      data: { testid: "login-input" },
    });

    const submit = el("button", {
      class: "login-submit",
      text: "Unlock",
      attrs: { type: "submit" },
      data: { testid: "login-submit" },
    });

    let countdown: ReturnType<typeof setInterval> | null = null;
    const setBusy = (busy: boolean) => {
      submit.disabled = busy;
      input.disabled = busy;
    };
    const fail = (msg: string) => {
      error.textContent = msg;
      input.focus();
      input.select();
    };

    // Locked out: count down, keeping submit disabled, then re-enable.
    const lockFor = (seconds: number) => {
      setBusy(true);
      let left = Math.max(1, seconds);
      const tick = () => {
        error.textContent = `Too many attempts — try again in ${left}s.`;
        if (left <= 0) {
          if (countdown) clearInterval(countdown);
          countdown = null;
          error.textContent = "";
          setBusy(false);
          input.focus();
          return;
        }
        left--;
      };
      tick();
      countdown = setInterval(tick, 1000);
    };

    const form = el(
      "form",
      {
        class: "login-form",
        data: { testid: "login-form" },
        on: {
          submit: async (e: Event) => {
            e.preventDefault();
            if (submit.disabled) return;
            error.textContent = "";
            setBusy(true);
            const res = await login(input.value);
            if (res.ok) {
              if (countdown) clearInterval(countdown);
              overlay.remove();
              resolve();
              return;
            }
            if (res.status === 429 && res.retryAfter) {
              lockFor(res.retryAfter);
              return;
            }
            setBusy(false);
            fail(
              res.status === 401
                ? "Incorrect passphrase."
                : res.status >= 500
                ? "Server error. Try again."
                : "Couldn’t reach the server. Try again.",
            );
          },
        },
      },
      el("h1", { class: "login-title", html: "micro·<em>kaiten</em>" }),
      el("label", {
        class: "login-label",
        text: "Enter your passphrase to continue.",
        attrs: { for: "mk-passphrase" },
      }),
      input,
      submit,
      error,
    );

    const overlay = el("div", {
      class: "login-overlay",
      data: { testid: "login-overlay" },
    }, form);
    root.appendChild(overlay);
    requestAnimationFrame(() => input.focus());
  });
}
