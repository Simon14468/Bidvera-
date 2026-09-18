"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type NavLink = { label: string; href: string };

export function MarketingMobileMenu({
  links,
  actions,
}: {
  links: NavLink[];
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground"
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 z-40 bg-foreground/20 backdrop-blur-[1px] sm:top-16"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id="marketing-mobile-nav"
            className="fixed inset-x-0 top-14 z-50 max-h-[min(70vh,28rem)] overflow-y-auto border-b border-border bg-card px-4 pb-5 pt-3 shadow-[var(--shadow-lift)] animate-fade-in sm:top-16 sm:px-6"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <nav className="mx-auto flex max-w-6xl flex-col gap-1" aria-label="Marketing">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-background active:bg-background"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {actions ? (
              <div className="mx-auto mt-3 flex max-w-6xl flex-col gap-2 border-t border-border pt-4">
                {actions}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
