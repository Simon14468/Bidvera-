"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/cn";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = !mounted || theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground",
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}
