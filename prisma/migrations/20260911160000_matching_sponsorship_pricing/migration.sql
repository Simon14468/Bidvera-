-- Sponsored Matching company pricing (SA catalog + request intent).
-- Does not change Matching Engine scoring / relevance / ranking.

CREATE TYPE "MatchingSponsorshipPricingBillingPeriod" AS ENUM (
  'ONE_TIME',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
);

CREATE TYPE "MatchingSponsorshipPricingPlanStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE "MatchingSponsorshipPricingRequestStatus" AS ENUM (
  'REQUESTED',
  'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "MatchingSponsorshipPricingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingPeriod" "MatchingSponsorshipPricingBillingPeriod" NOT NULL DEFAULT 'ONE_TIME',
    "campaignDurationDays" INTEGER,
    "maxCampaigns" INTEGER,
    "maxImpressions" INTEGER,
    "segment" TEXT,
    "companyId" TEXT,
    "status" "MatchingSponsorshipPricingPlanStatus" NOT NULL DEFAULT 'INACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingSponsorshipPricingPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingPlan_status_displayOrder_idx"
  ON "MatchingSponsorshipPricingPlan"("status", "displayOrder");
CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingPlan_companyId_status_idx"
  ON "MatchingSponsorshipPricingPlan"("companyId", "status");
CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingPlan_segment_status_idx"
  ON "MatchingSponsorshipPricingPlan"("segment", "status");

ALTER TABLE "MatchingSponsorshipPricingPlan"
  DROP CONSTRAINT IF EXISTS "MatchingSponsorshipPricingPlan_companyId_fkey";
ALTER TABLE "MatchingSponsorshipPricingPlan"
  ADD CONSTRAINT "MatchingSponsorshipPricingPlan_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MatchingSponsorshipPricingRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MatchingSponsorshipPricingRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "planSnapshot" JSONB NOT NULL,
    "billingRef" TEXT,
    "billingStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingSponsorshipPricingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingRequest_companyId_status_createdAt_idx"
  ON "MatchingSponsorshipPricingRequest"("companyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingRequest_planId_status_idx"
  ON "MatchingSponsorshipPricingRequest"("planId", "status");
CREATE INDEX IF NOT EXISTS "MatchingSponsorshipPricingRequest_billingRef_idx"
  ON "MatchingSponsorshipPricingRequest"("billingRef");

ALTER TABLE "MatchingSponsorshipPricingRequest"
  DROP CONSTRAINT IF EXISTS "MatchingSponsorshipPricingRequest_companyId_fkey";
ALTER TABLE "MatchingSponsorshipPricingRequest"
  ADD CONSTRAINT "MatchingSponsorshipPricingRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchingSponsorshipPricingRequest"
  DROP CONSTRAINT IF EXISTS "MatchingSponsorshipPricingRequest_planId_fkey";
ALTER TABLE "MatchingSponsorshipPricingRequest"
  ADD CONSTRAINT "MatchingSponsorshipPricingRequest_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "MatchingSponsorshipPricingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
