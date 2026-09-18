/**
 * Pre-deploy backup gate — creates a platform backup using existing backup infra.
 * Loads secrets from process env (/etc/bidvera/env on VPS). Never prints secrets.
 *
 * Usage (on VPS, after sourcing env):
 *   npx tsx scripts/deploy-backup-gate.ts
 *
 * Exit 0 only when backup status is SUCCESS.
 */
import { createPlatformBackup } from "../src/services/backup/run";
import { prisma } from "../src/lib/db";

async function main() {
  const row = await createPlatformBackup({ triggeredBy: "deploy" });
  // Public fields only — never log URLs, secrets, or company payloads.
  console.log(
    JSON.stringify({
      ok: row.status === "SUCCESS",
      id: row.id,
      status: row.status,
      method: row.method,
      integrity: row.integrity,
      triggeredBy: row.triggeredBy,
    }),
  );
  if (row.status !== "SUCCESS") {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    const msg = err instanceof Error ? err.message : "backup_gate_failed";
    // Sanitize: never echo connection strings if present in message.
    console.error(
      JSON.stringify({
        ok: false,
        error: msg.replace(/postgresql:\/\/[^\s]+/gi, "[redacted]"),
      }),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
