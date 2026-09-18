"use client";

/**
 * Super Admin → Enter company workspace in a new tab.
 *
 * Uses a real POST (same as the original form), not fetch+claim:
 * open about:blank on the click gesture, write a POST form, submit it.
 * That avoids Cursor Simple Browser turning target=_blank into GET → 405,
 * and avoids the stuck Opening state from a hanging JSON fetch.
 */
export function EnterCompanyForm({
  action,
  size = "sm",
}: {
  action: string;
  size?: "sm" | "md";
}) {
  const buttonClass =
    size === "md"
      ? "inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
      : "inline-flex rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-600";

  function enterAccount() {
    const safeAction = action
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");

    let popup: Window | null = null;
    try {
      popup = window.open("about:blank", "_blank");
    } catch {
      popup = null;
    }

    if (popup) {
      try {
        popup.document.open();
        popup.document.write(
          `<!doctype html><html><head><meta charset="utf-8"><title>Entering…</title></head>
          <body style="font-family:system-ui;background:#020617;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0">
            <p>Entering company account…</p>
            <form id="bidvera-sa-enter" method="POST" action="${safeAction}"></form>
            <script>document.getElementById("bidvera-sa-enter").submit()</script>
          </body></html>`,
        );
        popup.document.close();
        return;
      } catch {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      }
    }

    // Popup unavailable (Cursor single panel / blocker): same-tab POST.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action;
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <button type="button" className={buttonClass} onClick={enterAccount}>
      Enter account
    </button>
  );
}
