"use client";

import { cn } from "@/lib/cn";
import { hasFlag } from "country-flag-icons";
import "country-flag-icons/3x2/flags.css";

/**
 * National flag as a real SVG graphic from `country-flag-icons` (ISO alpha-2).
 * Renders via packaged SVG data-URLs — not regional-indicator characters.
 */
export function CountryFlag({
  code,
  className,
  title,
}: {
  code: string;
  className?: string;
  title?: string;
}) {
  const normalized = code.trim().toUpperCase();
  const available = Boolean(normalized && hasFlag(normalized));

  if (!available) {
    return (
      <span
        className={cn(
          "inline-block h-4 w-6 shrink-0 rounded-[2px] bg-border/70 ring-1 ring-border/80",
          className,
        )}
        title={title ?? normalized}
        aria-hidden
      />
    );
  }

  return (
    <span
      title={title ?? normalized}
      aria-hidden
      className={cn(
        `flag:${normalized}`,
        "inline-block shrink-0 rounded-[2px] align-middle ring-1 ring-border/80",
        className,
      )}
      style={{
        // Package default is 1em; lock to ~16×24 (3:2).
        ["--CountryFlagIcon-height" as string]: "16px",
      }}
    />
  );
}
