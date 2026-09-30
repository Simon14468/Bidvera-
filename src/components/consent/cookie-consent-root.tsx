"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CookieConsentCopy } from "@/i18n/cookie-consent";
import {
  COOKIE_CONSENT_OPEN_SETTINGS_EVENT,
  acceptAllConsent,
  rejectAllConsent,
  buildConsentRecord,
  resolveConsentDecision,
  readConsentCookieFromDocument,
  writeConsentCookieToDocument,
  type CookieConsentRecord,
} from "@/services/consent/cookie-consent";
import { X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

function ConsentSwitch({
  id,
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled
          ? "cursor-not-allowed bg-primary/40"
          : checked
            ? "bg-primary"
            : "bg-border",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function CookieConsentRoot({
  copy,
  privacyHref = "/privacy-policy",
}: {
  copy: CookieConsentCopy;
  privacyHref?: string;
}) {
  const [ready, setReady] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const titleId = useId();
  const settingsTitleId = useId();
  const bannerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const applyRecord = useCallback((record: CookieConsentRecord) => {
    writeConsentCookieToDocument(record);
    setBannerOpen(false);
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    const decision = resolveConsentDecision(readConsentCookieFromDocument());
    const t = window.setTimeout(() => {
      if (decision.status === "set") {
        setAnalytics(decision.record.analytics);
        setMarketing(decision.record.marketing);
        setBannerOpen(false);
      } else {
        if (decision.status === "outdated") {
          setAnalytics(decision.record.analytics);
          setMarketing(decision.record.marketing);
        } else {
          setAnalytics(false);
          setMarketing(false);
        }
        setBannerOpen(true);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onOpenSettings() {
      const decision = resolveConsentDecision(readConsentCookieFromDocument());
      if (decision.status === "set" || decision.status === "outdated") {
        setAnalytics(decision.record.analytics);
        setMarketing(decision.record.marketing);
      }
      setSettingsOpen(true);
      setBannerOpen(false);
    }
    window.addEventListener(COOKIE_CONSENT_OPEN_SETTINGS_EVENT, onOpenSettings);
    return () =>
      window.removeEventListener(
        COOKIE_CONSENT_OPEN_SETTINGS_EVENT,
        onOpenSettings,
      );
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    settingsRef.current?.querySelector<HTMLElement>("button, [href]")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [settingsOpen]);

  if (!ready) return null;

  function onAcceptAll() {
    applyRecord(acceptAllConsent());
  }

  function onRejectAll() {
    applyRecord(rejectAllConsent());
  }

  function onSavePreferences() {
    applyRecord(buildConsentRecord({ analytics, marketing }));
  }

  function openSettings() {
    setSettingsOpen(true);
    setBannerOpen(false);
  }

  function closeBannerWithoutDecision() {
    // Soft dismiss only — decision still required next visit until saved.
    setBannerOpen(false);
  }

  return (
    <>
      {bannerOpen && !settingsOpen ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(1.25rem,calc(1.25rem+env(safe-area-inset-bottom)))] pt-3 sm:px-6 sm:pb-5"
          data-cookie-consent-banner
        >
          <div
            ref={bannerRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="pointer-events-auto relative max-h-[min(70dvh,32rem)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-lift)] sm:max-h-[min(50vh,28rem)] sm:p-5"
          >
            <button
              type="button"
              onClick={closeBannerWithoutDecision}
              className="absolute end-3 top-3 inline-flex size-10 items-center justify-center rounded-xl text-muted transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={copy.closeLabel}
            >
              <X className="size-4" aria-hidden />
            </button>

            <div className="min-w-0 pe-10">
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
              >
                {copy.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {copy.description}{" "}
                <Link
                  href={privacyHref}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {copy.privacyPolicy}
                </Link>
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={openSettings}
              >
                {copy.cookiesSettings}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={onRejectAll}
              >
                {copy.rejectAll}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={onAcceptAll}
              >
                {copy.acceptAll}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-end sm:justify-center sm:p-4 sm:pb-5">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label={copy.closeLabel}
            onClick={() => setSettingsOpen(false)}
          />
          <div
            ref={settingsRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={settingsTitleId}
            className="relative z-10 flex max-h-[min(88dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[var(--shadow-lift)] sm:max-h-[min(70vh,36rem)] sm:rounded-2xl"
            data-cookie-consent-settings
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0 pe-2">
                <h2
                  id={settingsTitleId}
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  {copy.settingsTitle}
                </h2>
                <p className="mt-1 text-sm text-muted">{copy.settingsDescription}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={copy.closeLabel}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <CategoryRow
                title={copy.necessaryTitle}
                body={copy.necessaryBody}
                trailing={
                  <span className="rounded-lg bg-primary-muted px-2.5 py-1 text-xs font-semibold text-primary">
                    {copy.necessaryAlwaysActive}
                  </span>
                }
              />
              <CategoryRow
                title={copy.analyticsTitle}
                body={copy.analyticsBody}
                trailing={
                  <ConsentSwitch
                    id="cookie-consent-analytics"
                    checked={analytics}
                    label={copy.analyticsTitle}
                    onCheckedChange={setAnalytics}
                  />
                }
              />
              <CategoryRow
                title={copy.marketingTitle}
                body={copy.marketingBody}
                trailing={
                  <ConsentSwitch
                    id="cookie-consent-marketing"
                    checked={marketing}
                    label={copy.marketingTitle}
                    onCheckedChange={setMarketing}
                  />
                }
              />
              <p className="pt-1 text-sm text-muted">
                <Link
                  href={privacyHref}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {copy.privacyPolicy}
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={onRejectAll}
              >
                {copy.rejectAll}
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={onSavePreferences}
              >
                {copy.savePreferences}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CategoryRow({
  title,
  body,
  trailing,
}: {
  title: string;
  body: string;
  trailing: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
            {body}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">{trailing}</div>
      </div>
    </div>
  );
}

export function CookieSettingsLink({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "text-sm text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_SETTINGS_EVENT));
      }}
    >
      {label}
    </button>
  );
}
