import { AppError, ErrorCode } from "@/lib/errors";

export const DATABASE_CAPACITY_MESSAGE =
  "The database is temporarily unavailable because its data-transfer quota was exceeded. Upgrade the Neon plan or wait for the quota to reset, then retry.";

export const DATABASE_POOL_MESSAGE =
  "The database is busy right now (connection pool exhausted). Wait a few seconds and try again. If this keeps happening, restart the app and ensure only one Next.js/worker process is using the database.";

/** Neon / hosted Postgres hard-stop when the transfer plan is exhausted. */
export function isDatabaseCapacityError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /data transfer quota|exceeded the data transfer|transfer quota|database is temporarily unavailable because its data-transfer quota/i.test(
    msg,
  );
}

/** Prisma P2024 / pool checkout timeouts. */
export function isDatabasePoolError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  return (
    code === "P2024" ||
    /Timed out fetching a new connection from the connection pool|connection pool timeout|Can't reach database server/i.test(
      msg,
    )
  );
}

export function isDatabaseTransientError(error: unknown): boolean {
  return isDatabaseCapacityError(error) || isDatabasePoolError(error);
}

export function rethrowDatabaseCapacityError(error: unknown): never {
  if (isDatabaseCapacityError(error)) {
    throw new AppError(ErrorCode.UPSTREAM, DATABASE_CAPACITY_MESSAGE, 503);
  }
  if (isDatabasePoolError(error)) {
    throw new AppError(ErrorCode.UPSTREAM, DATABASE_POOL_MESSAGE, 503);
  }
  throw error;
}
