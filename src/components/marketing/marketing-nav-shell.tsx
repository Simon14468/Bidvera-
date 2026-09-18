"use client";

import { cn } from "@/lib/cn";
import { useEffect, useState, type ReactNode } from "react";

export function MarketingNavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-300 ease-out",
        scrolled
          ? "border-border/80 bg-background/95 shadow-[var(--shadow-soft)]"
          : "border-transparent bg-background/80",
      )}
    >
      {children}
    </header>
  );
}
