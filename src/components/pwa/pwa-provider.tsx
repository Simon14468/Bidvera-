"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PlatformHint = "windows" | "mac" | "ios" | "android" | "other";

type DismissState = {
  count: number;
  /** Hide until this timestamp (ms). Null when not snoozed. */
  until: number | null;
  /** After more than 4 dismissals — never show again for this account. */
  forever: boolean;
};

type PwaContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  platform: PlatformHint;
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Native Chromium/Edge install dialog when available. */
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
  dismissBanner: () => void;
  /** True while snoozed or permanently dismissed. */
  bannerDismissed: boolean;
  /** Permanently hidden for this account (>4 dismissals). */
  bannerGoneForever: boolean;
  updateReady: boolean;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

const LEGACY_DISMISS_KEY = "bidvera-pwa-install-dismissed";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Permanent hide after more than this many dismissals. */
const MAX_SNOOZE_DISMISSES = 4;

function storageKey(accountId: string) {
  return `bidvera-pwa-install-dismiss:${accountId}`;
}

function emptyDismiss(): DismissState {
  return { count: 0, until: null, forever: false };
}

function readDismiss(accountId: string): DismissState {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) {
      localStorage.removeItem(LEGACY_DISMISS_KEY);
      return emptyDismiss();
    }
    const parsed = JSON.parse(raw) as Partial<DismissState>;
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      until: typeof parsed.until === "number" ? parsed.until : null,
      forever: Boolean(parsed.forever),
    };
  } catch {
    return emptyDismiss();
  }
}

function writeDismiss(accountId: string, state: DismissState) {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(state));
    localStorage.removeItem(LEGACY_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

function isHidden(state: DismissState, now = Date.now()): boolean {
  if (state.forever) return true;
  if (state.until != null && now < state.until) return true;
  return false;
}

function detectPlatform(): PlatformHint {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows|Win64|Win32/i.test(ua)) return "windows";
  return "other";
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const wco = window.matchMedia("(display-mode: window-controls-overlay)").matches;
  return mq || iosStandalone || wco;
}

function waitForPrompt(
  getPrompt: () => BeforeInstallPromptEvent | null,
  ms: number,
): Promise<BeforeInstallPromptEvent | null> {
  const existing = getPrompt();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const p = getPrompt();
      if (p) {
        resolve(p);
        return;
      }
      if (Date.now() - started >= ms) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

export function PwaProvider({
  children,
  accountId,
}: {
  children: ReactNode;
  /** Company / account id — dismiss rules are scoped per account. */
  accountId: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismiss, setDismiss] = useState<DismissState>(emptyDismiss);
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [platform, setPlatform] = useState<PlatformHint>("other");

  const capturePrompt = useCallback((event: BeforeInstallPromptEvent) => {
    deferredPromptRef.current = event;
    setDeferredPrompt(event);
  }, []);

  const clearPrompt = useCallback(() => {
    deferredPromptRef.current = null;
    setDeferredPrompt(null);
  }, []);

  useEffect(() => {
    const onChange = () => setIsStandalone(detectStandalone());
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", onChange);

    const onBip = (e: Event) => {
      e.preventDefault();
      capturePrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      clearPrompt();
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const hydrate = window.requestAnimationFrame(() => {
      setPlatform(detectPlatform());
      setIsStandalone(detectStandalone());
      setDismiss(readDismiss(accountId));
    });

    let updateTimer: number | undefined;
    let onFocus: (() => void) | undefined;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          const checkWaiting = () => {
            if (reg.waiting) {
              setWaitingWorker(reg.waiting);
              setUpdateReady(true);
            }
          };
          checkWaiting();
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(worker);
                setUpdateReady(true);
              }
            });
          });

          void reg.update();
          updateTimer = window.setInterval(() => {
            void reg.update();
          }, 60 * 60 * 1000);

          onFocus = () => {
            void reg.update();
          };
          window.addEventListener("focus", onFocus);
        })
        .catch(() => {
          /* SW optional in some environments */
        });

      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          if ("getInstalledRelatedApps" in navigator) {
            const apps = await (
              navigator as Navigator & {
                getInstalledRelatedApps?: () => Promise<unknown[]>;
              }
            ).getInstalledRelatedApps?.();
            if (apps && apps.length > 0) setIsInstalled(true);
          }
        } catch {
          /* ignore */
        }
        void reg;
      });
    }

    return () => {
      window.cancelAnimationFrame(hydrate);
      if (updateTimer) window.clearInterval(updateTimer);
      if (onFocus) window.removeEventListener("focus", onFocus);
      mq.removeEventListener("change", onChange);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [accountId, capturePrompt, clearPrompt]);

  const install = useCallback(async () => {
    // Brief wait: BIP can land just after SW activates on first visit.
    const promptEvent = await waitForPrompt(() => deferredPromptRef.current, 800);
    if (!promptEvent) return "unavailable" as const;
    try {
      // Must stay in the user-gesture chain — call promptly.
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearPrompt();
      if (choice.outcome === "accepted") setIsInstalled(true);
      return choice.outcome;
    } catch {
      clearPrompt();
      return "unavailable" as const;
    }
  }, [clearPrompt]);

  const dismissBanner = useCallback(() => {
    setDismiss((prev) => {
      const count = prev.count + 1;
      const forever = count > MAX_SNOOZE_DISMISSES;
      const next: DismissState = forever
        ? { count, until: null, forever: true }
        : { count, until: Date.now() + WEEK_MS, forever: false };
      writeDismiss(accountId, next);
      return next;
    });
  }, [accountId]);

  const applyUpdate = useCallback(() => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }, [waitingWorker]);

  const bannerDismissed = isHidden(dismiss);
  const bannerGoneForever = dismiss.forever;

  const value = useMemo<PwaContextValue>(
    () => ({
      canInstall: Boolean(deferredPrompt) && !isStandalone && !isInstalled,
      isInstalled: isInstalled || isStandalone,
      isStandalone,
      platform,
      deferredPrompt,
      install,
      dismissBanner,
      bannerDismissed,
      bannerGoneForever,
      updateReady,
      applyUpdate,
    }),
    [
      deferredPrompt,
      isStandalone,
      isInstalled,
      platform,
      install,
      dismissBanner,
      bannerDismissed,
      bannerGoneForever,
      updateReady,
      applyUpdate,
    ],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) {
    throw new Error("usePwa must be used within PwaProvider");
  }
  return ctx;
}
