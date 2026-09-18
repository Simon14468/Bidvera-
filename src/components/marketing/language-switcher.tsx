"use client";

import { setLocaleAction } from "@/i18n/actions";
import {
  localeLabels,
  locales,
  type Locale,
} from "@/i18n/config";
import { cn } from "@/lib/cn";
import { Globe } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";

export function LanguageSwitcher({
  current,
  label,
  variant = "default",
}: {
  current: Locale;
  label: string;
  /** header = always show locale code; sits in the app topbar */
  variant?: "default" | "header";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const isHeader = variant === "header";

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function select(locale: Locale) {
    if (locale === current) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await setLocaleAction(locale);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card text-sm font-medium text-muted transition",
          "hover:border-primary/20 hover:bg-background hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-60",
          isHeader ? "px-2.5 sm:px-3" : "px-2.5",
          open && "border-primary/25 text-foreground",
        )}
      >
        <Globe className="size-4 shrink-0" aria-hidden />
        <span className={cn(!isHeader && "hidden sm:inline")}>
          {localeLabels[current].short}
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute end-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[var(--shadow-lift)] animate-fade-in"
        >
          {locales.map((locale) => {
            const active = locale === current;
            return (
              <li key={locale} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-sm transition",
                    active
                      ? "bg-primary-muted text-primary"
                      : "text-foreground hover:bg-background",
                  )}
                  onClick={() => select(locale)}
                >
                  <span className="min-w-0 flex-1 text-start font-medium">
                    {localeLabels[locale].native}
                  </span>
                  {active ? (
                    <Image
                      src={BRAND_MARK_SRC}
                      alt=""
                      width={16}
                      height={16}
                      unoptimized
                      className="size-4 shrink-0 object-contain"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

