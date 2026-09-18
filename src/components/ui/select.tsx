import { cn } from "@/lib/cn";
import { SelectHTMLAttributes, forwardRef } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, id, options, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-danger",
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : hint ? (
          <p className="text-sm text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
