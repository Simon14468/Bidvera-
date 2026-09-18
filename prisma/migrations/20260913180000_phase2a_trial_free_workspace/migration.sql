-- Phase 2A: Free Workspace legacy enum + payment-identity hash for trial abuse.

DO $$ BEGIN
  ALTER TYPE "SubscriptionPlan" ADD VALUE 'FREE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "TrialRiskSignal" ADD COLUMN IF NOT EXISTS "paymentFingerprintHash" TEXT;

CREATE INDEX IF NOT EXISTS "TrialRiskSignal_paymentFingerprintHash_idx"
  ON "TrialRiskSignal"("paymentFingerprintHash");

-- Enable 14-day trials on paid plans that were never configured.
UPDATE "Plan"
SET "trialEligible" = true, "trialDays" = 14
WHERE slug IN ('starter', 'pro', 'business')
  AND "trialDays" IS NULL;
