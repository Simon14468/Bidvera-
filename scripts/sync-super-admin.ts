/**
 * Sync Super Admin email/password from environment into AdminUser (bcrypt hashed).
 * Does not print credentials. Safe to re-run after rotating env on a VPS.
 *
 * Required env:
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PASSWORD
 *   SUPER_ADMIN_PATH (for route access; not written to DB)
 */
import { syncSuperAdminFromEnv } from "../src/application/admin/auth-service";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await syncSuperAdminFromEnv();
  console.log("Super Admin synced.");
  console.log("  Role:", result.role);
  console.log("  Email: (from SUPER_ADMIN_EMAIL — value not printed)");
  console.log("  Secret: (from SUPER_ADMIN_PASSWORD — hashed at rest, value not printed)");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
