"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useId } from "react";

/**
 * Settings row: label + tactile ON/OFF switch (workspace preference pattern).
 */
export function SettingsToggleRow({
  label,
  checked,
  disabled,
  onCheckedChange,
  className,
  description,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
  className?: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-3 rounded-xl px-1 py-1.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={cn(
            "block cursor-pointer text-sm leading-snug text-foreground",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        label={label}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
