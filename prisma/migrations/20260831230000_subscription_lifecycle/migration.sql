-- Subscription lifecycle: startedAt, grace, usage period windows
ALTER TABLE "CompanyUsage" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "CompanyUsage" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3);

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "graceDays" INTEGER;

-- Backfill startedAt from existing period start / createdAt
UPDATE "Subscription"
SET "startedAt" = COALESCE("currentPeriodStart", "createdAt")
WHERE "startedAt" IS NULL;

-- Align usage windows to subscription periods where missing
UPDATE "CompanyUsage" cu
SET
  "periodStart" = s."currentPeriodStart",
  "periodEnd" = s."currentPeriodEnd"
FROM "Subscription" s
WHERE s."companyId" = cu."companyId"
  AND cu."periodStart" IS NULL
  AND s."currentPeriodStart" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
CREATE INDEX IF NOT EXISTS "Subscription_gracePeriodEndsAt_idx" ON "Subscription"("gracePeriodEndsAt");
