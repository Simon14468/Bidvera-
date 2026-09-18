/**
 * Normalize DATABASE_URL for Prisma + Neon/pgbouncer poolers.
 * Avoids default pool exhaustion (connection_limit ≈ 9) on pooled hosts.
 */

function toParseableUrl(raw: string): URL {
  return new URL(raw.replace(/^postgres(ql)?:/i, "https:"));
}

function toPostgresUrl(url: URL): string {
  return url.toString().replace(/^https:/i, "postgresql:");
}

export function isPooledDatabaseHost(hostname: string): boolean {
  return /-pooler\./i.test(hostname) || /\.pooler\./i.test(hostname);
}

/**
 * Returns a Prisma-ready URL with safe pool settings when missing.
 * Does not log or echo credentials.
 */
export function resolvePrismaDatasourceUrl(
  raw: string | undefined | null,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;

  let url: URL;
  try {
    url = toParseableUrl(trimmed);
  } catch {
    return trimmed;
  }

  const pooled =
    isPooledDatabaseHost(url.hostname) ||
    url.searchParams.get("pgbouncer") === "true";

  if (pooled && url.searchParams.get("pgbouncer") !== "true") {
    url.searchParams.set("pgbouncer", "true");
  }

  if (!url.searchParams.has("connection_limit")) {
    const fromEnv = env.PRISMA_CONNECTION_LIMIT?.trim();
    // Pooled Neon: keep the app client small so Next.js + worker stay under plan caps.
    // Dedicated Postgres (local/staging): allow enough concurrent queries for multi-tenant reads.
    // Evidence: load-test peak pg_stat_activity stuck at ~11 with default 10 under 50+ VUs.
    const localDedicated =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "postgres";
    url.searchParams.set(
      "connection_limit",
      fromEnv && /^\d+$/.test(fromEnv)
        ? fromEnv
        : pooled
          ? "5"
          : localDedicated
            ? "40"
            : "20",
    );
  }

  if (!url.searchParams.has("pool_timeout")) {
    const fromEnv = env.PRISMA_POOL_TIMEOUT?.trim();
    url.searchParams.set(
      "pool_timeout",
      fromEnv && /^\d+$/.test(fromEnv) ? fromEnv : "20",
    );
  }

  if (!url.searchParams.has("connect_timeout")) {
    url.searchParams.set("connect_timeout", "10");
  }

  return toPostgresUrl(url);
}
