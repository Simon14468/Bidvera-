-- Reports + deadline alerts: Alert dedupe, DEADLINE_PASSED, company notification prefs
-- Applied via `prisma db push` in development; keep for deploy documentation.

ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'DEADLINE_PASSED';

ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Alert_dedupeKey_key" ON "Alert"("dedupeKey");

CREATE TABLE IF NOT EXISTS "CompanyNotificationPrefs" (
    "companyId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deadlineAlert7d" BOOLEAN NOT NULL DEFAULT true,
    "deadlineAlert3d" BOOLEAN NOT NULL DEFAULT true,
    "deadlineAlert24h" BOOLEAN NOT NULL DEFAULT true,
    "deadlineAlertPassed" BOOLEAN NOT NULL DEFAULT true,
    "highRiskAlerts" BOOLEAN NOT NULL DEFAULT true,
    "decisionAlerts" BOOLEAN NOT NULL DEFAULT true,
    "missingDocAlerts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyNotificationPrefs_pkey" PRIMARY KEY ("companyId")
);

ALTER TABLE "CompanyNotificationPrefs" DROP CONSTRAINT IF EXISTS "CompanyNotificationPrefs_companyId_fkey";
ALTER TABLE "CompanyNotificationPrefs" ADD CONSTRAINT "CompanyNotificationPrefs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
