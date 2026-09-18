import { DATABASE_CAPACITY_MESSAGE } from "@/lib/db-capacity";

export function DatabaseUnavailable({ detail }: { detail?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-danger">Database unavailable</p>
      <h1 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight">
        The database data-transfer quota is exhausted
      </h1>
      <p className="mt-3 max-w-lg text-sm text-muted">{detail || DATABASE_CAPACITY_MESSAGE}</p>
      <p className="mt-2 max-w-lg text-sm text-muted">
        This is a Neon plan limit, not a session-code bug. After the quota is restored, refresh the
        page.
      </p>
    </div>
  );
}
