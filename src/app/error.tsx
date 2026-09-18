"use client";

import { useMemo } from "react";

function classifyDbError(message: string): "quota" | "pool" | "other" {
  if (
    /data transfer quota|exceeded the data transfer|transfer quota|database is temporarily unavailable because its data-transfer quota/i.test(
      message,
    )
  ) {
    return "quota";
  }
  if (
    /connection pool|Timed out fetching a new connection|P2024|database is busy right now/i.test(
      message,
    )
  ) {
    return "pool";
  }
  return "other";
}

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const kind = useMemo(() => classifyDbError(error.message), [error.message]);

  const title =
    kind === "quota"
      ? "The database data-transfer quota is exhausted"
      : kind === "pool"
        ? "The database is temporarily busy"
        : "This page could not be loaded";

  const body =
    kind === "quota"
      ? "Neon has blocked queries because this project exceeded its transfer plan. Upgrade the Neon plan or wait for the quota to reset, then retry."
      : kind === "pool"
        ? "Too many database connections were in use. Wait a few seconds and try again. If it continues, restart the Next.js app (and worker) so old connections are released."
        : "Please try again in a moment.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-danger">
        {kind === "other" ? "Something went wrong" : "Database unavailable"}
      </p>
      <h1 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-lg text-sm text-muted">{body}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Try again
      </button>
    </div>
  );
}
