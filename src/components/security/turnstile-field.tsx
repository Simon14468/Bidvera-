"use client";

import { useEffect, useRef } from "react";
import type { TurnstileAction } from "@/services/security/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

function getApi(): TurnstileApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { turnstile?: TurnstileApi }).turnstile ?? null;
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  const existing = getApi();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const done = () => {
      const api = getApi();
      if (api) resolve(api);
      else reject(new Error("Turnstile failed to load"));
    };
    const found = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile"]`,
    );
    if (found) {
      found.addEventListener("load", done, { once: true });
      found.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
        once: true,
      });
      if (getApi()) done();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

/**
 * Invisible / interaction-only Turnstile widget. The token is never treated as
 * proof of verification on the client — the server must Siteverify it.
 */
export function TurnstileField({
  siteKey,
  action,
  onToken,
  resetKey = 0,
}: {
  siteKey?: string | null;
  action: TurnstileAction;
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        widgetId.current = api.render(hostRef.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          theme: "auto",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
          "timeout-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenRef.current("");
      });
    return () => {
      cancelled = true;
      const api = getApi();
      if (api && widgetId.current) {
        try {
          api.remove(widgetId.current);
        } catch {
          /* already gone */
        }
      }
      widgetId.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (!resetKey) return;
    const api = getApi();
    if (api && widgetId.current) {
      try {
        api.reset(widgetId.current);
      } catch {
        /* ignore */
      }
    }
    onTokenRef.current("");
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={hostRef} className="flex justify-center" data-turnstile-action={action} />;
}
