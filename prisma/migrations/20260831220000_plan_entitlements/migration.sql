-- Real entitlements: yearly numeric limits + prefer entitlement-derived marketing labels
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "analysesLimitYearly" INTEGER;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "seatsLimitYearly" INTEGER;
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "preferEntitlementLabels" BOOLEAN NOT NULL DEFAULT true;
