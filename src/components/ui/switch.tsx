"use client";

import { cn } from "@/lib/cn";
import styles from "@/components/ui/switch.module.css";
import { useId, type ButtonHTMLAttributes } from "react";

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v8" />
      <path d="M7.5 6.8a7 7 0 1 0 9 0" />
    </svg>
  );
}

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role" | "aria-checked" | "children"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
};

/**
 * Tactile ON/OFF switch matching Bidvera green.
 * Uses logical inline props so RTL mirrors naturally.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  label,
  ...props
}: SwitchProps) {
  const reactId = useId();
  const switchId = id ?? reactId;

  return (
    <button
      type="button"
      id={switchId}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onCheckedChange(!checked);
      }}
      className={cn(
        styles.switch,
        checked ? styles.on : styles.off,
        disabled && styles.disabled,
        className,
      )}
      {...props}
    >
      <span className={styles.track} aria-hidden>
        <span className={styles.text}>{checked ? "ON" : "OFF"}</span>
        <span className={styles.knob}>
          <PowerIcon className={styles.icon} />
        </span>
      </span>
    </button>
  );
}
