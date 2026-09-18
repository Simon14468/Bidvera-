import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/cn";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn’t complete that request. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mb-3 size-6 text-danger" aria-hidden />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
