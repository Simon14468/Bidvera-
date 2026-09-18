import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number;
  label?: string;
  className?: string;
}

export function Progress({ value, label, className }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{label}</span>
          <span className="font-medium text-foreground">{Math.round(clamped)}%</span>
        </div>
      ) : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-border/70"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
