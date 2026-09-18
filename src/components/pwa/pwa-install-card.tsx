"use client";

import { usePwa } from "@/components/pwa/pwa-provider";
import { Modal } from "@/components/ui/modal";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  CheckCircle2,
  Download,
  HardDriveDownload,
  RefreshCw,
  X,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";

type PwaCopy = Dictionary["app"]["pwa"];
type BrowserKind = "chrome" | "edge" | "safari" | "other";

function detectBrowser(): BrowserKind {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "edge";
  if (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg/i.test(ua)) return "safari";
  if (/Chrome|CriOS|Chromium/i.test(ua)) return "chrome";
  return "other";
}

function Windows11Icon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      <rect x="2" y="2" width="9.5" height="9.5" rx="1" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" rx="1" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" rx="1" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="1" fill="#FFB900" />
    </svg>
  );
}

function MacOsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-1.98 1.09-3.13-1.05.04-2.31.7-3.06 1.58-.67.78-1.25 2.03-1.09 3.23 1.15.09 2.33-.61 3.06-1.68" />
    </svg>
  );
}

function PlatformBadges({ availableOn }: { availableOn: string }) {
  return (
    <div className="mt-3 flex items-center gap-2" aria-label={availableOn}>
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted"
        title="Windows 11"
      >
        <Windows11Icon className="size-3.5" />
        Windows
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted"
        title="macOS"
      >
        <MacOsIcon className="size-3.5 text-foreground" />
        macOS
      </span>
    </div>
  );
}

function InstallGuideBody({
  browser,
  platform,
  copy,
}: {
  browser: BrowserKind;
  platform: ReturnType<typeof usePwa>["platform"];
  copy: PwaCopy;
}) {
  if (browser === "safari" || platform === "ios") {
    if (platform === "ios") {
      return (
        <ol className="list-decimal space-y-2 ps-4 text-sm leading-relaxed text-muted">
          <li>{copy.iosStep1}</li>
          <li>
            {copy.iosStep2}{" "}
            <strong className="text-foreground">{copy.iosStep2Strong}</strong>.
          </li>
          <li>{copy.iosStep3}</li>
        </ol>
      );
    }
    return (
      <ol className="list-decimal space-y-2 ps-4 text-sm leading-relaxed text-muted">
        <li>
          {copy.safariMacStep1}{" "}
          <strong className="text-foreground">{copy.safariMacStep1Strong}</strong>.
        </li>
        <li>
          {copy.safariMacStep2}{" "}
          <strong className="text-foreground">{copy.safariMacStep2Strong}</strong>.
        </li>
        <li>{copy.safariMacStep3}</li>
      </ol>
    );
  }

  const browserName =
    browser === "edge" ? "Edge" : browser === "chrome" ? "Chrome" : "Chrome or Edge";

  return (
    <ol className="list-decimal space-y-2 ps-4 text-sm leading-relaxed text-muted">
      <li>
        {copy.chromiumStep1Before.replaceAll("{browser}", browserName)}{" "}
        <strong className="text-foreground">{copy.chromiumStep1Strong}</strong>{" "}
        {copy.chromiumStep1After}
      </li>
      <li>
        {copy.chromiumStep2Before}{" "}
        <strong className="text-foreground">{copy.chromiumStep2Strong}</strong>.
      </li>
      <li>
        {copy.chromiumStep3Before}{" "}
        <strong className="text-foreground">{copy.chromiumStep3Install}</strong>{" "}
        {copy.chromiumStep3Mid}{" "}
        <strong className="text-foreground">{copy.chromiumStep3Apps}</strong>.
      </li>
    </ol>
  );
}

export function PwaInstallCard({
  className,
  copy,
}: {
  className?: string;
  copy: PwaCopy;
}) {
  const {
    canInstall,
    isInstalled,
    isStandalone,
    platform,
    install,
    dismissBanner,
    bannerDismissed,
    bannerGoneForever,
    updateReady,
    applyUpdate,
  } = usePwa();
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const browser = useSyncExternalStore(
    () => () => {},
    detectBrowser,
    () => "other" as BrowserKind,
  );

  if (updateReady) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <RefreshCw className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{copy.updateTitle}</p>
            <p className="mt-0.5 text-sm text-muted">{copy.updateBody}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {copy.updateNow}
        </button>
      </div>
    );
  }

  if (isInstalled || isStandalone) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-success/25 bg-success/[0.06] p-4",
          className,
        )}
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.installedTitle}</p>
          <p className="mt-0.5 text-sm text-muted">{copy.installedBody}</p>
        </div>
      </div>
    );
  }

  if (bannerDismissed || bannerGoneForever) {
    return null;
  }

  async function onInstall() {
    setBusy(true);
    try {
      // Safari / iOS have no beforeinstallprompt — show short manual guide only.
      if (browser === "safari" || platform === "ios") {
        setGuideOpen(true);
        return;
      }

      // Chrome / Edge / supported Chromium: open the native install UI immediately.
      const result = await install();
      if (result === "accepted") return;
      if (result === "dismissed") return;

      // Prompt not available yet (criteria / unsupported browser) — fall back to guide.
      setGuideOpen(true);
    } finally {
      setBusy(false);
    }
  }

  const guideTitle =
    browser === "safari"
      ? copy.guideTitleSafari
      : browser === "edge"
        ? copy.guideTitleEdge
        : browser === "chrome"
          ? copy.guideTitleChrome
          : copy.guideTitleDefault;

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary-muted/80 via-card to-card p-5 shadow-[var(--shadow-soft)]",
          className,
        )}
      >
        <div
          className="pointer-events-none absolute -end-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_8px_20px_rgba(76,175,109,0.35)]">
              <HardDriveDownload className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">
                {copy.title}
              </p>
              <p className="mt-1 text-sm text-muted">
                {copy.bodyBefore}{" "}
                <strong className="font-medium text-foreground">Windows</strong>{" "}
                {copy.bodyAnd}{" "}
                <strong className="font-medium text-foreground">Mac</strong>{" "}
                {copy.bodyAfter}
              </p>
              <PlatformBadges availableOn={copy.availableOn} />
            </div>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label={copy.dismiss}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="relative mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={onInstall}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:bg-primary-hover disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden />
            {busy ? copy.openingInstaller : copy.installCta}
          </button>
        </div>
      </div>

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title={guideTitle}
        description={copy.guideDescription}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <HardDriveDownload className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Bidvera AI</p>
              <p className="text-xs text-muted">{copy.desktopMeta}</p>
            </div>
          </div>

          <InstallGuideBody browser={browser} platform={platform} copy={copy} />

          {canInstall ? (
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await install();
                  if (result === "accepted") setGuideOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Download className="size-4" aria-hidden />
              {copy.openInstallDialog}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-foreground/[0.06]"
            >
              {copy.gotIt}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
