import { PrismaClient } from "@prisma/client";
import { resolvePrismaDatasourceUrl } from "@/lib/prisma-url";

export {
  DATABASE_CAPACITY_MESSAGE,
  DATABASE_POOL_MESSAGE,
  isDatabaseCapacityError,
  isDatabasePoolError,
  isDatabaseTransientError,
  rethrowDatabaseCapacityError,
} from "@/lib/db-capacity";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = resolvePrismaDatasourceUrl(process.env.DATABASE_URL);

/**
 * Shared Prisma client (process-wide singleton).
 * Neon pooler URLs get pgbouncer=true + bounded connection_limit automatically.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
  });

// Always cache — Next.js HMR and multi-entry imports must not open extra pools.
globalForPrisma.prisma = prisma;
