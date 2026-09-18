"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Optional mark / icon shown before the title */
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "left";
  /** Full-height sheet (default) or compact panel that grows with content. */
  variant?: "sheet" | "panel";
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  titleIcon,
  children,
  side = "right",
  variant = "sheet",
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isPanel = variant === "panel";

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className={cn(
          "absolute inset-0 bg-foreground/40",
          // Panel is full-screen on phones — dimmer not needed / avoid double-tap confusion
          isPanel && "md:block max-md:hidden",
        )}
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute flex w-full flex-col overflow-hidden border-border bg-card shadow-[var(--shadow-soft)] animate-fade-in",
          isPanel
            ? cn(
                // Phones: edge-to-edge full screen
                "inset-0 h-dvh max-h-dvh max-w-none rounded-none border-0",
                "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
                // md+: floating compact panel above the Ask pill
                "md:inset-auto md:bottom-20 md:h-auto md:max-h-[min(85vh,36rem)] md:max-w-md md:rounded-2xl md:border md:pt-0 md:pb-0",
                side === "right"
                  ? "md:right-4 md:left-auto lg:right-5"
                  : "md:left-4 md:right-auto lg:left-5",
              )
            : cn(
                "top-0 h-full max-w-md",
                side === "right"
                  ? "right-0 rounded-l-2xl border-l"
                  : "left-0 rounded-r-2xl border-r",
              ),
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {titleIcon ? <div className="shrink-0">{titleIcon}</div> : null}
            <div className="min-w-0">
              <h2 id="drawer-title" className="truncate text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm text-muted">{description}</p>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div
          className={cn(
            "flex min-h-0 flex-col p-5",
            isPanel ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto",
          )}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
