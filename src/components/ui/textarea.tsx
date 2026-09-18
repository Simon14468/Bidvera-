import { cn } from "@/lib/cn";
import { TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const areaId = id ?? props.name;
    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={areaId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={areaId}
          className={cn(
            "flex min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-danger",
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : hint ? (
          <p className="text-sm text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Textarea.displayName = "Textarea";
