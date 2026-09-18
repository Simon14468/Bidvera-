/**
 * Guards so load-test tooling cannot silently target production.
 */

const BLOCKED_HOST_SNIPPETS = [
  "neon.tech",
  "vercel.app",
  "bidvera.com",
  "amazonaws.com",
  "railway.app",
  "render.com",
  "supabase.co",
];

const ALLOWED_LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "postgres",
  "app",
  "app1",
  "app2",
  "app3",
  "nginx",
  "0.0.0.0",
]);

export function hostnameFromUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    // postgres URLs without protocol
    try {
      return new URL(raw.replace(/^postgresql:/i, "http:")).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}

export function isBlockedProductionHost(hostname: string | null): boolean {
  if (!hostname) return false;
  if (ALLOWED_LOCAL_HOSTS.has(hostname)) return false;
  if (hostname.endsWith(".local")) return false;
  return BLOCKED_HOST_SNIPPETS.some((s) => hostname.includes(s));
}

export function assertLoadTestTargetSafe(input: {
  databaseUrl?: string | null;
  appUrl?: string | null;
  loadTestMode?: string | null;
  allowForce?: boolean;
}): void {
  if (input.allowForce && process.env.LOAD_TEST_ALLOW_REMOTE === "1") {
    return;
  }
  const dbHost = hostnameFromUrl(input.databaseUrl ?? process.env.DATABASE_URL);
  const appHost = hostnameFromUrl(input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL);
  if (isBlockedProductionHost(dbHost)) {
    throw new Error(
      `Refusing load-test against database host "${dbHost}". Use the dedicated Docker Postgres (localhost:5433 / service postgres).`,
    );
  }
  if (isBlockedProductionHost(appHost)) {
    throw new Error(
      `Refusing load-test against app host "${appHost}". Use http://localhost:3100 or the Docker app service.`,
    );
  }
  if (process.env.NODE_ENV === "production" && input.loadTestMode !== "1" && process.env.LOAD_TEST_MODE !== "1") {
    // Allow seed inside the load-test container (LOAD_TEST_MODE=1).
    if (!dbHost || !ALLOWED_LOCAL_HOSTS.has(dbHost)) {
      throw new Error("Load-test seed refused outside LOAD_TEST_MODE on non-local production.");
    }
  }
}
