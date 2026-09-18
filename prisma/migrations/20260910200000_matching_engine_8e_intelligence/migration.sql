-- Feature 8E: Matching Intelligence — preferences, quality, rollups, intent seam

CREATE TYPE "MatchQualityState" AS ENUM (
  'NONE',
  'SEEN',
  'ENGAGED',
  'INTERESTED',
  'DISMISSED'
);

CREATE TYPE "MatchingIntentDirection" AS ENUM (
  'UNSPECIFIED',
  'LOOKING_FOR_SUPPLIER',
  'LOOKING_FOR_CUSTOMER',
  'LOOKING_FOR_PARTNER',
  'OFFERING_SERVICE'
);

ALTER TABLE "MatchingOpportunity"
  ADD COLUMN IF NOT EXISTS "intentDirection" "MatchingIntentDirection" NOT NULL DEFAULT 'UNSPECIFIED';

ALTER TABLE "MatchRecommendation"
  ADD COLUMN IF NOT EXISTS "qualityState" "MatchQualityState" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "preferenceBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "geographyBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiRefineBoost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "finalRankScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "isNew" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "MatchRecommendation_companyId_status_finalRankScore_idx"
  ON "MatchRecommendation"("companyId", "status", "finalRankScore");
CREATE INDEX IF NOT EXISTS "MatchRecommendation_companyId_qualityState_idx"
  ON "MatchRecommendation"("companyId", "qualityState");

CREATE TABLE IF NOT EXISTS "CompanyMatchingPreferenceSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "weightsJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMatchingPreferenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMatchingPreferenceSnapshot_companyId_key"
  ON "CompanyMatchingPreferenceSnapshot"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyMatchingPreferenceSnapshot_contentHash_idx"
  ON "CompanyMatchingPreferenceSnapshot"("contentHash");
CREATE INDEX IF NOT EXISTS "CompanyMatchingPreferenceSnapshot_builtAt_idx"
  ON "CompanyMatchingPreferenceSnapshot"("builtAt");

ALTER TABLE "CompanyMatchingPreferenceSnapshot"
  DROP CONSTRAINT IF EXISTS "CompanyMatchingPreferenceSnapshot_companyId_fkey";
ALTER TABLE "CompanyMatchingPreferenceSnapshot"
  ADD CONSTRAINT "CompanyMatchingPreferenceSnapshot_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MatchingOpportunityDailyStats" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "organicImpressions" INTEGER NOT NULL DEFAULT 0,
    "sponsoredImpressions" INTEGER NOT NULL DEFAULT 0,
    "organicInterest" INTEGER NOT NULL DEFAULT 0,
    "sponsoredInterest" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingOpportunityDailyStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchingOpportunityDailyStats_opportunityId_day_key"
  ON "MatchingOpportunityDailyStats"("opportunityId", "day");
CREATE INDEX IF NOT EXISTS "MatchingOpportunityDailyStats_day_idx"
  ON "MatchingOpportunityDailyStats"("day");

ALTER TABLE "MatchingOpportunityDailyStats"
  DROP CONSTRAINT IF EXISTS "MatchingOpportunityDailyStats_opportunityId_fkey";
ALTER TABLE "MatchingOpportunityDailyStats"
  ADD CONSTRAINT "MatchingOpportunityDailyStats_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "MatchingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MatchingPlatformDailyStats" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "organicImpressions" INTEGER NOT NULL DEFAULT 0,
    "sponsoredImpressions" INTEGER NOT NULL DEFAULT 0,
    "organicInterest" INTEGER NOT NULL DEFAULT 0,
    "sponsoredInterest" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingPlatformDailyStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchingPlatformDailyStats_day_key"
  ON "MatchingPlatformDailyStats"("day");
